import { RestoreMode, TABLE_GAME_KEYS, type IDatabaseClient, type IGameKeyRow, type IRestoreSummary } from '@/contracts';
import { gameKeyInsertStatement } from '@/helpers/sql.helper';
import {
  normalizeKey,
  parseTags,
  serializeTags,
} from './normalize-text.helper';

/**
 * Los ids de las claves que ya hay, por clave normalizada.
 *
 * Antes se preguntaba una vez **por fila**: con una copia de cuatrocientas
 * claves eran cuatrocientas idas y vueltas a la base para decidir lo mismo
 * cuatrocientas veces, y la copia ya sabe de sobra cuales tiene. Una sola
 * lectura lo resuelve y deja el resto para lo que es de verdad trabajo.
 *
 * Se cargan **una vez**, antes de escribir nada. Es lo que hace segura la
 * transaccion: si una fila insertada se contara despues, dos claves iguales
 * dentro de la misma copia —que el TXT permite— se insertarian las dos, y con
 * `INSERT` normal la segunda revienta por el indice unico dejando la copia a
 * medias.
 */
async function idsExistentes(db: IDatabaseClient): Promise<Map<string, number>> {
  const filas = await db.select<{ id: number; key_value: string }>(
    `SELECT id, key_value FROM ${TABLE_GAME_KEYS}`,
  );

  return new Map(filas.map((fila) => [normalizeKey(fila.key_value), fila.id]));
}

/**
 * Como se reparte una copia entre altas, saltadas y actualizadas.
 *
 * Vive aparte porque lo usan **las dos** funciones de este modulo —la que
 * escribe y la que solo cuenta— y las dos tienen que dar el mismo numero. Es
 * el contrato del aviso previo: si divergieran, el dialogo prometeria «van a
 * entrar 12 y se actualizan 3» y luego harian otra cosa.
 *
 * La condicion de «ya existe» es identica en las dos por construccion: no hay
 * dos sitios donde pueda desincronizarse.
 */
function repartir(
  filas: readonly IGameKeyRow[],
  existentes: ReadonlyMap<string, number>,
  mode: RestoreMode,
): IRestoreSummary {
  let inserted = 0;
  let skipped = 0;
  let updated = 0;

  for (const fila of filas) {
    if (!existentes.has(normalizeKey(fila.key_value))) {
      inserted += 1;
      continue;
    }

    // Al fusionar, una clave que ya esta se salta: solo se anaden las que
    // faltan. Al sobrescribir, vuelve a como estaba en la copia.
    if (mode === RestoreMode.Sobrescribir) updated += 1;
    else skipped += 1;
  }

  return { total: filas.length, inserted, skipped, updated };
}

/**
 * Fusiona las filas de una copia de seguridad en la base de datos viva.
 *
 * Se hace fila a fila en lugar de reemplazar el fichero porque la aplicacion
 * mantiene la conexion abierta: sobrescribir el `.db` por debajo dejaria a
 * SQLite trabajando sobre una referencia obsoleta.
 *
 * **Nunca borra.** Restaurar solo puede anadir claves o devolverlas a como
 * estaban, nunca reducir la coleccion.
 *
 * Va dentro de una transaccion porque son cientos de escrituras y SQLite
 * confirma cada una por separado: sin ella, un fallo a mitad —un disco lleno,
 * una copia corrupta— dejaba la coleccion con medio camino hecho y sin forma
 * de saber hasta donde. Con ella, o entra la copia entera o no entra nada.
 */
export async function mergeKeysFromBackup(
  db: IDatabaseClient,
  filas: readonly IGameKeyRow[],
  mode: RestoreMode,
): Promise<IRestoreSummary> {
  return db.transaccion(async () => {
    const existentes = await idsExistentes(db);

    let skipped = 0;
    let updated = 0;
    let inserted = 0;

    // Las que ya estan se filtran **antes** de escribir. Las nuevas se insertan
    // una a una porque cada fila lleva su propia fecha de creccion y sus
    // etiquetas: no hay un INSERT multiple que las respete.
    for (const fila of filas) {
      const clave = normalizeKey(fila.key_value);
      const id = existentes.get(clave);

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

      if (mode !== RestoreMode.Sobrescribir) {
        skipped += 1;
        continue;
      }

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
    }

    return { total: filas.length, inserted, skipped, updated };
  });
}

/**
 * Cuenta lo que haria una restauracion, sin escribir nada.
 *
 * Es el mismo reparto que `mergeKeysFromBackup`, pero solo mirando. Sirve para
 * enseñar «van a entrar 12 y se van a actualizar 3» **antes** de confirmar,
 * que es cuando esa informacion decide si se restaura o no.
 *
 * Sin esto, el dialogo decia cuanto se iba a escribir pero no cuanto de eso
 * eran altas y cuanto cambios sobre claves que ya tenias: las dos cosas tienen
 * consecuencias muy distintas y solo se averiguaban despues de aplicarlas.
 *
 * Comparte `repartir` con la fusion real a proposito: si un dia una de las dos
 * cambia la condicion, el aviso y lo que ocurre dejan de cuadrar —y aqui no
 * hay forma de que cambien por separado—.
 */
export async function resumirRestauracion(
  db: IDatabaseClient,
  filas: readonly IGameKeyRow[],
  mode: RestoreMode,
): Promise<IRestoreSummary> {
  return repartir(filas, await idsExistentes(db), mode);
}