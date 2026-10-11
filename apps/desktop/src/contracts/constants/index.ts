/**
 * Barril de constantes. Importar siempre desde aqui: `@/contracts/constants`.
 *
 * Esta completo a proposito. Cuando le faltaba la mitad, el unico modo de
 * importar esas cosas era por ruta profunda, y quedo asi la regla de "los
 * contratos se importan desde el barril", que decia lo contrario de lo que
 * hacia el codigo. Un barril al que hay que salirse a mitad no guia a nadie.
 */

export {
  APP_IDENTIFIER,
  APP_NAME,
  DB_FILE_NAME,
  EXPORT_FILE_NAME,
  GRID_MIN_WIDTH_PX,
  MASK_VISIBLE_CHARS,
  PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
  SEARCH_SHORTCUT,
  STEAM_API_KEY_URL,
  STORAGE_KEY_PREFIX,
} from './app.constants';

export { KEY_PLATFORM_META, platformLabel } from './key-platform.constants';
export type { IPlatformMeta } from './key-platform.constants';

export { KEY_STATUS_META, statusMeta } from './key-status.constants';
export type { IStatusMeta, IStatusMetaResuelta } from './key-status.constants';

export {
  GAME_KEY_COLUMNS,
  GAME_KEY_INSERT_SIZE,
  GAME_KEY_WRITE_COLUMNS,
  MAX_BACKUPS,
  SCHEMA_STATEMENTS,
  SEARCHABLE_COLUMNS,
  TABLE_APP_SETTINGS,
  TABLE_BACKUPS,
  TABLE_GAME_KEYS,
} from './db-schema.constants';

export { EN, ES, TRANSLATIONS } from './i18n.constants';
export type {
  TranslationArgs,
  TranslationKey,
  TranslationTable,
  Translator,
} from './i18n.constants';

export {
  LOCALE_BCP47,
  LOCALE_FLAG_SIZE,
  LOCALE_META,
  THEME_LABELS,
} from './locale.constants';

export {
  ORIGIN_TAGS,
  PLATFORM_TAGS,
  cleanTag,
  mergeTags,
  normalizeTag,
  platformTags,
  removeTags,
  suggestionsFor,
} from './tag.constants';

export {
  ACTIVATE_NOTE_PATTERN,
  ALPHANUMERIC_KEY_PATTERN,
  ANNOTATION_SEPARATOR,
  BATTLENET_KEY_PATTERN,
  BLOCK_CLOSE_PATTERN,
  BLOCK_OPEN_PATTERN,
  DATE_HEADER_PATTERN,
  DECORATIVE_PATTERN,
  GIFT_MARKER_PATTERN,
  GIVEAWAY_END_PATTERN,
  GIVEAWAY_START_PATTERN,
  GIVEAWAY_TAG,
  HUMBLE_URL_KEY_PATTERN,
  HUMBLE_URL_PATTERN,
  INSTRUCTION_PATTERN,
  PARENT_ANNOTATION_PREFIX,
  PLATFORM_ANNOTATION_PREFIX,
  PLATFORM_HINT_PATTERN,
  RECIPIENT_MAX_WORDS,
  RECIPIENT_PATTERN,
  REDEEM_MARKER_PATTERN,
  SECTION_MARKER_PATTERN,
  markerForStatus,
  STATUS_MARKER_CHARS,
  STATUS_MARKERS,
  STEAM_KEY_PATTERN,
  statusForMarker,
  TITLE_NOISE_PATTERN,
} from './legacy-format.constants';
