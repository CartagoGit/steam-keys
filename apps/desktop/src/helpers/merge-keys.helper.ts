import { RestoreMode, TABLE_GAME_KEYS, type IDatabaseClient, type IGameKeyRow, type IRestoreSummary } from '@/contracts';
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
      `SELECT id FROM ${TABLE_GAME_KEYS} WHERE key_value = $1`,
      [clave],
    );

    const id = existentes[0]?.id;

    if (id === undefined) {
      // 13 columnas y 13 valores. Antes el ultimo marcador salia dos veces
      // (`$12, $12`), copiado del `INSERT` del alta normal, donde si procede
      // porque ahi los dos son el mismo `touchTimestamp()`. Aqui no: la fila de
      // la copia trae `created_at` y `updated_at` distintos, y repetir el
      // marcador guardaba la fecha de creacion en la de modificacion,  perdia
      // la segunda sin avisar. La rama de `UPDATE` de mas abajo si la
      // respectaba: la misma operacion trataba de dos formas.
      await db.execute(
        `INSERT INTO ${TABLE_GAME_KEYS}
           (title, key_value, platform, status, source, gifted_to, parent_title,
            note, tags, added_on, last_used_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          fila.title,
          clave,
          fila.platform,
          fila.status,
          fila.source,
          fila.gifted_to,
          fila.parent_title,
          fila.note,
          serializeTags(parseTags(fila.tags)),
          fila.added_on,
          fila.last_used_at,
          fila.created_at,
          fila.updated_at,
        ],
      );
      inserted += 1;
      continue;
    }

    if (mode === RestoreMode.Sobrescribir) {
      await db.execute(
        `UPDATE ${TABLE_GAME_KEYS} SET
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
          serializeTags(parseTags(fila.tags)),
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