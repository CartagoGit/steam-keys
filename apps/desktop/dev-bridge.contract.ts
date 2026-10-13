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

/** Raiz del puente. La operacion va a continuacion: `/__dev-bridge__/keys/list`. */
export const DEV_BRIDGE_PATH = '/__dev-bridge__';

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

/**
 * Respuesta del puente.
 *
 * `result` lleva lo que devuelve la operacion, con la forma que declara en
 * `contracts/bridge/bridge-operations.ts`. Va en una caja y no suelto porque el
 * error tiene que poder viajar **con** codigo de exito: una operacion puede
 * devolver `null`, `0` o una lista vacia, y con eso no hay forma de distinguirlas
 * de «no ha contestado».
 */
export interface IBridgeResponse<T = unknown> {
  ok: boolean;
  result?: T;
  error?: string;
}
/**
 * Saca el nombre de la operacion de la URL.
 *
 * La operacion va **en el path**, no en un parametro:
 * `/__dev-bridge__/keys/set-status` se lee de un vistazo, y `?op=exec` con un
 * `UPDATE` concatenado dentro no decia nada. Es justo lo que se queria: un
 * endpoint del que se sepa lo que hace sin abrir nada mas.
 *
 * Una ruta que no este bajo el prefijo devuelve `null` —no es nuestra— y una que
 * este pero sin nombre detras tambien, porque `/__dev-bridge__` a secas no es una
 * operacion. Fallar visiblemente es lo que hace que un nombre mal escrito se vea
 * en vez de ejecutarse como si fuera otro.
 */
export function operacionDe(url: string): string | null {
  if (!url.startsWith(`${DEV_BRIDGE_PATH}/`)) return null;

  const nombre = url.slice(DEV_BRIDGE_PATH.length + 1).split('?')[0] ?? '';

  return nombre.length > 0 ? nombre : null;
}
