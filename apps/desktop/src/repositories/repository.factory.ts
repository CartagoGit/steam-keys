import { MemoryGameKeyRepository } from '@/repositories/memory-game-key.repository';
import { SqliteGameKeyRepository } from '@/repositories/sqlite-game-key.repository';
import { getStorageMode, StorageMode } from '@/helpers/runtime.helper';
import type { IDatabaseClient, IGameKeyRepository } from '@/contracts';

let instancia: IGameKeyRepository | null = null;
let modoRepositorio: StorageMode | null = null;

/**
 * El cliente, guardando la **promesa** y no el cliente ya resuelto.
 *
 * Es la diferencia entre que el esquema se despliegue una vez y cuatro. La
 * cache guardaba el valor, y hay un `await import()` en medio de la resolucion:
 * ese `await` devuelve el control a la cola de microtareas **siempre**, incluso
 * con el modulo ya cargado. Cuatro efectos del arranque llaman a esta funcion
 * en el mismo commit, los cuatro pasan la comprobacion de cache antes de que
 * nadie escriba en `clienteInstancia`, y cada uno construye su cliente y lanza
 * su `migrate()`.
 *
 * Se ve en el arranque del navegador: cuatro `CREATE TABLE IF NOT EXISTS
 * game_keys` identicos, uno detras de otro, en el mismo instante. Con la
 * promesa cacheada los cuatro reciben **la misma** y `migrate()` corre una vez.
 *
 * Y no es solo el arranque. `Promise.all` con dos operaciones de datos —leer
 * las claves y leer el catalogo de etiquetas— hace lo mismo en cualquier
 * momento, y a veces que el repositorio salga duplicado y las dos copias
 * escriban la misma fila.
 */
let clientePromesa: Promise<IDatabaseClient> | null = null;
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

  /*
   * En modo memoria no se cachea nada.
   *
   * El cliente de memoria guarda los ajustes en un closure, asi que cada
   * llamada crea uno nuevo con su propio almacen —que es lo que quiere el modo
   * memoria—. Cachearlo haria que dos llamadas compartieran estado y se
   * arreglaria un problema que no existe a costa de romper el que si.
   */
  if (modo === StorageMode.Memory) return crearCliente(modo);

  if (clientePromesa !== null && modoCliente === modo) return clientePromesa;

  modoCliente = modo;

  /*
   * Se guarda **antes** de esperar al import.
   *
   * `crearCliente` es `async` y lleva un `await import()` dentro; sin esto, el
   * segundo llamante —que sale en el mismo commit— llegaria aqui, veria
   * `clientePromesa` a `null` y crearia el suyo. Es la misma carrera de antes,
   * un nivel mas arriba, y por eso la asignacion va antes del `return`.
   */
  clientePromesa = crearCliente(modo);

  return clientePromesa;
}

/**
 * Construye el cliente del modo indicado y despliega el esquema.
 *
 * No cachea nada: de eso se encarga `getDatabaseClient`, que es quien sabe si la
 * peticion es la primera o una repetida.
 */
async function crearCliente(modo: StorageMode): Promise<IDatabaseClient> {
  let cliente: IDatabaseClient;

  switch (modo) {
    case StorageMode.Tauri: {
      /*
       * Import dinamico, como los otros dos modos, y no importacion fija.
       *
       * El cliente de Tauri arrastra `@tauri-apps/plugin-sql`, que solo
       * existe dentro de la ventana nativa. Con el import estatico, abrir la
       * interfaz en el navegador cargaba tambien el plugin de Tauri —para no
       * usar nunca— y `repositories/`, que solo puede mirar hacia abajo, tenia
       * una arista hacia `services/`. Ahora los tres modos se resuelven igual.
       */
      const { tauriDatabaseClient } = await import(
        '@/services/tauri-database.service'
      );

      cliente = tauriDatabaseClient;
      break;
    }

    case StorageMode.DevBridge: {
      // Import dinamico: el puente no existe en el build de produccion.
      const { devBridgeDatabaseClient } = await import(
        '@/services/dev-bridge-database.service'
      );

      cliente = devBridgeDatabaseClient;
      break;
    }

    case StorageMode.Memory:
    default: {
      const { memoryDatabaseClient } = await import(
        '@/repositories/memory-database.client'
      );

      cliente = memoryDatabaseClient();
      break;
    }
  }

  // La migracion solo cuando hay esquema que desplegar. En modo memoria el
  // cliente construye sus tablas al crearse y no tiene nada que migrar.
  if (modo !== StorageMode.Memory) await cliente.migrate();

  return cliente;
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
  clientePromesa = null;
  modoCliente = null;
}