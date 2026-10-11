import type {
  IGameKey,
  IGameKeyDraft,
  IGameKeyInput,
} from './game-key.interface';
import type { IImportRow, IImportSummary } from './import-summary.interface';
import type { KeyStatus } from '../enums/key-status.enum';

/**
 * Contrato minimo que debe cumplir cualquier motor de persistencia.
 * La app real usa SQLite (plugin de Tauri); el navegador usa el adaptador en
 * memoria, de modo que la UI se puede desarrollar sin compilar Rust.
 */
export interface IDatabaseClient {
  /** Ejecuta una sentencia de escritura y devuelve el numero de filas afectadas. */
  execute(sql: string, bind?: readonly unknown[]): Promise<number>;
  /** Ejecuta una consulta y devuelve filas crudas. */
  select<T>(sql: string, bind?: readonly unknown[]): Promise<T[]>;
  /** Crea el esquema si falta. Es idempotente. */
  migrate(): Promise<void>;
  /** Cierra la conexion si procede. */
  close(): Promise<void>;
}

/** Contrato del repositorio de keys. Toda la UI habla con esta interfaz. */
export interface IGameKeyRepository {
  listAll(): Promise<readonly IGameKey[]>;
  getById(id: number): Promise<IGameKey | null>;
  insert(input: IGameKeyInput): Promise<IGameKey>;
  update(id: number, draft: IGameKeyDraft): Promise<IGameKey>;
  remove(id: number): Promise<void>;
  removeMany(ids: readonly number[]): Promise<void>;
  setStatus(id: number, status: KeyStatus): Promise<void>;
  /** Cambia el estado de varias claves a la vez, en una sola operacion. */
  setStatusMany(ids: readonly number[], status: KeyStatus): Promise<void>;
  /** Cambia las etiquetas de varias claves a la vez, en una sola operacion. */
  setTagsMany(ids: readonly number[], tags: readonly string[]): Promise<void>;
  /** Marca varias claves como regaladas, guardando para quien fue cada una. */
  giftMany(entries: readonly { id: number; giftedTo: string }[]): Promise<void>;
  markUsed(id: number, usedAt?: string): Promise<void>;
  findByKey(keyValue: string): Promise<IGameKey | null>;
  countAll(): Promise<number>;
  /** Insercion masiva en transaccion, ignorando claves ya presentes. */
  importRows(rows: readonly IImportRow[]): Promise<IImportSummary>;
  /** Todas las claves existentes, para deduplicar antes de importar. */
  listKeyValues(): Promise<readonly string[]>;
}