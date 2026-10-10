import { invoke } from '@tauri-apps/api/core';
import SqliteDatabase from '@tauri-apps/plugin-sql';

import { isTauri } from '@/helpers/runtime.helper';
import { RestoreMode } from '@/contracts/enums/restore-mode.enum';
import { StorageHealth } from '@/contracts/enums/storage-health.enum';
import { KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { GAME_KEY_COLUMNS } from '@/helpers/map-row.helper';
import { mergeKeysFromBackup } from '@/helpers/merge-keys.helper';
import type { IDatabaseClient } from '@/contracts/interfaces/database.interface';
import type {
  IBackup,
  IRestoreSummary,
} from '@/contracts/interfaces/backup.interface';
import type { IGameKeyRow } from '@/contracts/interfaces/import-summary.interface';

/** Lo que devuelve el comando `list_backups` de Rust. */
interface IBackupRaw {
  name: string;
  path: string;
  size_bytes: number;
  created_at_ms: number;
}

/**
 * Copias de seguridad y salud de la base de datos.
 *
 * Solo funciona dentro de Tauri: en el navegador no hay ficheros que respaldar,
 * y `localStorage` ya se comporta como un almacen persistente.
 */
export const backupService = {
  /** `true` si hay un motor real sobre el que trabajar. */
  available(): boolean {
    return isTauri();
  },

  /** Crea una copia de seguridad y la devuelve. */
  async create(reason: string): Promise<IBackup> {
    const raw = await invoke<IBackupRaw>('create_backup', { reason });

    return {
      name: raw.name,
      path: raw.path,
      sizeBytes: raw.size_bytes,
      createdAtMs: raw.created_at_ms,
    };
  },

  /** Copias existentes, de la mas reciente a la mas antigua. */
  async list(): Promise<readonly IBackup[]> {
    const raw = await invoke<IBackupRaw[]>('list_backups');

    return raw.map((item) => ({
      name: item.name,
      path: item.path,
      sizeBytes: item.size_bytes,
      createdAtMs: item.created_at_ms,
    }));
  },

  /** Borra una copia concreta. */
  async remove(name: string): Promise<void> {
    await invoke('delete_backup', { name });
  },

  /**
   * Restaura una copia sin perder lo que ya hay.
   *
   * Nunca se copia el fichero encima de la base de datos viva: la app tiene la
   * conexion abierta y SQLite se quedaria con una referencia obsoleta. En su
   * lugar la copia se deposita como `restore-candidate.db`, se abre con su
   * propia conexion, se leen las filas y se fusionan en la base de datos real.
   *
   * @param name    Nombre de la copia.
   * @param mode    `fusionar` solo añade lo que falta; `sobrescribir` ademas
   *                actualiza el estado de las claves que ya existian.
   */
  async restore(
    db: IDatabaseClient,
    name: string,
    mode: RestoreMode,
  ): Promise<IRestoreSummary> {
    const connection = await invoke<string>('stage_backup', { name });

    try {
      const copia = await SqliteDatabase.load(connection);

      try {
        const filas = await copia.select<IGameKeyRow[]>(
          `SELECT ${GAME_KEY_COLUMNS} FROM game_keys`,
        );

        return await mergeKeysFromBackup(db, filas, mode);
      } finally {
        // Se cierra siempre: dejar conexiones abiertas bloquea el fichero.
        await copia.close().catch(() => undefined);
      }
    } finally {
      // La copia preparada se borra pase lo que pase.
      await invoke('discard_staged_backup').catch(() => undefined);
    }
  },

  /**
   * Comprueba la integridad del fichero con `PRAGMA integrity_check`.
   *
   * Detecta corrupcion antes de queyel usuario descubra que ha perdido claves.
   */
  async checkHealth(db: IDatabaseClient): Promise<{
    health: StorageHealth;
    detail: string | null;
  }> {
    try {
      const filas = await db.select<Record<string, string>>(
        'PRAGMA integrity_check(1)',
      );

      const resultado = filas[0]?.integrity_check;

      if (resultado === 'ok') {
        return { health: StorageHealth.Ok, detail: null };
      }

      return {
        health: StorageHealth.Degradado,
        detail:
          resultado ??
          'SQLite informo de un problema pero no devolvio detalle.',
      };
    } catch (cause) {
      return {
        health: StorageHealth.Desconocido,
        detail:
          cause instanceof Error
            ? cause.message
            : 'No se pudo comprobar la integridad.',
      };
    }
  },

  /** Cuenta las claves pendientes de revisar por plataforma. */
  async countUnknownPlatform(db: IDatabaseClient): Promise<number> {
    const filas = await db.select<{ total: number }>(
      'SELECT COUNT(*) AS total FROM game_keys WHERE platform = $1',
      [KeyPlatform.Unknown],
    );

    return filas[0]?.total ?? 0;
  },
};