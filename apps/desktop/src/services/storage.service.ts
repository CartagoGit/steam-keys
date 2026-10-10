import { BackupReason } from '@/contracts/enums/backup-reason.enum';
import { KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { RestoreMode } from '@/contracts/enums/restore-mode.enum';
import { StorageHealth } from '@/contracts/enums/storage-health.enum';
import { backupService } from '@/services/backup.service';
import { fileService } from '@/services/file.service';
import { gameKeyService } from '@/services/game-key.service';
import { getRepository, isPersistent } from '@/repositories/repository.factory';
import { tauriDatabaseClient } from '@/services/tauri-database.service';
import type {
  IBackup,
  IRestoreSummary,
  IStorageInfo,
} from '@/contracts/interfaces/backup.interface';

/**
 * Fachada de almacenamiento: donde viven los datos, si estan sanos y como
 * recuperarlos.
 *
 * La UI de datos no habla ni con Rust ni con SQL: solo con esta clase.
 */
export const storageService = {
  /** `true` si los datos sobreviven a cerrar la app. */
  persistent(): boolean {
    return isPersistent();
  },

  /** Estado completo: ruta, tamaño, número de claves, salud y copias. */
  async info(): Promise<IStorageInfo> {
    const repository = await getRepository();
    const keys = await repository.listAll();

    const info = await fileService.databaseInfo();
    const persistente = isPersistent();

    // La comprobacion de integridad solo tiene sentido en SQLite: el
    // repositorio en memoria no tiene fichero que pueda estar corrupto.
    if (!persistente) {
      return {
        databasePath: null,
        persistent: false,
        databaseSizeBytes: 0,
        totalKeys: keys.length,
        unknownPlatform: keys.filter((key) => key.platform === KeyPlatform.Unknown).length,
        backups: [],
        health: StorageHealth.Desconocido,
        healthDetail:
          'Vista previa en navegador: los datos viven en localStorage, no en SQLite.',
      };
    }

    const [salud, unknownPlatform, backups] = await Promise.all([
      backupService.checkHealth(tauriDatabaseClient),
      backupService.countUnknownPlatform(tauriDatabaseClient),
      backupService.list().catch(() => [] as readonly IBackup[]),
    ]);

    return {
      databasePath: info?.path ?? null,
      persistent: true,
      databaseSizeBytes: info?.sizeBytes ?? 0,
      totalKeys: keys.length,
      unknownPlatform,
      backups,
      health: salud.health,
      healthDetail: salud.detail,
    };
  },

  /** Crea una copia de seguridad a peticion del usuario. */
  async backupNow(reason: BackupReason = BackupReason.Manual): Promise<IBackup> {
    return backupService.create(reason);
  },

  /** Copias de seguridad disponibles. */
  listBackups(): Promise<readonly IBackup[]> {
    return backupService.list();
  },

  /** Elimina una copia concreta. */
  async deleteBackup(name: string): Promise<void> {
    await backupService.remove(name);
  },

  /**
   * Restaura una copia.
   *
   * Antes de tocar nada se crea una copia del estado actual, para que un
   * restore equivocado tambien se pueda deshacer.
   */
  async restore(name: string, mode: RestoreMode): Promise<IRestoreSummary> {
    if (!isPersistent()) {
      throw new Error(
        'Las copias de seguridad solo existen en la app de escritorio. ' +
          'Abre la app nativa para restaurar.',
      );
    }

    await backupService.create(BackupReason.AntesDeRestaurar);

    return backupService.restore(tauriDatabaseClient, name, mode);
  },

  /**
   * Lee un TXT y lo deja preparado, sin escribir nada.
   *
   * El contenido se devuelve al usuario para que lo confirme: asi el dialogo
   * de ficheros se abre **una sola vez** y lo que se previsualiza es
   * exactamente lo que se importa.
   */
  async stageTxt(): Promise<string | null> {
    return fileService.pickTextFile();
  },

  /** Previsualiza lo que se importaria de un TXT ya leido. */
  async previewImport(contents: string) {
    return gameKeyService.importTxt(contents, true);
  },

  /** Importa de verdad el TXT ya leido. */
  async commitImport(contents: string) {
    if (isPersistent()) {
      await backupService.create(BackupReason.AntesDeImportar);
    }

    return gameKeyService.importTxt(contents, false);
  },
};