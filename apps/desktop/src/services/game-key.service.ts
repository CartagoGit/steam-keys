import { getRepository, isPersistent } from '@/repositories/repository.factory';
import { parseLegacyTxt } from '@/helpers/parse-legacy-txt.helper';
import { exportKeysToLegacyTxt } from '@/helpers/export-legacy-txt.helper';
import { serializeTags } from '@/helpers/normalize-text.helper';
import { KeySource } from '@/contracts/enums/key-source.enum';
import { fileService } from '@/services/file.service';
import { EXPORT_FILE_NAME } from '@/contracts/constants/app.constants';
import type { IGameKeyRepository } from '@/contracts/interfaces/database.interface';
import type {
  IGameKey,
  IGameKeyDraft,
  IGameKeyInput,
} from '@/contracts/interfaces/game-key.interface';
import type {
  IImportRow,
  IImportSummary,
} from '@/contracts/interfaces/import-summary.interface';

/**
 * Fachada de la aplicacion: todo lo que la UI necesita hacer con las keys.
 *
 * Los componentes no conocen ni el repositorio ni el formato del TXT: hablar
 * con esta clase es la unica forma de tocar datos.
 */
export const gameKeyService = {
  /** Carga la coleccion completa. */
  async list(): Promise<readonly IGameKey[]> {
    const repository = await getRepository();
    return repository.listAll();
  },

  async create(input: IGameKeyInput): Promise<IGameKey> {
    const repository = await getRepository();
    return repository.insert(input);
  },

  async update(id: number, draft: IGameKeyDraft): Promise<IGameKey> {
    const repository = await getRepository();
    return repository.update(id, draft);
  },

  async remove(id: number): Promise<void> {
    const repository = await getRepository();
    await repository.remove(id);
  },

  async setStatus(id: number, status: IGameKey['status']): Promise<void> {
    const repository = await getRepository();
    await repository.setStatus(id, status);
  },

  async markUsed(id: number): Promise<void> {
    const repository = await getRepository();
    await repository.markUsed(id);
  },

  /** Parsea el TXT y devuelve el numero de claves listas para insertar. */
  async analyzeTxt(contents: string): Promise<number> {
    const repository = await getRepository();
    const existing = await repository.listKeyValues();

    return parseLegacyTxt(contents, { existingKeys: existing }).entries.length;
  },

  /**
   * Importa el contenido de un TXT.
   *
   * `dryRun` calcula lo que pasaria sin escribir nada: es el modo por defecto
   * cuando se pulsa "Importar", para no tocar la base de datos sin confirmar.
   */
  async importTxt(contents: string, dryRun = true): Promise<IImportSummary> {
    const repository = await getRepository();
    const existing = await repository.listKeyValues();

    const parsed = parseLegacyTxt(contents, { existingKeys: existing });
    const rows: readonly IImportRow[] = parsed.entries.map((entry) => ({
      title: entry.title,
      keyValue: entry.keyValue,
      platform: entry.platform,
      status: entry.status,
      source: KeySource.LegacyTxt,
      giftedTo: entry.giftedTo,
      parentTitle: entry.parentTitle,
      note: entry.note,
      tags: serializeTags(entry.tags),
      addedOn: entry.addedOn,
    }));

    if (dryRun) {
      return {
        inserted: 0,
        skipped: rows.length,
        duplicates: parsed.stats.duplicates,
        gifted: parsed.stats.gifted,
        available: parsed.stats.available,
        issues: parsed.issues.length,
        alreadyInDb: 0,
      };
    }

    const summary = await repository.importRows(rows);
    return { ...summary, issues: parsed.issues.length };
  },

  /** Abre el dialogo nativo, importa y devuelve el resumen. */
  async importFromDialog(dryRun: boolean): Promise<IImportSummary | null> {
    const contents = await fileService.pickTextFile();
    if (contents === null) return null;

    return gameKeyService.importTxt(contents, dryRun);
  },

  /** Escribe la coleccion en un TXT usando el dialogo nativo de guardado. */
  async exportToDialog(): Promise<{ path: string; total: number } | null> {
    const keys = await gameKeyService.list();
    const contents = exportKeysToLegacyTxt(keys);
    const path = await fileService.saveTextFile(EXPORT_FILE_NAME, contents);

    if (!path) return null;

    return { path, total: keys.length };
  },

  /** Ruta del fichero de base de datos, para el panel de ajustes. */
  databasePath(): Promise<string | null> {
    return fileService.databasePath();
  },

  isPersistent,

  async repository(): Promise<IGameKeyRepository> {
    return getRepository();
  },
};