import { DEV_BRIDGE_PATH, DEV_BRIDGE_TOKEN_HEADER } from '../../dev-bridge.contract';
import type { IBridgeResponse } from '../../dev-bridge.contract';
import type { BridgeArgs, BridgeOperationName, BridgeResult } from '@/contracts';

/**
 * Cliente del puente de desarrollo: el lado del navegador.
 *
 * ## Que se pide
 *
 * Una operacion con nombre, no una sentencia:
 *
 *   POST /__dev-bridge__/keys/set-status
 *   { "id": 1, "status": "Available" }
 *
 * Antes se mandaba `POST /__dev-bridge__/sql?op=exec` con el SQL dentro, y al
 * abrir las DevTools no habia forma de saber que hacia la peticion sin leer el
 * SQL concatenado a mano —que era ademas lo que el cliente habia compuesto, no
 * lo que el servidor—. Aqui la URL lo dice solo, y si algo falla el error
 * viene del servidor, que es donde esta escrito el SQL.
 *
 * ## Por que los repositorios HTTP son hermanos de los de SQLite
 *
 * `SqliteGameKeyRepository` habla SQL a traves de `IDatabaseClient`, y no puede
 * seguir siendo el mismo en el navegador: no hay forma de traducir un `UPDATE`
 * cualquiera a una operacion con nombre. Por eso el navegador usa otro
 * repositorio, igual que usa `MemoryGameKeyRepository` cuando no hay base de
 * datos. Los tres cumplen `IGameKeyRepository` y la app no sabe cual tiene.
 *
 * El coste de esto es cero SQL duplicado: el servidor del puente ejecuta *el
 * mismo* `SqliteGameKeyRepository` con un cliente de `bun:sqlite`.
 */

/** Token que inyecta el plugin de Vite al arrancar el servidor. */
declare const __STEAM_KEYS_DEV_TOKEN__: string | undefined;

function token(): string {
  return typeof __STEAM_KEYS_DEV_TOKEN__ === 'string'
    ? __STEAM_KEYS_DEV_TOKEN__
    : '';
}

/**
 * Error del puente, con la operacion que lo produjo.
 *
 * Sin el nombre, un error de SQLite en consola no dice si fue el cambio de
 * estado o el borrado: son el mismo `execute` por dentro.
 *
 * **No se exporta.** Nadie lo necesita para distinguirlo —lo que importa es el
 * mensaje, que ya lleva la operacion dentro—, y un `export` que no se importa
 * es una puerta mas por la que se puede cambiar un contrato sin que nadie se
 * entere.
 */
class BridgeError extends Error {
  constructor(
    readonly operacion: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'BridgeError';
  }
}

/**
 * Llama a una operacion del puente y devuelve lo que responde.
 *
 * `void` no se envia en el cuerpo: varias operaciones no aceptan nada, y
 * mandarle un `null` a un endpoint que no lo espera solo anade una rama mas
 * que puede fallar.
 */
export async function pedir<T extends BridgeOperationName>(
  operacion: T,
  ...[args]: BridgeArgs<T> extends void ? [] : [BridgeArgs<T>]
): Promise<BridgeResult<T>> {
  const url = `${DEV_BRIDGE_PATH}/${operacion}`;

  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [DEV_BRIDGE_TOKEN_HEADER]: token(),
    },
  };

  if (args !== undefined) init.body = JSON.stringify(args);

  const respuesta = await fetch(url, init);
  const datos = (await respuesta.json()) as IBridgeResponse<BridgeResult<T>>;

  if (!datos.ok) {
    throw new BridgeError(
      operacion,
      datos.error ?? `El puente de desarrollo fallo (${respuesta.status}).`,
    );
  }

  return datos.result as BridgeResult<T>;
}