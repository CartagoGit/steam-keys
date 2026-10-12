import { BackupReason, KeyPlatform, RestoreMode, StorageHealth, type IBackup, type IRestoreSummary, type IStorageInfo } from '@/contracts';
import { backupService } from '@/services/backup.service';
import { fileService } from '@/services/file.service';
import { gameKeyService } from '@/services/game-key.service';
import {
  isPersistent,
  supportsBackups,
} from '@/helpers/runtime.helper';
import { getDatabaseClient, getRepository } from '@/repositories/repository.factory';

/**
 * Fachada de almacenamiento: donde viven los datos, si estan sanos y como
 * recuperarlos.
 *
 * La UI de datos no habla ni con Rust ni con SQL: solo con esta clase.
 *
 * **El cliente se pide siempre al factory**, nunca se usa
 * `tauriDatabaseClient` aqui. Eso no era un descuido cuando solo existia Tauri,
 * pero al abrirse las copias al puente de desarrollo se volvio un fallo de
 * verdad: en `bun run dev` estas llamadas habrian escrito sobre el motor de
 * Tauri —que en el navegador no existe— en vez de sobre la base de descarte.
 * El factory existe justamente para que los ajustes y el repositorio hablen
 * **con la misma conexion**, y esta fachada es parte de ese club.
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
    const cliente = await getDatabaseClient();

    const info = await fileService.databaseInfo();
    const persistente = isPersistent();

    // Las copias y el recuento son SQL contra la tabla, asi que valen en
    // cualquier sitio con un motor de verdad. Lo que sigue siendo de Tauri es
    // la *ruta* del fichero —`fileService.databaseInfo()`—, que no tiene
    // equivalente en el puente.
    if (!supportsBackups()) {
      return {
        databasePath: persistente ? info?.path ?? null : null,
        persistent: persistente,
        portable: false,
        databaseSizeBytes: persistente ? (info?.sizeBytes ?? 0) : 0,
        totalKeys: keys.length,
        unknownPlatform: keys.filter((key) => key.platform === KeyPlatform.Unknown).length,
        backups: [],
        health: persistente ? StorageHealth.Desconocido : StorageHealth.Desconocido,
        healthDetail: persistente
          ? null
          : 'Vista previa en navegador: los datos viven en localStorage, no en SQLite.',
      };
    }

    const [salud, unknownPlatform, backups] = await Promise.all([
      backupService.checkHealth(cliente),
      backupService.countUnknownPlatform(cliente),
      backupService.list(cliente).catch(() => [] as readonly IBackup[]),
    ]);

    return {
      databasePath: info?.path ?? null,
      persistent: true,
      portable: info?.portable ?? false,
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
    return backupService.create(await getDatabaseClient(), reason);
  },

  /** Copias de seguridad disponibles. */
  async listBackups(): Promise<readonly IBackup[]> {
    return backupService.list(await getDatabaseClient());
  },

  /** Elimina una copia concreta. */
  async deleteBackup(name: string): Promise<void> {
    await backupService.remove(await getDatabaseClient(), name);
  },

  /**
   * Restaura una copia.
   *
   * Antes de tocar nada se crea una copia del estado actual, para que un
   * restore equivocado tambien se pueda deshacer.
   */
  async restore(name: string, mode: RestoreMode): Promise<IRestoreSummary> {
    if (!supportsBackups()) {
      throw new Error(
        'Las copias de seguridad necesitan una base de datos de verdad. ' +
          'Aqui no hay ninguna.',
      );
    }

    const cliente = await getDatabaseClient();

    await backupService.create(cliente, BackupReason.AntesDeRestaurar);

    return backupService.restore(cliente, name, mode);
  },

  /**
   * Cuenta lo que haria `restore` sin escribir nada.
   *
   * Va antes del dialogo de confirmacion para poder decir «entran 12 y se
   * actualizan 3» con los numeros en la mano. La copia del estado actual que
   * crea `restore` **no** se hace aqui: esto es una pregunta, no una accion, y
   * no deberia dejar rastro cada vez que se abre el dialogo.
   */
  async previewRestore(name: string, mode: RestoreMode): Promise<IRestoreSummary> {
    if (!supportsBackups()) return { total: 0, inserted: 0, skipped: 0, updated: 0 };

    return backupService.previewRestore(await getDatabaseClient(), name, mode);
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
    if (supportsBackups()) {
      await backupService.create(await getDatabaseClient(), BackupReason.AntesDeImportar);
    }

    return gameKeyService.importTxt(contents, false);
  },
};