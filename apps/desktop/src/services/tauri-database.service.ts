import { SCHEMA_STATEMENTS } from '@/contracts/constants/db-schema.constants';
import { DB_CONNECTION } from '@/contracts/constants/app.constants';
import type { IDatabaseClient } from '@/contracts/interfaces/database.interface';
import SqliteDatabase from '@tauri-apps/plugin-sql';

let connection: SqliteDatabase | null = null;

/**
 * Cliente SQLite real, sobre el plugin de Tauri.
 *
 * La base de datos vive en el directorio de configuracion de la app (fuera del
 * repositorio). El esquema se crea desde TypeScript con sentencias
 * idempotentes, de modo que no hay migraciones en Rust que se puedan quedar
 * desincronizadas con este mismo DDL.
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
    const db = await getConnection();
    for (const statement of SCHEMA_STATEMENTS) {
      await db.execute(statement);
    }
  },

  async close() {
    if (!connection) return;
    await connection.close();
    connection = null;
  },
};

async function getConnection(): Promise<SqliteDatabase> {
  if (connection) return connection;

  connection = await SqliteDatabase.load(DB_CONNECTION);
  return connection;
}