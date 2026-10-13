import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

import {
  DEV_BRIDGE_PATH,
  DEV_BRIDGE_TOKEN_HEADER,
  DEV_TOKEN_GLOBAL,
  operacionDe,
} from './dev-bridge.contract';
import type { IBridgeResponse } from './dev-bridge.contract';

/*
 * El contrato **no** se reexporta.
 *
 * Se hacia al sacarlo a su propio fichero, para que el cliente del navegador
 * importara las constantes de ahi sin arrastrar `node:child_process` al bundle.
 * El reexport se quedo porque en aquel momento no habia consumidor todavia, y
 * no lo hubo nunca: el cliente y los tests lo importan de `dev-bridge.contract`
 * directamente. Un barril que nadie usa es una segunda puerta al mismo sitio,
 * y la que se acabaria usando mal.
 */

/**
 * Puente de desarrollo: da al navegador acceso a la base de datos real.
 *
 * Cuando trabajas la interfaz con `bun run dev` no hay Tauri, asi que el plugin
 * SQL nativo no existe y la app cae en un repositorio en memoria: se ve una
 * coleccion vacia en lugar de tus claves. Este middleware deja que el
 * navegador ejecute SQL contra el mismo fichero SQLite que usa la app de
 * escritorio.
 *
 * Salvaguardas, en este orden:
 *
 * 1. **Solo en desarrollo.** El plugin lleva `apply: 'serve'`, asi que el
 *    middleware no existe ni en `vite build` ni en el ejecutable de Windows.
 *    El cliente del navegador tampoco llega al bundle: `devBridgeStubPlugin()`
 *    lo sustituye por un modulo que falla al DCHECK `build/`.
 * 2. **Token por proceso.** Se genera al arrancar el servidor y se inyecta en
 *    el bundle del navegador; una peticion sin ese header devuelve 403. Al ser
 *    un header personalizado, el navegador obliga a un preflight CORS, de modo
 *    que una pagina web cualquiera no puede llamar a `127.0.0.1` aunque tenga
 *    a la victima abierta.
 * 3. **Solo en loopback.** Vite escucha en `127.0.0.1`, nunca en `0.0.0.0`.
 * 4. **Sin volcado masivo.** Solo hay `exec` y `select`. No existe forma de
 *    pedir "dame la tabla entera" con las claves en claro.
 *
 * Aun asi, cualquier SQL que llegue al puente se ejecuta contra tu base de
 * datos. Es una herramienta de desarrollo, no una API.
 */

/** Tiempo maximo de una peticion al puente, en milisegundos. */
const TIMEOUT_MS = 15_000;

/** Tope del cuerpo de la peticion, en bytes. */
const MAX_BODY_BYTES = 1024 * 1024;

/** Final del path del cliente del puente, que no debe llegar a produccion. */
const CLIENTE_BRIDGE = 'repositories/http-bridge.client.ts';

/**
 * El identificador del token, **solo cuando se usa como identificador**.
 *
 * Las comillas de alrededor son lo que hace el trabajo: el mismo nombre esta
 * escrito en `dev-bridge.contract.ts` como `'__STEAM_KEYS_DEV_TOKEN__'`, que es
 * su definicion, y sustituirlo ahi deja `export const DEV_TOKEN_GLOBAL = ""abc"`
 * — dos comillas pegadas, que no es ni JavaScript ni TypeScript, y deja toda la
 * pagina en blanco con un "Invalid or unexpected token" que no senala el fichero.
 *
 * Mirar las comillas tambien deja fuera los comentarios que lo nombran, que no
 * hay que tocar y que si, al cambiar, invalidarian el mapa de fuentes entero.
 */
const IDENTIFICADOR_EN_USO = new RegExp(
  `(?<!['"\`])${DEV_TOKEN_GLOBAL}(?!['"\`])`,
  'g',
);

/**
 * Cambia el identificador por el token en el codigo que lo usa.
 *
 * Va suelto y no dentro del plugin para poder comprobarlo: los dos fallos que
 * dio esto —sustituirlo tambien en el contrato, y olvidar el salto de linea—
 * no rompian la compilacion ni un solo test, solo dejaban la pagina en blanco
 * al abrir el navegador. Es exactamente el tipo de cosa que necesita un test.
 */
export function sustituirToken(codigo: string, token: string): string {
  return codigo.replaceAll(IDENTIFICADOR_EN_USO, JSON.stringify(token));
}

/**
 * Plugin que borra el cliente del puente del bundle de produccion.
 *
 * `apply: 'serve'` en el plugin del middleware ya cierra el servidor, pero el
 * cliente (`devBridgeDatabaseClient`) se importa en dinamico, asi que Vite lo
 * emitia como un chunk aparte: muerto en la practica, pero presente en disco.
 * Aqui se sustituye por un modulo que falla al usarlo, de modo que si alguna
 * vez se ejecutara en produccion se note de inmediato en lugar de fallar en
 * silencio contra un endpoint que no existe.
 *
 * Se registra aparte porque este plugin **no** lleva `apply: 'serve'`: tiene que
 * correr justamente en `vite build`, que es donde se aplica la sustitucion.
 */
export function devBridgeStubPlugin(): Plugin {
  return {
    name: 'steam-keys:dev-bridge-stub',
    apply: 'build',

    // `pre` es imprescindible: sin esto el plugin de resolucion de Vite
    // normaliza la ruta antes y a este hook ya no le llega nada.
    enforce: 'pre',

    resolveId(source) {
      // A este hook el especificador llega tal cual se escribio en el codigo
      // (`@/services/dev-bridge-database.service`, sin extension) o ya en
      // forma absoluta, segun por donde entre. Se comparan las dos formas.
      const esElCliente =
        source.includes('dev-bridge-database.service') ||
        source.endsWith(CLIENTE_BRIDGE);

      if (!esElCliente) return null;

      return '\0steam-keys:dev-bridge-off';
    },

    load(id) {
      if (id !== '\0steam-keys:dev-bridge-off') return null;

      return `export function pedir() {
  throw new Error('El puente de desarrollo no existe en produccion.');
}`;
    },
  };
}

/** Plugin de Vite que expone la base de datos real al navegador. */
export function devBridgePlugin(): Plugin {
  const token = randomBytes(24).toString('hex');

  return {
    name: 'steam-keys:dev-bridge',
    apply: 'serve',

    /*
     * La sustitucion va **despues** de que Vite Quite los tipos.
     *
     * Los ficheros que leen el token lo declaran con `declare const
     * __STEAM_KEYS_DEV_TOKEN__`, y al sustituir el identificador a rajatabillo
     * eso se combia en `declare const "abc123": string | undefined`, que no es
     * TypeScript ni JavaScript: un "Invalid or unexpected token" al cargar, con
     * la interfaz en blanco. Con `post` la declaracion ya no esta y solo queda
     * el uso, que es lo que hay que cambiar.
     */
    enforce: 'post',

    /*
     * El token viaja al cliente para que pueda autenticarse.
     *
     * Se sustituye con un `transform` y **no** con `define`. Desde Vite 6, los
     * `define` que pone un plugin solo se aplican al codigo del cliente en
     * modo build; en desarrollo se saltan enteros. Con `define` el token se
     * quedaba sin poner, `typeof __STEAM_KEYS_DEV_TOKEN__` de un identificador
     * sin declarar devolvia `"undefined"`, y el navegador mandaba la peticion
     * sin token: un 403 en cada llamada al puente del que no se enteraba
     * nadie, porque el fallo se comia el `catch` del cliente.
     *
     * Solo se toca lo que lo menciona. El identificador aparece en dos
     * sitios —el cliente del puente y `runtime.helper.ts`, que decide si la
     * sesion va contra SQLite o contra `localStorage`— y podrian ser mas a
     * medida que se anadan. En vez de llevar una lista de ficheros que se
     * quedaria corta sin avisar, se sustituye en cualquier modulo que mencione
     * el identificador: si no lo menciona, no hay nada que sustituir y el
     * token no viaja a ninguna parte.
     *
     * El `transform` es de `apply: 'serve'`, asi que en `vite build` no corre,
     * y alli el cliente ni siquiera llega a existir: lo sustituye
     * `devBridgeStubPlugin()`.
     */
    transform(code) {
      const substituido = sustituirToken(code, token);

      // Si no habia ninguna mencion no se devuelve nada: transformar el modulo
      // entero sin cambiar un byte es lo que hace que Vite lo marque como
      // cambiado y lo mande entero otra vez al cliente.
      if (substituido === code) return null;

      return {
        code: substituido,
        map: null,
      };
    },

    configureServer(server) {
      // El middleware se registra sin ruta a proposito: al pasarle un prefijo,
      // Connect lo recorta de `req.url` antes de llamarnos y la comprobacion
      // de la ruta no tendria nada que validar. Ademas, registrarlo al principio
      // evita que la transformacion de modulos de Vite toque la peticion.
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next, token);
      });

      // Sin esto el proceso se queda como hijo huerfano de Vite y `Ctrl+C` no
      // lo baja nunca: seguiria con la base de datos de desarrollo abierta.
      server.httpServer?.on('close', cerrarPuente);
    },
  };
}

/** Resuelve la peticion y escribe la respuesta. */
async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  token: string,
): Promise<void> {
  // El middleware se registra para esta ruta; si no viene por aqui, no es
  // nuestra peticion y se pasa al siguiente.
  const url = req.url ?? '';
  if (!url.startsWith(DEV_BRIDGE_PATH)) {
    next();
    return;
  }

  const recibido = req.headers[DEV_BRIDGE_TOKEN_HEADER];

  if (Array.isArray(recibido) || recibido !== token) {
    send(res, 403, { ok: false, error: 'Token invalido.' });
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, { ok: false, error: 'Solo se admite POST.' });
    return;
  }

  const operacion = operacionDe(url);

  if (operacion === null) {
    send(res, 400, {
      ok: false,
      error:
        `Peticion sin operacion. Las operaciones van en la ruta: ` +
        `${DEV_BRIDGE_PATH}/<grupo>/<accion>.`,
    });
    return;
  }

  let cuerpo = '';
  try {
    cuerpo = await readBody(req);
  } catch (error) {
    send(res, 400, {
      ok: false,
      error: error instanceof Error ? error.message : 'Peticion ilegible.',
    });
    return;
  }

  try {
    const salida = await ejecutarEnPuente(operacion, cuerpo);

    send(res, 200, JSON.parse(salida) as IBridgeResponse);
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : 'Error desconocido en el puente.';

    // Si el script ha podido responder, su mensaje es mas util que el del
    // propio `execFile` (que solo habla de exit code).
    const delScript = (error as { stdout?: string }).stdout;

    if (typeof delScript === 'string' && delScript.length > 0) {
      try {
        send(res, 500, JSON.parse(delScript) as IBridgeResponse);
        return;
      } catch {
        // Sigue con el mensaje generico.
      }
    }

    send(res, 500, { ok: false, error: mensaje });
  }
}

/** Lee el cuerpo de la peticion, con un tope de tamaño. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const trozos: Buffer[] = [];
    let total = 0;

    req.on('data', (trozo: Buffer) => {
      total += trozo.length;

      if (total > MAX_BODY_BYTES) {
        reject(new Error('El cuerpo de la peticion es demasiado grande.'));
        req.destroy();
        return;
      }

      trozos.push(trozo);
    });

    req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
    req.on('error', (error: Error) => reject(error));
  });
}

/** Escribe una respuesta JSON. */
function send(res: ServerResponse, codigo: number, cuerpo: unknown): void {
  res.statusCode = codigo;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(cuerpo));
}

/** Ruta al script del puente, resuelta desde este fichero. */
/**
 * El proceso del puente, vivo mientras lo este el servidor.
 *
 * Es **uno solo** para todo el arranque y toda la sesion. Antes cada sentencia
 * era un proceso Bun nuevo —unos 21ms de arranque frente a las 0,2ms que tarda
 * la sentencia en SQLite—, y ademas cada uno abria su conexion y la cerraba,
 * con lo que una transaccion se rompia en tres trozos sin que nada fallara.
 */
interface IPuente {
  proceso: ChildProcessWithoutNullStreams;
  lineas: Interface;
  /** Respuestas que aun no se han recogido, una por peticion. */
  esperas: ((linea: string) => void)[];
}

let puente: IPuente | null = null;

/** Peticiones encoladas, para que nunca haya dos en vuelo a la vez. */
let cola: Promise<unknown> = Promise.resolve();

/** Arranca el proceso del puente si no lo hay, y devuelve el que hay. */
function arrancarPuente(): IPuente {
  if (puente !== null) return puente;

  const proceso = spawn('bun', [scriptPath(), '--server'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const lineas = createInterface({ input: proceso.stdout });

  /*
   * La salida de error se reenvia a la consola de Vite.
   *
   * Sin esto el `pipe` se queda sin leer: cuando el proceso llena el búfer del
   * pipe —64 KB— se bloquea a si mismo esperando a que alguien lo lea, y el
   * puente se cuelga sin dar ningun error. Y sin el `console.error` no hay forma
   * de ver por que fallo una sentencia.
   */
  proceso.stderr.on('data', (trozo: Buffer) => {
    console.error(`[dev-bridge] ${trozo.toString().trimEnd()}`);
  });

  const nuevo: IPuente = { proceso, lineas, esperas: [] };

  /*
   * Una linea de salida por peticion, y siempre en orden porque el puente las
   * responde en serie. Quien este esperando es el primero que se levanto.
   */
  lineas.on('line', (linea) => {
    nuevo.esperas.shift()?.(linea);
  });

  /**
   * Si el proceso se muere —un `SIGTERM` de Vite, un `kill`— se sueltan los que
   * estaban esperando y se olvida el puente, para que la siguiente peticion lo
   * levante otra vez en lugar de quedarse colgada sin respuesta.
   */
  const alMorir = (): void => {
    for (const espera of nuevo.esperas.splice(0)) {
      espera(JSON.stringify({ ok: false, error: 'El proceso del puente se ha cerrado.' }));
    }

    puente = null;
  };

  proceso.on('exit', alMorir);
  proceso.on('error', alMorir);

  puente = nuevo;

  return nuevo;
}

/** Cierra el proceso del puente, si lo hay. */
function cerrarPuente(): void {
  if (puente === null) return;

  puente.lineas.close();
  puente.proceso.kill();
  puente = null;
}

/**
 * Envia una peticion al puente y devuelve lo que responde por stdout.
 *
 * Pide permiso antes de escribir en el proceso. El puente mantiene **una**
 * conexion, y una transaccion son varias frases seguidas: si dos se solaparan,
 * el `BEGIN` de una se encontraria con el `COMMIT` de la otra. Encolando, cada
 * peticion espera a que termine la anterior y la transaccion queda entera.
 *
 * Va ademas con `TIMEOUT_MS`, que antes era el `timeout` de `execFileSync` y
 * aqui hay que ponerlo a mano: sin el, una sentencia colgada —un bloqueo de
 * SQLite porque otra escritura tiene el fichero abierto— dejaria el proceso del
 * puente esperando para siempre y con el toda la cola detras.
 */
function ejecutarEnPuente(operacion: string, cuerpo: string): Promise<string> {
  const siguiente = cola.then(() => escribirAlPuente(operacion, cuerpo));

  // La cola no debe romperse porque una peticion falle: lo que va a fallar es
  // esa peticion, y la siguiente tiene que poder salir igual.
  cola = siguiente.catch(() => undefined);

  return siguiente;
}

/** Escribe una peticion en el proceso vivo y espera a su linea de respuesta. */
function escribirAlPuente(operacion: string, cuerpo: string): Promise<string> {
  return new Promise<string>((cumplir, fallar) => {
    const vivo = arrancarPuente();

    const temporizador = setTimeout(() => {
      fallar(new Error(`El puente de desarrollo no ha respondido en ${TIMEOUT_MS} ms.`));
    }, TIMEOUT_MS);

    vivo.esperas.push((linea) => {
      clearTimeout(temporizador);
      cumplir(linea);
    });

    /*
     * Operacion y argumentos van **en el mismo objeto**, serializado entero.
     *
     * El protocolo es **una linea por peticion**, y los argumentos pueden traer
     * saltos de linea dentro —una etiqueta con un salto, el texto de una nota—.
     * Al meterlos en el objeto y serializarlo todo, los saltos quedan dentro de
     * las comillas del JSON y la linea no se parte en varias peticiones.
     *
     * El cuerpo llega como texto y se vuelve a parsear aqui para poder meterlo
     * en el objeto. Una operacion que no acepta nada llega vacio, y entonces se
     * manda `args` a `null` en vez de fallar al parsear.
     */
    vivo.proceso.stdin.write(
      `${JSON.stringify({ operacion, args: cuerpo.length > 0 ? JSON.parse(cuerpo) : null })}\n`,
    );
  });
}

function scriptPath(): string {
  const aqui = dirname(fileURLToPath(import.meta.url));
  return join(aqui, '..', '..', 'tools', 'scripts', 'dev-bridge.serve.ts');
}