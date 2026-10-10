import { MemoryGameKeyRepository } from '@/repositories/memory-game-key.repository';
import { SqliteGameKeyRepository } from '@/repositories/sqlite-game-key.repository';
import { tauriDatabaseClient } from '@/services/tauri-database.service';
import { isTauri } from '@/helpers/runtime.helper';
import type { IGameKeyRepository } from '@/contracts/interfaces/database.interface';

let instance: IGameKeyRepository | null = null;

/**
 * Devuelve el repositorio adecuado al entorno.
 *
 * - Dentro de Tauri: SQLite real en el directorio de la app.
 * - En el navegador: repositorio en memoria sobre `localStorage`, para poder
 *   trabajar en la interfaz sin compilar Rust.
 */
export async function getRepository(): Promise<IGameKeyRepository> {
  if (instance) return instance;

  if (isTauri()) {
    const repository = new SqliteGameKeyRepository(tauriDatabaseClient);
    await tauriDatabaseClient.migrate();
    instance = repository;
    return instance;
  }

  instance = new MemoryGameKeyRepository();
  return instance;
}

/** `true` si los datos viven en SQLite y no en memoria. */
export function isPersistent(): boolean {
  return isTauri();
}