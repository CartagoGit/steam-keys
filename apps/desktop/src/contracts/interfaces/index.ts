/** Barril de interfaces. Importar siempre desde aqui: `@/contracts/interfaces`. */

export type {
  IGameKey,
  IGameKeyDraft,
  IGameKeyInput,
} from './game-key.interface';

export type {
  IParseOptions,
  IParseResult,
  IParseStats,
  IParsedEntry,
  IParsedIssue,
  IParsedKeyToken,
} from './parsed-entry.interface';

export type { IKeyFilter, IKeyStats } from './key-filter.interface';

export type {
  IGameKeyRow,
  IImportRow,
  IImportSummary,
  IDatabaseOptions,
} from './import-summary.interface';

export type {
  IDatabaseClient,
  IGameKeyRepository,
} from './database.interface';

export type { IconName } from './icon-name.interface';

export type {
  IBackup,
  IRestoreSummary,
  IStorageInfo,
  IDatabaseInfo,
} from './backup.interface';