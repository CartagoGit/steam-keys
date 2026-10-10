import { MemoryGameKeyRepository } from '@/repositories/memory-game-key.repository';
import { SqliteGameKeyRepository } from '@/repositories/sqlite-game-key.repository';
import { tauriDatabaseClient } from '@/services/tauri-database.service';
import { getStorageMode, StorageMode } from '@/helpers/runtime.helper';
import type {
  IDatabaseClient,
  IGameKeyRepository,
} from '@/contracts/interfaces/database.interface';

let instancia: IGameKeyRepository | null = null;
let modoDetectado: StorageMode | null = null;

/**
 * Devuelve el repositorio adecuado al entorno.
 *
 * - **Tauri**: SQLite nativo, en disco.
 * - **Desarrollo** (`bun run dev`): SQLite real a traves del puente, para ver
 *   las mismas claves que la app de escritorio.
 * - **Build estatico**: repositorio en memoria sobre `localStorage`.
 *
 * En los dos primeros casos se reutiliza `SqliteGameKeyRepository`: el unico
 * codigo que escribe en la base de datos es el mismo en todos los entornos.
 */
export async function getRepository(): Promise<IGameKeyRepository> {
  const modo = getStorageMode();

  // El modo puede cambiar en caliente si el usuario recompila el front.
  if (instancia && modoDetectado === modo) return instancia;

  modoDetectado = modo;

  switch (modo) {
    case StorageMode.Tauri: {
      const repositorio = new SqliteGameKeyRepository(tauriDatabaseClient);
      await tauriDatabaseClient.migrate();
      instancia = repositorio;
      return instancia;
    }

    case StorageMode.DevBridge: {
      // Import dinamico: el puente no existe en el build de produccion.
      const { devBridgeDatabaseClient } = await import(
        '@/services/dev-bridge-database.service'
      );

      const cliente: IDatabaseClient = devBridgeDatabaseClient;
      await cliente.migrate();

      instancia = new SqliteGameKeyRepository(cliente);
      return instancia;
    }

    case StorageMode.Memory:
    default:
      instancia = new MemoryGameKeyRepository();
      return instancia;
  }
}

/** `true` si los datos viven en SQLite y no en `localStorage`. */
export function isPersistent(): boolean {
  return getStorageMode() !== StorageMode.Memory;
}

/** Descarta la instancia cacheada. Solo para tests. */
export function resetRepository(): void {
  instancia = null;
  modoDetectado = null;
}