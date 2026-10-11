import { KeyPlatform, KeySource, KeyStatus, type IGameKey, type IGameKeyRow } from '@/contracts';
import { parseTags } from '@/helpers/normalize-text.helper';
import { nowSqliteTimestamp } from '@/helpers/format-date.helper';

/** Convierte una fila cruda de SQLite en la entidad de dominio. */
export function mapRowToGameKey(row: IGameKeyRow): IGameKey {
  return {
    id: row.id,
    title: row.title,
    keyValue: row.key_value,
    platform: row.platform as KeyPlatform,
    status: row.status as KeyStatus,
    source: row.source as KeySource,
    giftedTo: row.gifted_to,
    parentTitle: row.parent_title,
    note: row.note,
    tags: parseTags(row.tags),
    addedOn: row.added_on,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Marca de tiempo para la columna `updated_at`. */
export function touchTimestamp(): string {
  return nowSqliteTimestamp();
}

/**
 * Columnas de `game_keys` que se escriben, en el orden del esquema.
 *
 * Es la **unica** lista de columnas de la tabla, y de ella salen las dos que se
 * usan en SQL: la del `SELECT` —la de arriba con `id` delante— y la del `INSERT`.
 * Escribir las dos a mano hacia que se separen: se anade una columna al `INSERT`
 * y el `SELECT` se queda sin ella, o al reves, y en los dos casos la fila se
 * lee a medias sin que nada falle.
 *
 * Van todas, tambien las que la entrada no trae —`last_used_at`—: el `INSERT`
 * es uno solo para las tres rutas que escriben, y las que no tienen ese valor
 * pasan `null`, que es lo que la columna admitia antes.
 */
export const GAME_KEY_WRITE_COLUMNS = [
  'title',
  'key_value',
  'platform',
  'status',
  'source',
  'gifted_to',
  'parent_title',
  'note',
  'tags',
  'added_on',
  'last_used_at',
  'created_at',
  'updated_at',
] as const;

/** Cuantos valores lleva la lista de valores de un `INSERT` de `game_keys`. */
export const GAME_KEY_INSERT_SIZE = GAME_KEY_WRITE_COLUMNS.length;

/** Columnas en el orden en que las devuelve `SELECT *`. */
export const GAME_KEY_COLUMNS = ['id', ...GAME_KEY_WRITE_COLUMNS].join(', ');