/**
 * Puente entre el servidor de desarrollo de Vite y la base de datos real.
 *
 * El problema que resuelve: dentro de Tauri la app abre SQLite con el plugin
 * nativo, pero cuando trabajas la interfaz en el navegador (`bun run dev`) no
 * hay plugin, asi que la app caia en un repositorio en memoria y se veia una
 * coleccion vacia en lugar de tus 403 claves reales.
 *
 * En vez de reimplementar el repositorio, este script **ejecuta SQL de verdad**
 * contra el mismo fichero SQLite que usa la app, y el cliente de HTTP se
 * limita a enviarle sentencias. Asi el unico codigo que escribe en la base de
 * datos sigue siendo `SqliteGameKeyRepository`.
 *
 * Uso interno, invocado por el middleware de Vite:
 *
 *   bun dev-bridge.serve.ts --server      -> proceso persistente (lo normal)
 *   bun dev-bridge.serve.ts exec <json>   -> una sentencia y salir
 *   bun dev-bridge.serve.ts select <json> -> una consulta y salir
 *
 * El modo normal es `--server`: se abre **una** conexion y se queda con ella,
 * hablando por entrada y salida con una peticion JSON por linea. Antes cada
 * sentencia era un proceso Bun nuevo, y eso rompia dos cosas:
 *
 * 1. **Las transacciones no existian.** `BEGIN` abria una conexion y la
 *    cerraba al terminar el proceso; el `INSERT` siguiente iba sobre otra, y el
 *    `COMMIT` sobre una tercera. Cada frase por su cuenta y sin confirmar nada
 *    entre ellas: un `import` que fallara a mitad dejaba las anteriores
 *    escritas. Con una sola conexion, el `BEGIN` sigue abierto de verdad.
 * 2. **Coste por frase.** Levantar el runtime cuesta unos 21ms frente a las
 *    0,2ms que tarda la sentencia en SQLite. El arranque hacia cuarenta y
 *    pico viajes solo para desplegar el esquema.
 *
 * Los modos de una sola vez se conservan porque son lo que usan los tests y lo
 * que se puede teclear a mano paraechar una sentencia.
 *
 * Solo hay dos operaciones a proposito. Una tercera, de volcado masivo, se
 * descarto porque devolvia la tabla entera con las claves en claro: aqui no
 * existe ninguna forma de pedir "dame todo" sin pasar por una consulta, y las
 * consultas son las que escribe `SqliteGameKeyRepository`.
 *
 * Nunca se invoca desde la aplicacion: solo desde el servidor de desarrollo,
 * y solo en `bun run dev`. En el build de produccion no existe.
 */
import { Database, type SQLQueryBindings } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { devDatabasePath } from './support/db-path.helper';
import { SCHEMA_STATEMENTS } from '@/contracts/constants/db-schema.constants';

/** Una sentencia que hay que ejecutar contra la base de datos. */
interface IPeticion {
  sql: string;
  binds?: unknown[];
}

/** Respuesta unificada, para que el middleware pueda reenviarla tal cual. */
interface IRespuesta {
  ok: boolean;
  rows?: unknown[];
  rowsAffected?: number;
  error?: string;
}

/** Lee el cuerpo de una peticion desde la entrada estandar. */
async function leerEntrada(): Promise<string> {
  if (process.stdin.isTTY) return '';

  const trozos: Buffer[] = [];

  for await (const trozo of Bun.stdin.stream() as unknown as AsyncIterable<Uint8Array>) {
    trozos.push(Buffer.from(trozo));
  }

  return Buffer.concat(trozos).toString('utf8');
}

/**
 * Ruta de la base de datos que usa el puente.
 *
 * `STEAM_KEYS_DB_PATH` permite apuntar a otra base de datos, y es lo que usan
 * los tests para no tocar la real.
 *
 * Sin esa variable **no** se usa `databasePath()`, que es la de la app de
 * escritorio. Antes si, y eso hacia que abrir la interfaz en el navegador
 * escribiera sobre la coleccion de verdad: un reset o una importacion a medias
 * desde el navegador se comian las claves, y de `dist/` no hay copia en git.
 * Ahora el navegador trabaja sobre `.dev/steam-keys-dev.db`, una base de datos
 * aparte con el mismo esquema.
 */
function rutaBaseDeDatos(): string {
  return devDatabasePath();
}

/** Abre la base de datos en solo lectura. */
function abrirLectura(): Database {
  const ruta = rutaBaseDeDatos();

  if (!existsSync(ruta)) {
    throw new Error(
      `No existe la base de datos de desarrollo: ${ruta}. ` +
        'Se crea sola en cuanto se escribe algo; si quieres verla con tus ' +
        'claves, arranca con STEAM_KEYS_DB_PATH=dist/steam-keys.db.',
    );
  }

  return new Database(ruta, { readonly: true });
}

/** Abre la base de datos en escritura, creando el esquema si hace falta. */
function abrirEscritura(): Database {
  const ruta = rutaBaseDeDatos();
  mkdirSync(dirname(ruta), { recursive: true });

  const db = new Database(ruta, { create: true });

  for (const sentencia of SCHEMA_STATEMENTS) db.run(sentencia);

  return db;
}

/** Parsea la peticion JSON que llega por la entrada estandar. */
function parsearPeticion(cuerpo: string): IPeticion {
  if (cuerpo.trim().length === 0) return { sql: '' };

  const datos = JSON.parse(cuerpo) as IPeticion;

  if (typeof datos.sql !== 'string' || datos.sql.length === 0) {
    throw new Error('La peticion debe incluir una sentencia SQL.');
  }

  return { sql: datos.sql, binds: datos.binds ?? [] };
}

function responder(respuesta: IRespuesta): void {
  process.stdout.write(JSON.stringify(respuesta));
}

/**
 * Escribe la respuesta en modo servidor, **con salto de linea**.
 *
 * El protocolo es de una linea por peticion, y el salto es lo unico que le dice
 * al padre donde acaba una respuesta y empieza la siguiente. Sin el, quien lee
 * con `readline` no ve nunca una linea entera —`readline` solo emite al llegar
 * el `\n`— y se queda esperando en silencio mientras el padre espera una
 * respuesta que ya ha salido. En el modo de una vez el salto no hace falta: se
 * lee la salida entera y se parsea.
 */
function responderLinea(respuesta: IRespuesta): void {
  process.stdout.write(`${JSON.stringify(respuesta)}\n`);
}

/**
 * Ejecuta una peticion contra la conexion que se le pase.
 *
 * Es el nucleo, y lo comparten los dos modos: el worker le pasa **su**
 * conexion —la unica que hay— y el modo de una vez, una recien abierta. La
 * diferencia entre que una transaccion funcione y no la marca exactamente esta
 * funcion: recibe el mango en vez de abrirlo por dentro.
 */
function ejecutarPeticion(
  operacion: string,
  cuerpo: string,
  db: Database,
): IRespuesta {
  switch (operacion) {
    case 'exec': {
      const peticion = parsearPeticion(cuerpo);
      const resultado = db.run(peticion.sql, (peticion.binds ?? []) as never[]);

      return { ok: true, rowsAffected: Number(resultado.changes) };
    }

    case 'select': {
      const peticion = parsearPeticion(cuerpo);

      /*
       * El puente acepta lo que mande el navegador y solo reenvia el `bind` a
       * SQLite. `SQLQueryBindings` es la union de lo que Bun acepta de verdad;
       * el enunciado llega como `unknown[]` porque viene por JSON, y el motor
       * es quien avisa si se le pasa algo que no sea un valor.
       */
      const binds = (peticion.binds ?? []) as SQLQueryBindings[];
      const filas = db.query(peticion.sql).all(...binds) as unknown[];

      return { ok: true, rows: filas };
    }

    default:
      return { ok: false, error: `Operacion desconocida: ${operacion}` };
  }
}

/**
 * Atiende una linea del protocolo y devuelve lo que hay que responder.
 *
 * El enunciado va **dentro** de la linea, como texto, y no suelto. Es lo que
 * permite el protocolo de una linea por peticion: el SQL lleva saltos de linea
 * propios, asi que suelto partiria la linea en varios pedazos y cada uno se
 * leeria como una peticion distinta. Al serializarlo entero, los saltos van
 * dentro de las comillas del JSON.
 */
function atenderLinea(linea: string, db: Database): IRespuesta {
  if (linea.trim().length === 0) return { ok: true };

  try {
    const peticion = JSON.parse(linea) as { op?: string; cuerpo?: string };

    return ejecutarPeticion(peticion.op ?? '', peticion.cuerpo ?? '', db);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Modo `--server`: una conexion para toda la vida del proceso.
 *
 * Lee **una peticion por linea** de la entrada estandar y escribe **una
 * respuesta por linea**, en el mismo orden. Todo lo que hay dentro del bucle
 * es sincrono —decodificar, partir, ejecutar y responder—, asi que las
 * peticiones salen estrictamente en serie: si dos transacciones se solaparan,
 * sus `BEGIN` y `COMMIT` se entremezarian en la conexion y la segunda cerraria
 * lo que hubiera abierto la primera. En serie no puede pasar.
 *
 * La entrada se lee a mano y **no** con `node:readline`. Sobre `process.stdin`
 * de Bun, `readline` se queda esperando eternamente cuando el padre escribe por
 * una tuberia —que es justo como le habla el plugin de Vite—: el proceso
 * arranca, no dice nada y se come la primera peticion sin contestarla. Con
 * `Bun.stdin.stream()` llega a la primera.
 */
async function modoServidor(): Promise<void> {
  const db = abrirEscritura();
  const decodificador = new TextDecoder();

  /** Lo que ha llegado del ultimo trozo y todavia no forma una linea entera. */
  let resto = '';

  try {
    for await (const trozo of Bun.stdin.stream() as AsyncIterable<Uint8Array>) {
      resto += decodificador.decode(trozo, { stream: true });

      let corte = resto.indexOf('\n');

      while (corte !== -1) {
        responderLinea(atenderLinea(resto.slice(0, corte), db));

        resto = resto.slice(corte + 1);
        corte = resto.indexOf('\n');
      }
    }

    // Lo que llegue sin salto de linea final se responde igualmente: si no,
    // esa peticion se pierde en silencio y el padre espera hasta su tiempo
    // limite sin entender por que.
    if (resto.trim().length > 0) responderLinea(atenderLinea(resto, db));
  } finally {
    db.close();
  }
}

async function principal(): Promise<void> {
  const operacion = process.argv[2] ?? '';

  if (operacion === '--server') {
    await modoServidor();
    return;
  }

  try {
    const cuerpo = await leerEntrada();

    if (operacion !== 'exec' && operacion !== 'select') {
      responder({ ok: false, error: `Operacion desconocida: ${operacion}` });
      process.exitCode = 1;
      return;
    }

    // Una consulta de solo lectura falla si el fichero no existe, y el aviso
    // lo trae `abrirLectura()`: es mucho mas util que el error generico de
    // SQLite. Para escribir, en cambio, la base se crea sola.
    const db = operacion === 'exec' ? abrirEscritura() : abrirLectura();

    try {
      responder(ejecutarPeticion(operacion, cuerpo, db));
    } finally {
      db.close();
    }
  } catch (error) {
    responder({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

await principal();

/** Reexportado para que el script se pueda importar en tests. */
export { abrirLectura, abrirEscritura, atenderLinea, ejecutarPeticion, parsearPeticion };

/** Ruta esperada de la base de datos, util para diagnostico. */
export const RUTA_BD = devDatabasePath;

/** Directorio de este script, para localizar el repositorio. */
export const DIR_SCRIPT = dirname(join(import.meta.path));