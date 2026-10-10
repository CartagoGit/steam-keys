import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

import {
  DEV_BRIDGE_PATH,
  DEV_BRIDGE_TOKEN_HEADER,
  DEV_TOKEN_GLOBAL,
  operationFrom,
} from './dev-bridge.contract';
import type { BridgeOperation, IBridgeResponse } from './dev-bridge.contract';

// El contrato se reexporta para que los tests y cualquier consumidor sigan
// importandolo de aqui, sin obligarles a conocer el fichero nuevo.
export { DEV_BRIDGE_PATH, DEV_BRIDGE_TOKEN_HEADER, DEV_TOKEN_GLOBAL, operationFrom };
export type { BridgeOperation, IBridgeResponse };

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
const CLIENTE_BRIDGE = 'services/dev-bridge-database.service.ts';

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

      return `export const devBridgeDatabaseClient = {
  execute() { throw new Error('El puente de desarrollo no existe en produccion.'); },
  select() { throw new Error('El puente de desarrollo no existe en produccion.'); },
  migrate() { throw new Error('El puente de desarrollo no existe en produccion.'); },
  close() {},
};`;
    },
  };
}

/** Plugin de Vite que expone la base de datos real al navegador. */
export function devBridgePlugin(): Plugin {
  const token = randomBytes(24).toString('hex');

  return {
    name: 'steam-keys:dev-bridge',
    apply: 'serve',

    // El token viaja al cliente para que pueda autenticarse.
    config: () => ({
      define: {
        [DEV_TOKEN_GLOBAL]: JSON.stringify(token),
      },
    }),

    configureServer(server) {
      // El middleware se registra sin ruta a proposito: al pasarle un prefijo,
      // Connect lo recorta de `req.url` antes de llamarnos y la comprobacion
      // de la ruta no tendria nada que validar. Ademas, registrarlo al principio
      // evita que la transformacion de modulos de Vite toque la peticion.
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next, token);
      });
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

  const operacion = operationFrom(url);

  if (operacion === null) {
    send(res, 400, {
      ok: false,
      error: 'Operacion desconocida: solo se admiten "exec" y "select".',
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
    const salida = execFileSync('bun', [scriptPath(), operacion], {
      input: cuerpo,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
    });

    send(res, 200, JSON.parse(salida) as IBridgeResponse);
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : 'Error desconocido en el puente.';

    // Si el script ha podido responder, su mensaje es mas util que el del
    // propio `execFileSync` (que habla de exit code).
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
function scriptPath(): string {
  const aqui = dirname(fileURLToPath(import.meta.url));
  return join(aqui, '..', '..', 'tools', 'scripts', 'dev-bridge.serve.ts');
}