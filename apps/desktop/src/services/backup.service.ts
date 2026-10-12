import { supportsBackups } from '@/helpers/runtime.helper';
import { BackupReason, KeyPlatform, RestoreMode, StorageHealth, TABLE_GAME_KEYS, type IBackup, type IDatabaseClient, type IRestoreSummary } from '@/contracts';
import { mergeKeysFromBackup, resumirRestauracion } from '@/helpers/merge-keys.helper';
import { backupRepository } from '@/repositories/backup.repository';

/**
 * Copias de seguridad y salud de la base de datos.
 *
   * Las copias viven **dentro** de la propia base de datos, en la tabla
   * `backups`, y por eso son SQL y no ficheros: de ahi que no haga falta ni un
   * comando de Rust para crearlas ni para leerlas, y que restaurarlas no sea
   * montar una segunda conexion SQLite sobre un temporal.
 *
   * La salud de la base de datos sigue siendo una pregunta para el motor, porque
   * `PRAGMA integrity_check` no tiene equivalente en el puente de desarrollo.
 */
export const backupService = {
  /**
   * `true` si se pueden crear y restaurar copias de seguridad.
   *
   * No es una pregunta para este servicio: la respuesta la da
   * `supportsBackups()`, que es donde se mira el modo de almacenamiento. Se
   * expone aqui solo porque de primeras habia dos y cada una decia una cosa —
   * esta decia "todo menos el navegador en memoria" y la otra "solo Tauri"—, y
   * la contradicted era la que dejo las copias apagadas en el puente.
   */
  available(): boolean {
    return supportsBackups();
  },

  /** Crea una copia de seguridad y la devuelve. */
  async create(db: IDatabaseClient, reason: BackupReason): Promise<IBackup> {
    return backupRepository.create(db, reason);
  },

  /** Copias existentes, de la mas reciente a la mas antigua. */
  async list(db: IDatabaseClient): Promise<readonly IBackup[]> {
    return backupRepository.list(db);
  },

  /** Borra una copia concreta. */
  async remove(db: IDatabaseClient, name: string): Promise<void> {
    await backupRepository.remove(db, name);
  },

  /**
   * Restaura una copia sin perder lo que ya hay.
   *
   * **Nunca borra.** Restaurar solo puede anadir claves o devolverlas a como
   * estaban. Antes la copia era un fichero `.db` aparte que habia que abrir con
   * su propia conexion; ahora es un JSON dentro de esta misma base de datos, y
   * se pasa tal cual a `mergeKeysFromBackup`.
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
    const filas = await backupRepository.rowsOf(db, name);

    return mergeKeysFromBackup(db, filas, mode);
  },

  /**
   * Dice cuanto haria una restauracion sin tocar la base.
   *
   * La misma cuenta que `restore`, pero sin escribir. Va aparte y no como un
   * parametro de la de verdad porque leer la copia no tiene el coste de
   * escribir: el dialogo puede pedirlo cada vez que se cambia de modo.
   */
  async previewRestore(
    db: IDatabaseClient,
    name: string,
    mode: RestoreMode,
  ): Promise<IRestoreSummary> {
    const filas = await backupRepository.rowsOf(db, name);

    return resumirRestauracion(db, filas, mode);
  },

  /**
   * Comprueba la integridad del fichero con `PRAGMA integrity_check`.
   *
   * Detecta corrupcion antes de que el usuario descubra que ha perdido claves.
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
      // 'ok' es lo que devuelve `PRAGMA integrity_check` de SQLite, no un valor
      // nuestro: no hay enum al que convertirlo, y meterlo seria traducir el
      // dialecto para luego no usar la traduccion.
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
      `SELECT COUNT(*) AS total FROM ${TABLE_GAME_KEYS} WHERE platform = $1`,
      [KeyPlatform.Unknown],
    );

    return filas[0]?.total ?? 0;
  },
};