import {
  KeyPlatform,
  TABLE_BACKUPS,
  TABLE_GAME_KEYS,
  StorageHealth,
  type BackupReason,
  type IBackup,
  type IBackupRepository,
  type IDatabaseClient,
  type IGameKeyRow,
  type IRestoreSummary,
  type RestoreMode,
} from '@/contracts';
import { mergeKeysFromBackup, resumirRestauracion } from '@/helpers/merge-keys.helper';
import { backupRepository } from '@/repositories/backup.repository';

/**
 * Copias de seguridad sobre SQL.
 *
 * No escribe ninguna sentencia propia: envuelve lo que ya hacen
 * `backupRepository` y `mergeKeysFromBackup`, y lo unico que añade es el
 * cliente. La clase existe para que el servicio pueda recibirlo por parametro
 * en vez de resolverlo con `getDatabaseClient()` por su cuenta —que es lo que
 * hacia imposible saber, al mirar el trafico de la app, que parte va al
 * puente—.
 *
 * Sirve para los dos motores que hablan sentencias: el plugin de Tauri y el
 * cliente en memoria del navegador.
 */
export class SqliteBackupRepository implements IBackupRepository {
  constructor(private readonly db: IDatabaseClient) {}

  create(reason: BackupReason): Promise<IBackup> {
    return backupRepository.create(this.db, reason);
  }

  list(): Promise<readonly IBackup[]> {
    return backupRepository.list(this.db);
  }

  async remove(name: string): Promise<void> {
    await backupRepository.remove(this.db, name);
  }

  restore(name: string, mode: RestoreMode): Promise<IRestoreSummary> {
    return backupRepository
      .rowsOf(this.db, name)
      .then((filas) => mergeKeysFromBackup(this.db, filas, mode));
  }

  previewRestore(name: string, mode: RestoreMode): Promise<IRestoreSummary> {
    return backupRepository
      .rowsOf(this.db, name)
      .then((filas) => resumirRestauracion(this.db, filas, mode));
  }

  /**
   * `PRAGMA integrity_check`, que solo SQLite entiende.
   *
   * Detecta corrupcion antes de que el usuario descubra que ha perdido claves.
   * Si la consulta falla —que es lo que pasa si el motor de debajo no es
   * SQLite— no se lanza: la salud se queda en «desconocido» con el motivo, que
   * es justo lo que hay que poder ensenar cuando algo va mal.
   */
  async checkHealth(): Promise<{
    health: StorageHealth;
    detail: string | null;
  }> {
    try {
      const filas = await this.db.select<Record<string, string>>(
        'PRAGMA integrity_check(1)',
      );

      const resultado = filas[0]?.integrity_check;

      if (resultado === 'ok') {
        // 'ok' es lo que devuelve `PRAGMA integrity_check` de SQLite, no un
        // valor nuestro: no hay enum al que convertirlo, y meterlo seria
        // traducir el dialecto para luego no usar la traduccion.
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
  }

  async countUnknownPlatform(): Promise<number> {
    const filas = await this.db.select<{ total: number }>(
      `SELECT COUNT(*) AS total FROM ${TABLE_GAME_KEYS} WHERE platform = $1`,
      [KeyPlatform.Unknown],
    );

    return filas[0]?.total ?? 0;
  }

  async importExternal(
    nombre: string,
    reason: BackupReason,
    filas: readonly IGameKeyRow[],
  ): Promise<void> {
    await this.db.execute(
      `INSERT OR IGNORE INTO ${TABLE_BACKUPS} (nombre, reason, creado_ms, contenido)
       VALUES ($1, $2, $3, $4)`,
      [
        nombre,
        reason,
        Date.now(),
        JSON.stringify({ rowCount: filas.length, rows: filas }),
      ],
    );
  }
}