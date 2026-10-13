import { MemoryGameKeyRepository } from '@/repositories/memory-game-key.repository';
import { SqliteBackupRepository } from '@/repositories/sqlite-backup.repository';
import { SqliteGameKeyRepository } from '@/repositories/sqlite-game-key.repository';
import { SqliteSettingsRepository } from '@/repositories/sqlite-settings.repository';
import { getStorageMode, StorageMode } from '@/helpers/runtime.helper';
import type {
  IBackupRepository,
  IDatabaseClient,
  IGameKeyRepository,
  ISettingsRepository,
} from '@/contracts';

let instancia: IGameKeyRepository | null = null;
let modoRepositorio: StorageMode | null = null;

let ajustesInstancia: ISettingsRepository | null = null;
let modoAjustes: StorageMode | null = null;

let respaldosInstancia: IBackupRepository | null = null;
let modoRespaldos: StorageMode | null = null;

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
 *
 * ## En modo puente ya no hay cliente, y es lo que se buscaba
 *
 * El puente dejo de ser un tunnel de SQL: el navegador pide operaciones con
 * nombre y el servidor las ejecuta contra su propia conexion. Aqui ya no hay
 * sentencia que mandar, asi que este metodo **lanza**. Que lance y no devuelva
 * `null` en silencio es a proposito: cualquier codigo que llegue aqui estaba
 * escribiendo SQL a mano, que es justo lo que se elimino, y que se entere al
 * arrancar y no tres segundos despues en produccion.
 */
export async function getDatabaseClient(): Promise<IDatabaseClient> {
  const modo = getStorageMode();

  if (modo === StorageMode.DevBridge) {
    throw new Error(
      'En el puente de desarrollo no hay cliente de base de datos: se habla con ' +
        'el servidor por operaciones con nombre. Si algo llega aqui, esta ' +
        'escribiendo SQL a mano en vez de usar un repositorio.',
    );
  }

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
 * Devuelve el repositorio de claves adecuado al entorno.
 *
 * - **Tauri**: SQLite nativo, en disco.
 * - **Desarrollo** (`bun run dev`): el mismo SQLite, a traves del puente, para
 *   ver las mismas claves que la app de escritorio.
 * - **Build estatico**: repositorio en memoria sobre `localStorage`.
 *
 * Los tres cumplen `IGameKeyRepository` y la app no sabe cual tiene.
 *
 * ## Por que el puente ya no usa `SqliteGameKeyRepository`
 *
 * Ese repositorio compone el SQL y se lo pasa a un `IDatabaseClient`. Por el
 * puente ya no hay cliente al que pasarselo —no queda un solo `execute` en las
 * peticiones—, asi que el navegador usa su propio hermano, que solo nombra
 * operaciones. El SQL no se ha duplicado: el servidor del puente ejecuta
 * *este mismo* repositorio con `bun:sqlite`.
 */
export async function getRepository(): Promise<IGameKeyRepository> {
  const modo = getStorageMode();

  // El modo puede cambiar en caliente si el usuario recompila el front.
  if (instancia && modoRepositorio === modo) return instancia;

  modoRepositorio = modo;

  if (modo === StorageMode.DevBridge) {
    // Import dinamico: el puente no existe en el build de produccion, y su
    // modulo lo sustituye uno que lanza al usarlo.
    const { HttpGameKeyRepository } = await import(
      '@/repositories/http-game-key.repository'
    );

    instancia = new HttpGameKeyRepository();
  } else if (modo === StorageMode.Memory) {
    instancia = new MemoryGameKeyRepository();
  } else {
    instancia = new SqliteGameKeyRepository(await getDatabaseClient());
  }

  return instancia;
}

/**
 * Los ajustes del entorno actual.
 *
 * Mismo criterio que `getRepository()`, y por el mismo motivo: cada modo necesita
 * su motor, y el del puente habla por operaciones. Cacheados aparte porque el
 * modo puede cambiar en caliente igual que el otro.
 */
export async function getSettingsRepository(): Promise<ISettingsRepository> {
  const modo = getStorageMode();

  if (ajustesInstancia && modoAjustes === modo) return ajustesInstancia;

  modoAjustes = modo;

  if (modo === StorageMode.DevBridge) {
    const { HttpSettingsRepository } = await import(
      '@/repositories/http-settings.repository'
    );

    ajustesInstancia = new HttpSettingsRepository();
  } else {
    ajustesInstancia = new SqliteSettingsRepository(await getDatabaseClient());
  }

  return ajustesInstancia;
}

/** Las copias de seguridad del entorno actual. */
export async function getBackupRepository(): Promise<IBackupRepository> {
  const modo = getStorageMode();

  if (respaldosInstancia && modoRespaldos === modo) return respaldosInstancia;

  modoRespaldos = modo;

  if (modo === StorageMode.DevBridge) {
    const { HttpBackupRepository } = await import(
      '@/repositories/http-backup.repository'
    );

    respaldosInstancia = new HttpBackupRepository();
  } else {
    respaldosInstancia = new SqliteBackupRepository(await getDatabaseClient());
  }

  const instancia: IBackupRepository = respaldosInstancia;

  return instancia;
}

/** `true` si los datos viven en SQLite y no en `localStorage`. */
export function isPersistent(): boolean {
  return getStorageMode() !== StorageMode.Memory;
}

/**
 * Descarta las instancias cacheadas.
 *
 * Ttiene que limpiar **las cuatro**: el cliente, el repositorio de claves, los
 * ajustes y los respaldos. Con caches separadas, dejar solo una hacia que el
 * test siguiente cogiera una instancia de una ejecucion anterior y escribiera
 * en una base de datos que ya no era la suya.
 */
export function resetRepository(): void {
  instancia = null;
  modoRepositorio = null;
  ajustesInstancia = null;
  modoAjustes = null;
  respaldosInstancia = null;
  modoRespaldos = null;
  clientePromesa = null;
  modoCliente = null;
}