import { KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KeySource } from '@/contracts/enums/key-source.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { parseTags } from '@/helpers/normalize-text.helper';
import { nowSqliteTimestamp } from '@/helpers/format-date.helper';
import type { IGameKeyRow } from '@/contracts/interfaces/import-summary.interface';
import type { IGameKey } from '@/contracts/interfaces/game-key.interface';

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

/** Columnas en el orden en que las devuelve `SELECT *`. */
export const GAME_KEY_COLUMNS = [
  'id',
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
].join(', ');