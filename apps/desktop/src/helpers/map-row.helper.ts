import { KeyPlatform, KeySource, KeyStatus, type IGameKey, type IGameKeyRow } from '@/contracts';
import { parseTags } from '@/helpers/normalize-text.helper';

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

// Las columnas de `game_keys` viven en `contracts/constants/db-schema.constants`,
// junto al DDL del que salen. Ver el comentario de ahi: si la lista viviese en
// un helper, los scripts de `tools/scripts/` —que escriben SQL contra la misma
// base— no podrian alcanzarla por el alias `@/` y acabarian con su propia copia.