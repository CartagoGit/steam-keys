/**
 * Contrato compartido entre el plugin de Vite y el cliente del navegador.
 *
 * Vive en su propio fichero, y no dentro de `dev-bridge.vite-plugin.ts`, por
 * un motivo concreto: el plugin importa `node:child_process`, que el navegador
 * no tiene. Si el cliente importara las constantes de ahi, Vite arrastraria
 * `node:child_process` al bundle del navegador y el modulo reventaria al
 * cargarse. Aqui no hay ningun import, asi que se puede importar desde los dos
 * lados sin arrastrar nada.
 */

/** Ruta del endpoint. */
export const DEV_BRIDGE_PATH = '/__dev-bridge__/sql';

/** Header con el token que debe enviar el navegador. */
export const DEV_BRIDGE_TOKEN_HEADER = 'x-steam-keys-dev-token';

/**
 * Identificador que el plugin sustituye por el token en el cliente.
 *
 * Va como texto plano y no por `define` de Vite a proposito: desde Vite 6 los
 * `define` del usuario **no se aplican al codigo del cliente en desarrollo** —
 * solo a la entrada del cliente y a `process.env.NODE_ENV`—, asi que un
 * `define` con el token ahi se quedaba sin sustituir, `typeof` de un
 * identificador sin declarar daba `"undefined"`, y toda peticion al puente
 * volvia con un 403 sin que nada fallara por el camino. El plugin lo
 * sustituye con un `transform` propio, que es donde si llega.
 */
export const DEV_TOKEN_GLOBAL = '__STEAM_KEYS_DEV_TOKEN__';

/** Operaciones que entiende el puente. */
export type BridgeOperation = 'exec' | 'select';

/** Respuesta del script del puente. */
export interface IBridgeResponse {
  ok: boolean;
  rows?: unknown[];
  rowsAffected?: number;
  error?: string;
}

/**
 * Traduce la URL de la peticion en una operacion del puente.
 *
 * Una operacion que no sea `exec` o `select` devuelve `null` en lugar de
 * degradar a otra cosa: un `?op=` manipulado tiene que fallar de forma
 * visible, no ejecutarse como si fuera una operacion distinta.
 */
export function operationFrom(url: string): BridgeOperation | null {
  const parametro = new URL(url, 'http://localhost').searchParams.get('op');

  if (parametro === 'exec' || parametro === 'select') return parametro;

  return null;
}