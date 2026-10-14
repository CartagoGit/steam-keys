#!/usr/bin/env bun
/**
 * Puente entre el servidor de desarrollo de Vite y la base de datos real.
 *
 * El problema que resuelve: dentro de Tauri la app abre SQLite con el plugin
 * nativo, pero cuando trabajas la interfaz en el navegador (`bun run dev`) no
 * hay plugin, asi que la app caia en un repositorio en memoria y se veia una
 * coleccion vacia en lugar de tus claves reales.
 *
 * ## Que NO es
 *
 * No es un tunnel de SQL. Antes lo era: el navegador mandaba la sentencia
 * entera y este servidor la ejecutaba tal cual —
 *
 *   POST /__dev-bridge__/sql?op=exec
 *   { "sql": "UPDATE game_keys SET status = ? WHERE id = ?", "binds": [3, 1] }
 *
 * Eso no decia nada. Al abrir las DevTools no habia forma de saber que habia
 * hecho la peticion sin leer el SQL concatenado, y el SQL lo componia el
 * cliente, no el servidor: cuando algo fallaba, el error salia en el sitio
 * equivocado y el que habia que arreglar no era el que habia saltado.
 *
 * Ahora el navegador pide **operaciones con nombre** —
 *
 *   POST /__dev-bridge__/keys/set-status
 *   { "id": 1, "status": "Available" }
 *
 * — y este servidor las resuelve contra la base de datos real. El mapa esta en
 * `support/bridge-handlers.ts`, y es una linea por operacion.
 *
 * ## Lo que se gana de verdad
 *
 * 1. **Cero SQL duplicado.** Este servidor monta `SqliteGameKeyRepository` con
 *    `bun:sqlite`: es el mismo repositorio que ejecuta la app de escritorio,
 *    no una copia. Una consulta se cambia en un sitio y vale para los dos.
 * 2. **Transacciones de verdad.** `setTagsForKeys` e `importRows` escriben
 *    cientos de filas. Por el tunel eran tres peticiones —`BEGIN`, el trabajo,
 *    `COMMIT`— y dependian de que este proceso aguantara la conexion abierta
 *    entre ellas para que el `ROLLBACK` cayera en la misma. Ahora son una
 *    peticion, y la transaccion ocurre entera aqui.
 * 3. **El navegador no puede ejecutar SQL.** Antes cualquier pestaña abierta
 *    podia mandar la sentencia que quisiera. Ahora no existe esa operacion.
 *
 * ## Modos
 *
 *   bun dev-bridge.serve.ts --server      -> proceso persistente (lo normal)
 *   bun dev-bridge.serve.ts <operacion>   -> una llamada y salir
 *
 * El modo `--server` es el que usa el middleware de Vite: se abre **una**
 * conexion y se queda con ella, hablando por entrada y salida con una linea
 * JSON por peticion. Antes cada sentencia era un proceso Bun nuevo, y eso rompia
 * dos cosas: las transacciones no existian —`BEGIN` abria una conexion y la
 * cerraba al terminar el proceso, el `INSERT` siguiente iba sobre otra y el
 * `COMMIT` sobre una tercera, sin confirmar nada entre ellas— y cada frase
 * costaba unos 21ms de arranque frente a los 0,2ms que tarda en SQLite.
 *
 * Los modos de una sola vez se conservan porque son los que usan los tests y lo
 * que se puede teclear a mano para echar una operacion suelta.
 *
 * ## Solo hay las operaciones de la tabla
 *
 * No existe ninguna forma de pedir «dame la tabla entera» con las claves en
 * claro, ni de ejecutar una sentencia arbitraria por HTTP. Lo que mas se
 * acerca es `backups/list`, que devuelve el contenido de una copia —y es lo que
 * necesita la pantalla de datos— pero no la coleccion.
 *
 * Nunca se invoca desde la aplicacion en produccion: solo desde el servidor de
 * desarrollo, y solo en `bun run dev`. En el build no existe.
 */
import { BunSqliteClient } from './support/bun-sqlite.client';
import { devDatabasePath } from './support/db-path.helper';
import { MANEJADORES, manejadorDe } from './support/bridge-handlers';
import { SqliteBackupRepository } from '@/repositories/sqlite-backup.repository';
import { SqliteGameKeyRepository } from '@/repositories/sqlite-game-key.repository';
import { SqliteSettingsRepository } from '@/repositories/sqlite-settings.repository';
import { crearEsquema } from '@/repositories/crear-esquema.repository';
import type { IBridgeContext, BridgeOperationName } from '@/contracts';

/** Una peticion que llega por la entrada estandar. */
interface IPeticion {
  operacion: BridgeOperationName;
  args?: unknown;
}

/** Respuesta unificada, para que el middleware pueda reenviarla tal cual. */
interface IRespuesta {
  ok: boolean;
  result?: unknown;
  error?: string;
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

/**
 * Monta los repositorios sobre una conexion real.
 *
 * Todo lo que este servidor sabe hacer sale de aqui. Es lo que hace que no haya
 * una segunda implementacion: lo que hay montado es `SqliteGameKeyRepository`,
 * el mismo que corre la app de escritorio, y lo unico que cambia es de donde
 * sale el cliente.
 */
function montarContexto(): IBridgeContext {
  const db = new BunSqliteClient(rutaBaseDeDatos());

  /*
   * El esquema se despliega aqui y no solo dentro del constructor del cliente.
   *
   * `BunSqliteClient` ejecuta `SCHEMA_STATEMENTS`, que es todo
   * `CREATE TABLE IF NOT EXISTS` —idempotente, pero que **no toca una tabla que
   * ya existe**—. Las columnas que se hayan anadido despues —el tono de las
   * etiquetas, el titulo— no estan ahi: solo viven en `COLUMNAS_ANADIDAS`, y
   * esa lista no la ejecuta nadie. Sin esta llamada, abrir la base de
   * desarrollo con el codigo nuevo falla con «no such column» en la primera
   * consulta, y parece un fallo del repositorio cuando lo que falta es el
   * despliegue del esquema.
   *
   * Se reutiliza `crearEsquema` y no una copia: es el unico sitio donde esta
   * escrito, y una copia es justo lo que se desincroniza cuando se anade una
   * columna nueva —la app de escritorio migra bien y el puente no, que es la
   * forma mas incomoda de descubrirlo.
   */
  esquemaPendiente = crearEsquema(db);

  return {
    claves: new SqliteGameKeyRepository(db),
    ajustes: new SqliteSettingsRepository(db),
    respaldos: new SqliteBackupRepository(db),
  };
}

/**
 * La migracion en curso, o `null` si no hay ninguna.
 *
 * Va como promesa y no como `await` porque `montarContexto` es sincrono: es lo
 * que se pasa a los manejadores y no puede ponerse a esperar. `esperarEsquema`
 * la consume antes de atender la primera peticion, que es el unico sitio donde
 * importa —si el esquema no esta, la consulta falla.
 */
let esquemaPendiente: Promise<void> | null = null;

/** Espera a que el esquema este al dia. Idempotente y barato de repetir. */
async function esperarEsquema(): Promise<void> {
  const pendiente = esquemaPendiente;

  if (pendiente === null) return;

  await pendiente;
}

function responder(respuesta: IRespuesta): void {
  process.stdout.write(JSON.stringify(respuesta));
}

/**
 * Escribe la respuesta en modo servidor, **con salto de linea**.
 *
 * Sin el salto, `readline` del padre no emite nunca una linea y se queda
 * esperando hasta su timeout sin decir nada.
 */
function responderLinea(respuesta: IRespuesta): void {
  process.stdout.write(`${JSON.stringify(respuesta)}\n`);
}

/**
 * Ejecuta una operacion y la serializa.
 *
 * Una operacion que no exista devuelve la lista de las que si, en vez de un
 * error generico: si el navegador pide algo que el servidor no tiene, lo que
 * hace falta es ver la lista, no un «error desconocido».
 */
async function ejecutar(
  contexto: IBridgeContext,
  peticion: IPeticion,
): Promise<IRespuesta> {
  /*
   * Antes de mirar la peticion.
   *
   * El esquema va por su cuenta y no hay ninguna peticion que lo pida —tampoco
   * en la app de escritorio, donde lo dispara `migrate()` al abrir el cliente—,
   * asi que la primera consulta despues de arrancar seria la que se encontrase
   * con una base sin migrar. Se espera una vez, aqui, que es donde se ensure.
   */
  await esperarEsquema();

  const manejador = manejadorDe(peticion.operacion);

  if (manejador === null) {
    return {
      ok: false,
      error:
        `Operacion desconocida: "${peticion.operacion}". ` +
        'Las que hay son: ' +
        Object.keys(MANEJADORES)
          .sort()
          .join(', '),
    };
  }

  try {
    const resultado = await manejador(contexto, (peticion.args ?? null) as never);

    // `undefined` no sobrevive a `JSON.stringify`: se perderia la clave y el
    // cliente leeria `undefined` en vez de un `null` explicito.
    return { ok: true, result: resultado === undefined ? null : resultado };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
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
 * Atiende peticiones de una en una mientras el proceso este vivo.
 *
 * **La entrada son trozos, no lineas.** `Bun.stdin.stream()` entrega lo que
 * llega por la tuberia, y una peticion puede entrar partida en varios trozos o
 * compartir uno con la siguiente. Leer cada trozo como si fuera una peticion
 * entera hacia que el puente se quedara colgado sin decir nada: las peticiones
 * siguientes serespondian a un trozo anterior, o a ninguno.
 *
 * Por eso se acumula y se parte por saltos de linea, que es justo lo que define
 * el protocolo. Un peticion que llega entera en un trozo —el caso normal, con
 * el middleware escribiendo de una en una— sale igual.
 */
async function modoServidor(): Promise<void> {
  const contexto = montarContexto();
  const decodificador = new TextDecoder();

  let acumulado = '';

  for await (const trozo of Bun.stdin.stream() as unknown as AsyncIterable<Uint8Array>) {
    acumulado += decodificador.decode(trozo as Uint8Array, { stream: true });

    let corte = acumulado.indexOf('\n');

    while (corte !== -1) {
      const linea = acumulado.slice(0, corte).trim();

      acumulado = acumulado.slice(corte + 1);

      if (linea.length > 0) responderLinea(await atender(contexto, linea));

      corte = acumulado.indexOf('\n');
    }
  }
}

/** Parsea una linea del protocolo, la ejecuta y devuelve la respuesta. */
async function atender(
  contexto: IBridgeContext,
  linea: string,
): Promise<IRespuesta> {
  let peticion: IPeticion;

  try {
    peticion = JSON.parse(linea) as IPeticion;
  } catch {
    return { ok: false, error: 'La peticion no es JSON valido.' };
  }

  return ejecutar(contexto, peticion);
}

/** Una llamada y salir: lo que usan los tests y lo que se teclea a mano. */
async function modoUnaVez(operacion: string): Promise<void> {
  const cuerpo = await leerEntrada();

  let args: unknown;

  if (cuerpo.trim().length > 0) {
    try {
      args = JSON.parse(cuerpo);
    } catch {
      responder({ ok: false, error: 'Los argumentos no son JSON valido.' });
      return;
    }
  }

  const contexto = montarContexto();

  responder(
    await ejecutar(contexto, {
      operacion: operacion as BridgeOperationName,
      args,
    }),
  );
}

const [modo] = process.argv.slice(2);

if (modo === '--server') {
  await modoServidor();
} else if (modo === undefined) {
  responder({
    ok: false,
    error:
      'Uso: dev-bridge.serve.ts --server | dev-bridge.serve.ts <operacion>\n' +
      'Operaciones: ' +
      Object.keys(MANEJADORES)
        .sort()
        .join(', '),
  });
} else {
  await modoUnaVez(modo);
}