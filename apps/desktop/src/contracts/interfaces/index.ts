/**
 * Barril de interfaces. Importar siempre desde aqui: `@/contracts/interfaces`.
 *
 * Esta completo a proposito, por lo mismo que el de enums: si le faltan tipos,
 * la unica forma de traerlos es por ruta profunda y la regla de un solo punto
 * de entrada deja de valer. Un test lo comprueba.
 */

export type { IAppSettings, AppSettingKey, ISettingRow } from './app-settings.interface';

export type {
  IBackup,
  IDatabaseInfo,
  IRestoreSummary,
  IStorageInfo,
} from './backup.interface';

export type {
  IDatabaseClient,
  IGameKeyRepository,
} from './database.interface';

export type {
  IGameKey,
  IGameKeyDraft,
  IGameKeyInput,
} from './game-key.interface';

export type { IconName } from './icon-name.interface';
export type { IMetaOption } from './meta-option.interface';
export type { ITag, ITagRow } from './tag.interface';

export type {
  IGameKeyRow,
  IImportRow,
  IImportSummary,
  IDatabaseOptions,
} from './import-summary.interface';

export type { IKeyFilter, IKeyStats } from './key-filter.interface';

export type {
  IParseOptions,
  IParseResult,
  IParseStats,
  IParsedEntry,
  IParsedIssue,
  IParsedKeyToken,
} from './parsed-entry.interface';

export type {
  DatabaseState,
  IStartup,
} from './startup.interface';

export type {
  IAppMatch,
  IResolvedKey,
  ISteamOwnedGame,
  ISteamOwnedGames,
  ISteamStoreApp,
  MatchConfidence,
  SteamAccountStatus,
} from './steam-account.interface';
