import { DB_FILE_NAME, type IDatabaseClient } from '@/contracts';
import { crearEsquema } from '@/repositories/crear-esquema.repository';
import SqliteDatabase from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';

let connection: SqliteDatabase | null = null;
let connectionString = '';

/**
 * Cliente SQLite real, sobre el plugin de Tauri.
 *
 * La base de datos va **junto al ejecutable** (modo portable), asi que la ruta
 * se la pide a Rust en vez de suponerla. Antes era una cadena fija relativa
 * (`sqlite:steam-keys.db`) y el plugin la resolvia contra la carpeta de
 * configuracion del sistema; con el modo portable esa carpeta ya no es donde
 * estan los datos, y una ruta relativa abriria una base vacia al lado sin
 * querer — o, peor, crearia una segunda coleccion.
 *
 * El esquema se crea desde TypeScript con sentencias idempotentes, de modo que
 * no hay migraciones en Rust que se puedan quedar desincronizadas con este
 * mismo DDL.
 */
export const tauriDatabaseClient: IDatabaseClient = {
  async execute(sql, bind = []) {
    const db = await getConnection();
    const result = await db.execute(sql, bind as unknown[]);
    return result.rowsAffected;
  },

  // El plugin declara `select<T>(): Promise<T>`, mientras que nuestro contrato
  // es `select<T>(): Promise<T[]>`. Hay que pedir `T[]` explicitamente para que
  // los tipos no mientan sobre lo que devuelve.
  async select<T>(sql: string, bind: readonly unknown[] = []) {
    const db = await getConnection();
    return db.select<T[]>(sql, bind as unknown[]);
  },

  async migrate() {
    await crearEsquema(tauriDatabaseClient);
  },

  /**
   * `BEGIN` / `COMMIT` / `ROLLBACK` de verdad, sobre la conexion cacheada.
   *
   * Que el `ROLLBACK` salga aunque el error no sea de SQLite importa: si el
   * fallo es de la red o del plugin, la transaccion se queda abierta en el
   * servidor y todas las escrituras siguientes se amontonan sin confirmar.
   * Por eso el `finally` va por delante del `catch`.
   */
  async transaccion<T>(fn: () => Promise<T>): Promise<T> {
    const db = await getConnection();

    await db.execute('BEGIN');

    try {
      const valor = await fn();

      await db.execute('COMMIT');

      return valor;
    } catch (error) {
      try {
        await db.execute('ROLLBACK');
      } catch {
        // Si el propio `ROLLBACK` falla, la transaccion ya no existe: el error
        // que importa es el de dentro, no este.
      }

      throw error;
    }
  },

  async close() {
    if (!connection) return;

    // `close()` **sin argumentos cierra todos los pools del plugin**, no solo
    // el suyo: es la documentacion del propio `tauri-plugin-sql`. Si se abria
    // otra base en paralelo —como hace la migracion de las copias antiguas— y
    // esta cerraba sin decir cual, se llevaria por delante tambien la base
    // principal y a partir de ahi toda consulta fallaria. Por eso el nombre se
    // pasa siempre, y es la misma cadena con la que se abrio.
    await connection.close(connectionString);

    connection = null;
    connectionString = '';
  },
};

async function getConnection(): Promise<SqliteDatabase> {
  if (connection) return connection;

  const directorio = await invoke<string>('data_directory');

  // Se separan con `/` y no con el separador del sistema: el plugin parte la
  // cadena por el primer `:` y lo que venga detras lo pasa tal cual, y tanto
  // Windows como Linux aceptan la barra hacia delante en una ruta de fichero.
  connectionString = `sqlite:${directorio}/${DB_FILE_NAME}`;

  connection = await SqliteDatabase.load(connectionString);
  return connection;
}