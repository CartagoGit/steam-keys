/**
 * Barril de enums.
 * Importar siempre desde aqui: `@/contracts/enums` o `@/contracts`.
 *
 * Esta completo a proposito. Antes exportaba nueve de trece, y los que
 * faltaban obligaban a importarlos por ruta profunda: la regla de "los
 * contratos se importan desde el barril" no era cumplible ni comprobable
 * mientras el barril tuviese huecos. Un test lo comprueba.
 */

export { AppLocale, APP_LOCALE_VALUES, DEFAULT_LOCALE } from './app-locale.enum';
export { AppTheme, APP_THEME_VALUES, APP_THEME_SWATCHES } from './app-theme.enum';
export { AppView, APP_VIEW_VALUES, DEFAULT_VIEW } from './app-view.enum';

export { BackupReason, BACKUP_REASON_VALUES } from './backup-reason.enum';

export { KeyPlatform, KEY_PLATFORM_VALUES } from './key-platform.enum';
export { KeyStatus, KEY_STATUS_VALUES, GIFTABLE_STATUSES } from './key-status.enum';
export { KeySource } from './key-source.enum';
export { KeySort } from './key-sort.enum';

// `KeyKind` vive junto a `KeyScope` en el mismo fichero: los dos son filtros de
// la lista y se usan siempre de a uno.
export {
  KeyKind,
  KEY_KIND_VALUES,
  DEFAULT_KEY_KIND,
} from './key-scope.enum';
export {
  KeyScope,
  KEY_SCOPE_VALUES,
  DEFAULT_KEY_SCOPE,
} from './key-scope.enum';

export { ParsedKeyKind } from './parsed-key-kind.enum';
export { ParsedIssueReason } from './parsed-issue-reason.enum';
export { RestoreMode } from './restore-mode.enum';
export { StorageHealth } from './storage-health.enum';
export { StorageMode } from './storage-mode.enum';
