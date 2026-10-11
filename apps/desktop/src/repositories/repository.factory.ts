import { MemoryGameKeyRepository } from '@/repositories/memory-game-key.repository';
import { SqliteGameKeyRepository } from '@/repositories/sqlite-game-key.repository';
import { tauriDatabaseClient } from '@/services/tauri-database.service';
import { getStorageMode, StorageMode } from '@/helpers/runtime.helper';
import type { IDatabaseClient, IGameKeyRepository } from '@/contracts';

let instancia: IGameKeyRepository | null = null;
let modoRepositorio: StorageMode | null = null;

let clienteInstancia: IDatabaseClient | null = null;
let modoCliente: StorageMode | null = null;

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
 *
 * `modoCliente` lleva su propio modo en vez de compartir el de `getRepository()`:
 * cada cache responde a lo suyo. Antes de tenerlos separados,
 * `getDatabaseClient()` arrancaba con su variable a `null` porque solo
 * `getRepository()` la escribia, asi que no reutilizaba nunca su cliente.
 */
export async function getDatabaseClient(): Promise<IDatabaseClient> {
  const modo = getStorageMode();

  if (clienteInstancia && modoCliente === modo && modo !== StorageMode.Memory) {
    return clienteInstancia;
  }

  switch (modo) {
    case StorageMode.Tauri: {
      clienteInstancia = tauriDatabaseClient;
      break;
    }

    case StorageMode.DevBridge: {
      // Import dinamico: el puente no existe en el build de produccion.
      const { devBridgeDatabaseClient } = await import(
        '@/services/dev-bridge-database.service'
      );

      clienteInstancia = devBridgeDatabaseClient;
      break;
    }

    case StorageMode.Memory:
    default: {
      const { memoryDatabaseClient } = await import(
        '@/repositories/memory-database.client'
      );

      clienteInstancia = memoryDatabaseClient();
      break;
    }
  }

  modoCliente = modo;

  // La migracion solo cuando hay esquema que desplegar. En modo memoria el
  // cliente construye sus tablas al crearse y no tiene nada que migrar.
  if (modo !== StorageMode.Memory) await clienteInstancia.migrate();

  return clienteInstancia;
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
  if (instancia && modoRepositorio === modo) return instancia;

  modoRepositorio = modo;

  // Tauri y puente de desarrollo usan el mismo repositorio sobre SQLite; lo
  // unico que cambia es de donde sale el cliente, y eso lo decide
  // `getDatabaseClient()`. Resolverlo aqui otra vez —como hacia este codigo
  // con `tauriDatabaseClient` fijo— abria dos caminos paralelos: los ajustes
  // iban por `getDatabaseClient()` y las claves por aqui, y en el navegador de
  // desarrollo acababan en bases distintas al recargar la pagina.
  instancia =
    modo === StorageMode.Memory
      ? new MemoryGameKeyRepository()
      : new SqliteGameKeyRepository(await getDatabaseClient());

  return instancia;
}

/** `true` si los datos viven en SQLite y no en `localStorage`. */
export function isPersistent(): boolean {
  return getStorageMode() !== StorageMode.Memory;
}

/**
 * Descarta las instancias cacheadas.
 *
 * Ttiene que limpiar el cliente **y** el repositorio: con dos caches
 * separadas, deixar solo el repositorio hacia que el test siguiente cogiera un
 * cliente de una ejecucion anterior y escribiera en una base de datos que ya
 * no era la suya.
 */
export function resetRepository(): void {
  instancia = null;
  modoRepositorio = null;
  clienteInstancia = null;
  modoCliente = null;
}