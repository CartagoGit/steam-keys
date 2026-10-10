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
let clienteInstancia: IDatabaseClient | null = null;

/**
 * Cliente de base de datos del entorno actual.
 *
 * Lo expone el mismo factory que el repositorio a proposito: los ajustes y el
 * repositorio de claves tienen que hablar **con la misma conexion** contra la
 * misma base de datos. Si cada uno resolviera su cliente por su cuenta, en el
 * navegador de desarrollo uno acabaria en SQLite y el otro en `localStorage`,
 * y los ajustes se perderian al recargar.
 *
 * En modo memoria se devuelve un cliente en memoria nuevo cada vez, porque no
 * hay conexion que compartir: los ajustes se guardan alli tambien, para que la
 * app siga siendo usable en el navegador sin Tauri.
 */
export async function getDatabaseClient(): Promise<IDatabaseClient> {
  const modo = getStorageMode();

  if (clienteInstancia && modoDetectado === modo && modo !== StorageMode.Memory) {
    return clienteInstancia;
  }

  switch (modo) {
    case StorageMode.Tauri: {
      clienteInstancia = tauriDatabaseClient;
      await tauriDatabaseClient.migrate();
      return clienteInstancia;
    }

    case StorageMode.DevBridge: {
      const { devBridgeDatabaseClient } = await import(
        '@/services/dev-bridge-database.service'
      );

      clienteInstancia = devBridgeDatabaseClient;
      await devBridgeDatabaseClient.migrate();
      return clienteInstancia;
    }

    case StorageMode.Memory:
    default: {
      const { memoryDatabaseClient } = await import(
        '@/repositories/memory-database.client'
      );

      clienteInstancia = memoryDatabaseClient();
      return clienteInstancia;
    }
  }
}

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
      return repositorio;
    }

    case StorageMode.DevBridge: {
      // Import dinamico: el puente no existe en el build de produccion.
      const { devBridgeDatabaseClient } = await import(
        '@/services/dev-bridge-database.service'
      );

      const cliente: IDatabaseClient = devBridgeDatabaseClient;
      await cliente.migrate();

      const repositorio = new SqliteGameKeyRepository(cliente);
      instancia = repositorio;
      return repositorio;
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