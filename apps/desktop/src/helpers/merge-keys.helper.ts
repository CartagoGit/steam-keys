import { RestoreMode, TABLE_GAME_KEYS, type IDatabaseClient, type IGameKeyRow, type IRestoreSummary } from '@/contracts';
import { gameKeyInsertStatement } from '@/helpers/sql.helper';
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
      // 13 columnas y 13 valores, en el orden de `GAME_KEY_WRITE_COLUMNS`. El
      // marcador va uno a uno por columna y no se repite: la fila de la copia
      // trae `created_at` y `updated_at` distintos, y antes la sentencia
      // compartia marcador entre las dos —copiado del alta normal, donde si
      // procede porque ahi las dos fechas son la misma—, de modo que se
      // guardaba la fecha de creacion en la de modificacion y la segunda se
      // perdia sin avisar. La rama de `UPDATE` de mas abajo si la respetaba:
      // la misma operacion trataba de dos formas.
      await db.execute(gameKeyInsertStatement(), [
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
      ]);
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

/**
 * Cuenta lo que haria una restauracion, sin escribir nada.
 *
 * Es el mismo reparto que `mergeKeysFromBackup`, pero solo mirando: las filas
 * que ya existen se saltan y no se tocan. Sirve para enseñar «van a entrar 12 y
 * se van a actualizar 3» **antes** de confirmar, que es cuando esa informacion
 * decide si se restaura o no.
 *
 * Sin esto, el dialogo decia cuanto se iba a escribir pero no cuanto de eso
 * eran altas y cuanto cambios sobre claves que ya tenias: las dos cosas tienen
 * consecuencias muy distintas y solo se averiguaban despues de aplicarlas.
 *
 * Va por la misma consulta que la fusion real a proposito: si un dia una de las
 * dos cambia la condicion, el aviso y lo que ocurre dejan de cuadrar.
 */
export async function resumirRestauracion(
  db: IDatabaseClient,
  filas: readonly IGameKeyRow[],
  mode: RestoreMode,
): Promise<IRestoreSummary> {
  let inserted = 0;
  let skipped = 0;
  let updated = 0;

  for (const fila of filas) {
    const existentes = await db.select<{ id: number }>(
      `SELECT id FROM ${TABLE_GAME_KEYS} WHERE key_value = $1`,
      [normalizeKey(fila.key_value)],
    );

    if (existentes[0]?.id === undefined) {
      inserted += 1;
      continue;
    }

    if (mode === RestoreMode.Sobrescribir) updated += 1;
    else skipped += 1;
  }

  return { total: filas.length, inserted, skipped, updated };
}