/** Barril de constantes. Importar siempre desde aqui: `@/contracts/constants`. */

export {
  APP_IDENTIFIER,
  APP_NAME,
  DB_FILE_NAME,
  PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
  SEARCH_SHORTCUT,
  MASK_VISIBLE_CHARS,
  GRID_MIN_WIDTH_PX,
  EXPORT_FILE_NAME,
} from './app.constants';

export { KEY_PLATFORM_META } from './key-platform.constants';
export type { IPlatformMeta } from './key-platform.constants';

export { KEY_STATUS_META } from './key-status.constants';
export type { IStatusMeta } from './key-status.constants';

export { SCHEMA_STATEMENTS, SEARCHABLE_COLUMNS } from './db-schema.constants';