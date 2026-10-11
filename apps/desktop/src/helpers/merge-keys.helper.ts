import { RestoreMode, type IDatabaseClient, type IGameKeyRow, type IRestoreSummary } from '@/contracts';
import {
  normalizeKey,
  parseTags,
  serializeTags,
} from './normalize-text.helper';

/**
 * Fusiona las filas de una copia de seguridad en la base de datos viva.
 *
 * Se hace fila a fila en lugar de reemplazar el fichero porque la aplicacion
 * mantiene la conexion abierta: sobrescribir el `.db` por debajo dejaria a
 * SQLite trabajando sobre una referencia obsoleta.
 *
 * **Nunca borra.** Restaurar solo puede anadir claves o devolverlas a como
 * estaban, nunca reducir la coleccion.
 */
export async function mergeKeysFromBackup(
  db: IDatabaseClient,
  filas: readonly IGameKeyRow[],
  mode: RestoreMode,
): Promise<IRestoreSummary> {
  let inserted = 0;
  let skipped = 0;
  let updated = 0;

  for (const fila of filas) {
    const clave = normalizeKey(fila.key_value);

    const existentes = await db.select<{ id: number }>(
      'SELECT id FROM game_keys WHERE key_value = $1',
      [clave],
    );

    const id = existentes[0]?.id;

    if (id === undefined) {
      await db.execute(
        `INSERT INTO game_keys
           (title, key_value, platform, status, source, gifted_to, parent_title,
            note, tags, added_on, last_used_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
        [
          fila.title,
          clave,
          fila.platform,
          fila.status,
          fila.source,
          fila.gifted_to,
          fila.parent_title,
          fila.note,
          tagsDe(fila.tags),
          fila.added_on,
          fila.last_used_at,
          fila.created_at,
        ],
      );
      inserted += 1;
      continue;
    }

    if (mode === RestoreMode.Sobrescribir) {
      await db.execute(
        `UPDATE game_keys SET
           title = $1, platform = $2, status = $3, gifted_to = $4,
           parent_title = $5, note = $6, tags = $7, added_on = $8,
           last_used_at = $9, updated_at = $10
         WHERE id = $11`,
        [
          fila.title,
          fila.platform,
          fila.status,
          fila.gifted_to,
          fila.parent_title,
          fila.note,
          tagsDe(fila.tags),
          fila.added_on,
          fila.last_used_at,
          fila.updated_at,
          id,
        ],
      );
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return { total: filas.length, inserted, skipped, updated };
}

/** Normaliza el texto de etiquetas para que nunca quede en blanco. */
function tagsDe(tags: string | null): string {
  if (!tags) return '';

  return tags.trim().length > 0 ? tags : serializeTags(parseTags(tags));
}