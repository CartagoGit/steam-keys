import { DEV_BRIDGE_PATH, DEV_BRIDGE_TOKEN_HEADER } from '../../dev-bridge.contract';
import { SCHEMA_STATEMENTS, type IDatabaseClient } from '@/contracts';
import type { BridgeOperation, IBridgeResponse } from '../../dev-bridge.contract';

/**
 * Cliente de base de datos que habla con el puente de desarrollo.
 *
 * Implementa el mismo `IDatabaseClient` que el plugin nativo de Tauri, de
 * forma que `SqliteGameKeyRepository` funciona igual en los dos entornos y el
 * unico codigo que escribe en la base de datos sigue siendo el mismo.
 *
 * Solo se usa con `bun run dev`. En el build de produccion el endpoint no
 * existe y el modulo ni siquiera se carga (se importa en dinamico).
 */

/** Token que inyecta el plugin de Vite al arrancar el servidor. */
declare const __STEAM_KEYS_DEV_TOKEN__: string | undefined;

function token(): string {
  return typeof __STEAM_KEYS_DEV_TOKEN__ === 'string'
    ? __STEAM_KEYS_DEV_TOKEN__
    : '';
}

/** Envia una peticion al puente. */
async function pedir(
  op: BridgeOperation,
  cuerpo: { sql: string; binds?: unknown[] },
): Promise<IBridgeResponse> {
  const respuesta = await fetch(`${DEV_BRIDGE_PATH}?op=${op}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [DEV_BRIDGE_TOKEN_HEADER]: token(),
    },
    body: JSON.stringify(cuerpo),
  });

  const datos = (await respuesta.json()) as IBridgeResponse;

  if (!datos.ok) {
    throw new Error(datos.error ?? `El puente de desarrollo fallo (${respuesta.status}).`);
  }

  return datos;
}

export const devBridgeDatabaseClient: IDatabaseClient = {
  async execute(sql, bind = []) {
    const datos = await pedir('exec', { sql, binds: [...bind] });
    return datos.rowsAffected ?? 0;
  },

  async select<T>(sql: string, bind: readonly unknown[] = []) {
    const datos = await pedir('select', { sql, binds: [...bind] });
    return (datos.rows ?? []) as T[];
  },

  async migrate() {
    for (const sentencia of SCHEMA_STATEMENTS) {
      await devBridgeDatabaseClient.execute(sentencia);
    }
  },

  /**
   * Las tres sentencias van por el puente, una a una.
   *
   * Depende de que el puente mantenga la conexion entre peticiones; si las
   * abriera por llamada, el `ROLLBACK` se ejecutaria sobre otra base y el
   * `BEGIN` se quedaria colgado bloqueando la escritura. Es el mismo requisito
   * que el resto del contrato: una transaccion solo es una transaccion si las
   * tres frases van a la misma conexion.
   */
  async transaccion<T>(fn: () => Promise<T>): Promise<T> {
    await devBridgeDatabaseClient.execute('BEGIN');

    try {
      const valor = await fn();

      await devBridgeDatabaseClient.execute('COMMIT');

      return valor;
    } catch (error) {
      await devBridgeDatabaseClient.execute('ROLLBACK').catch(() => undefined);

      throw error;
    }
  },

  async close() {
    // El puente no mantiene conexiones: cada peticion abre y cierra la suya.
  },
};
