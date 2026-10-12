import { mapRowToGameKey, touchTimestamp } from '@/helpers/map-row.helper';
import { gameKeyInsertStatement, sqlPlaceholders } from '@/helpers/sql.helper';
import {
  keyFingerprint,
  normalizeKey,
  serializeTags,
} from '@/helpers/normalize-text.helper';
import { GAME_KEY_COLUMNS, KeyPlatform, KeySource, KeyStatus, TABLE_GAME_KEYS, TABLE_TAGS, type IDatabaseClient, type IGameKey, type IGameKeyDraft, type IGameKeyInput, type IGameKeyRepository, type IGameKeyRow, type IImportRow, type IImportSummary, type ITagRow } from '@/contracts';

/**
 * Repositorio de keys sobre SQLite.
 *
 * Toda la app habla con esta clase a traves de `IGameKeyRepository`, asi que
 * cambiarla por una version en memoria (para trabajar en el navegador) no
 * obliga a tocar ni un solo componente.
 */
export class SqliteGameKeyRepository implements IGameKeyRepository {
  constructor(private readonly db: IDatabaseClient) {}

  async migrate(): Promise<void> {
    await this.db.migrate();
  }

  async listAll(): Promise<readonly IGameKey[]> {
    const rows = await this.db.select<IGameKeyRow>(
      `SELECT ${GAME_KEY_COLUMNS} FROM ${TABLE_GAME_KEYS}
       ORDER BY COALESCE(added_on, created_at) DESC, title COLLATE NOCASE ASC`,
    );

    return rows.map(mapRowToGameKey);
  }

  async getById(id: number): Promise<IGameKey | null> {
    const rows = await this.db.select<IGameKeyRow>(
      `SELECT ${GAME_KEY_COLUMNS} FROM ${TABLE_GAME_KEYS} WHERE id = $1`,
      [id],
    );

    const row = rows[0];
    return row ? mapRowToGameKey(row) : null;
  }

  async insert(input: IGameKeyInput): Promise<IGameKey> {
    const keyValue = normalizeKey(input.keyValue);
    const ahora = touchTimestamp();

    // `created_at` y `updated_at` se numeran por separado aunque valgan lo
    // mismo. Antes compartian marcador (`$11, $11`), que es el truco que hizo
    // que en la restauracion —donde las dos fechas si son distintas— la
    // segunda se perdiera. Los valores van en el orden de
    // `GAME_KEY_WRITE_COLUMNS`, que es el de la sentencia.
    await this.db.execute(gameKeyInsertStatement(), [
      input.title.trim(),
      keyValue,
      input.platform ?? KeyPlatform.Steam,
      input.status ?? KeyStatus.Available,
      // Por defecto una clave creada desde el formulario es manual. Lo
      // explicito es el deshacer de un borrado, que tiene que devolver la
      // fila tal cual estaba y no como nueva.
      input.source ?? KeySource.Manual,
      input.giftedTo ?? null,
      input.parentTitle ?? null,
      input.note ?? null,
      serializeTags(input.tags),
      input.addedOn ?? null,
      // Antes era `null` fijo. El deshacer de un borrado lo rellena; en una
      // alta normal una clave recien creada no se ha canjeado nunca.
      input.lastUsedAt ?? null,
      ahora,
      ahora,
    ]);

    const created = await this.findByKey(keyValue);
    if (!created) throw new Error('No se pudo recuperar la key recien creada.');

    return created;
  }

  async update(id: number, draft: IGameKeyDraft): Promise<IGameKey> {
    await this.db.execute(
      `UPDATE ${TABLE_GAME_KEYS} SET
         title = $1, key_value = $2, platform = $3, status = $4,
         gifted_to = $5, parent_title = $6, note = $7, tags = $8,
         added_on = $9, updated_at = $10
       WHERE id = $11`,
      [
        draft.title.trim(),
        normalizeKey(draft.keyValue),
        draft.platform,
        draft.status,
        draft.giftedTo,
        draft.parentTitle,
        draft.note,
        serializeTags(draft.tags),
        draft.addedOn,
        touchTimestamp(),
        id,
      ],
    );

    const updated = await this.getById(id);
    if (!updated) throw new Error(`No existe la key con id ${id}.`);

    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.db.execute(`DELETE FROM ${TABLE_GAME_KEYS} WHERE id = $1`, [id]);
  }

  async removeMany(ids: readonly number[]): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = sqlPlaceholders(ids.length);
    await this.db.execute(`DELETE FROM ${TABLE_GAME_KEYS} WHERE id IN (${placeholders})`, [...ids]);
  }

  async setStatus(id: number, status: KeyStatus): Promise<void> {
    await this.db.execute(
      `UPDATE ${TABLE_GAME_KEYS} SET status = $1, updated_at = $2 WHERE id = $3`,
      [status, touchTimestamp(), id],
    );
  }

  /**
   * Cambia el estado de varias claves en una sola sentencia.
   *
   * Existe para el modo "regalar": marcar treinta claves una a una son treinta
   * viajes de ida y vuelta a la base de datos, y treinta recargas de la lista
   * si cada uno va por su cuenta.
   */
  async setStatusMany(ids: readonly number[], status: KeyStatus): Promise<void> {
    if (ids.length === 0) return;

    // Los ids empiezan en el 3 porque antes ya hay dos valores fijos: el estado
    // y el sello. Con el 2, `updated_at` y el primer id compartian marcador.
    const placeholders = sqlPlaceholders(ids.length, 3);

    await this.db.execute(
      `UPDATE ${TABLE_GAME_KEYS} SET status = $1, updated_at = $2 WHERE id IN (${placeholders})`,
      [status, touchTimestamp(), ...ids],
    );
  }

  /**
   * Marca varias claves como regaladas, guardando para quien fue cada una.
   *
   * Va en un unico `UPDATE` con un `CASE`: el destinatario es distinto en cada
   * clave, asi que no se puede repetir el mismo `bind` para todas.
   */
  async giftMany(
    entries: readonly { id: number; giftedTo: string }[],
  ): Promise<void> {
    if (entries.length === 0) return;

    const total = entries.length;
    const ids = entries.map((entry) => entry.id);

    // Orden de los valores: `$1` estado, `$2` sello, y a partir de ahi los ids y
    // los destinatarios. Los indices se cuentan aqui y no a mano porque dos
    // listas en la misma sentencia se pisan en silencio (mira `sqlPlaceholders`).
    const idPlaceholders = sqlPlaceholders(total, 3);
    const casosDesde = 3 + total;

    const cases = entries
      .map((_, indice) => `WHEN ${indice + 1} THEN $${casosDesde + indice}`)
      .join(' ');

    await this.db.execute(
      `UPDATE ${TABLE_GAME_KEYS}
          SET status = $1,
              gifted_to = CASE id ${cases} END,
              updated_at = $2
        WHERE id IN (${idPlaceholders})`,
      [
        KeyStatus.Gifted,
        touchTimestamp(),
        ...ids,
        ...entries.map((entry) => entry.giftedTo),
      ],
    );
  }

  async markUsed(id: number, usedAt?: string): Promise<void> {
    await this.db.execute(
      `UPDATE ${TABLE_GAME_KEYS} SET last_used_at = $1, updated_at = $2 WHERE id = $3`,
      [usedAt ?? touchTimestamp(), touchTimestamp(), id],
    );
  }

  /**
   * Cambia las etiquetas de varias claves en un unico `UPDATE`.
   *
   * Las etiquetas se guardan como texto separado por comas, asi que aqui se
   * reconstruye el string entero. Se hace en una sola sentencia y no en un
   * bucle porque pueden ser cientos las claves que se cambian de golpe y cada
   * viaje de ida y vuelta cuesta.
   *
   * El texto lo arma `serializeTags`, como en el resto de escrituras: unirlo a
   * mano aqui dejaba las etiquetas con espacios y sin pasar por el limpiado, de
   * modo que la misma columna guardaba dos formatos distintos.
   */
  async setTagsMany(ids: readonly number[], tags: readonly string[]): Promise<void> {
    if (ids.length === 0) return;

    // Igual que en `setStatusMany`: dos valores fijos antes, asi que los ids
    // empiezan en el 3.
    const placeholders = sqlPlaceholders(ids.length, 3);

    await this.db.execute(
      `UPDATE ${TABLE_GAME_KEYS} SET tags = $1, updated_at = $2 WHERE id IN (${placeholders})`,
      [serializeTags(tags), touchTimestamp(), ...ids],
    );
  }

  async setTagsForKeys(
    asignaciones: readonly { id: number; tags: readonly string[] }[],
  ): Promise<void> {
    if (asignaciones.length === 0) return;

    const ahora = touchTimestamp();

    /**
     * En transaccion, no en un bucle suelto.
     *
     * Con cuatrocientas claves son cuatrocientas sentencias `UPDATE` y una
     * ida y vuelta cada una. Peor que eso: si la numero 250 falla, las 249
     * anteriores ya estan escritas y la coleccion queda con unas claves
     * etiquetadas y otras no, sin nada que lo diga. En transaccion se
     * escribe todo o nada.
     */
    await this.db.transaccion(async () => {
      for (const asignacion of asignaciones) {
        await this.db.execute(
          `UPDATE ${TABLE_GAME_KEYS} SET tags = $1, updated_at = $2 WHERE id = $3`,
          [serializeTags(asignacion.tags), ahora, asignacion.id],
        );
      }
    });
  }

  async findByKey(keyValue: string): Promise<IGameKey | null> {
    const rows = await this.db.select<IGameKeyRow>(
      `SELECT ${GAME_KEY_COLUMNS} FROM ${TABLE_GAME_KEYS} WHERE key_value = $1`,
      [normalizeKey(keyValue)],
    );

    const row = rows[0];
    return row ? mapRowToGameKey(row) : null;
  }

// ------------------------------------------------------- catalogo de etiquetas ---

  async listTags(): Promise<readonly ITagRow[]> {
    return this.db.select<ITagRow>(`SELECT nombre FROM ${TABLE_TAGS}`);
  }

  async createTag(nombre: string): Promise<void> {
    // `OR IGNORE` y no un `SELECT` antes: la clave primaria ya lo garantiza, y
    // un `SELECT` previo deja hueco para dos llamadas a la vez.
    await this.db.execute(
      `INSERT OR IGNORE INTO ${TABLE_TAGS} (nombre) VALUES ($1)`,
      [nombre],
    );
  }

  async deleteTag(nombre: string): Promise<number> {
    /**
     * La etiqueta sale del catalogo **y** de todas las claves que la llevan.
     *
     * Las dos cosas o ninguna, y en transaccion. Si solo se quitara del
     * catalogo, la proxima sincronizacion la volveria a meter —alguien sigue
     * usandola— y el boton de borrar pareceria no hacer nada. Si solo se
     * quitara de las claves, volveria a salir en el dialogo sin poder marcarse.
     *
     * De las claves hay que reescribir la columna entera, porque las etiquetas
     * viven en un texto separado por comas. Los tresifos de los `replace` son:
     *
     * - `,nombre` y `nombre,` para quitar la suya, con comas o sin ellas.
     * - El `trim` de `, ,` al final, que es lo que deja una clave a la que se
     *   le ha quitado la unica etiqueta que tenia: sin el se queda con una
     *   coma suelta o con dos, y `parseTags` las leeria como una etiqueta
     *   vacia.
     */
    return this.db.transaccion(async () => {
      await this.db.execute(`DELETE FROM ${TABLE_TAGS} WHERE nombre = $1`, [nombre]);

      const marcadas = await this.db.select<{ tags: string }>(
        `SELECT tags FROM ${TABLE_GAME_KEYS}
         WHERE ',' || tags || ',' LIKE '%,' || $1 || ',%'`,
        [nombre],
      );

      for (const fila of marcadas) {
        const quedan = (fila.tags ?? '')
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0 && tag !== nombre);

        await this.db.execute(
          `UPDATE ${TABLE_GAME_KEYS} SET tags = $1, updated_at = $2 WHERE tags = $3`,
          [quedan.join(','), touchTimestamp(), fila.tags],
        );
      }

      return marcadas.length;
    });
  }

  async syncTagsFromKeys(): Promise<number> {
    /**
     * Meten en el catalogo todo lo que ya usan las claves.
     *
     * Es la vuelta que recoge los datos que ya estaban: una coleccion con
     * cuatrocientas claves tiene dentro decenas de etiquetas —«contexto»,
     * «promo winter»— que nunca se escribieron en el catalogo, porque
     * hasta ahora el catalogo no existia. Sin esta vuelta no se podrian
     * volver a marcar nunca, y las etiquetas que ya tienes serian las unicas
     * que no se pueden volver a usar.
     *
     * Solo anade, nunca quita: para eso esta `deleteTag`, que ademas limpia
     * las claves. Aqui solo se rellena un hueco.
     */
    const filas = await this.db.select<{ tags: string }>(
      `SELECT tags FROM ${TABLE_GAME_KEYS}`,
    );

    const vistas = new Set<string>();

    for (const fila of filas) {
      for (const tag of (fila.tags ?? '').split(',')) {
        const limpia = tag.trim();

        if (limpia.length > 0) vistas.add(limpia);
      }
    }

    if (vistas.size === 0) return 0;

    let anadidas = 0;

    for (const nombre of vistas) {
      // `execute` devuelve las filas afectadas, y con `OR IGNORE` eso es
      // exactamente lo que se ha anadido de verdad: si la etiqueta ya estaba
      // en el catalogo devuelve 0, sin haber hecho falta preguntar antes.
      anadidas += await this.db.execute(
        `INSERT OR IGNORE INTO ${TABLE_TAGS} (nombre) VALUES ($1)`,
        [nombre],
      );
    }

    return anadidas;
  }

  async countAll(): Promise<number> {
    const rows = await this.db.select<{ total: number }>(
      `SELECT COUNT(*) AS total FROM ${TABLE_GAME_KEYS}`,
    );

    return rows[0]?.total ?? 0;
  }

  async listKeyValues(): Promise<readonly string[]> {
    const rows = await this.db.select<{ key_value: string }>(
      `SELECT key_value FROM ${TABLE_GAME_KEYS}`,
    );

    return rows.map((row) => row.key_value);
  }

  /**
   * Insercion masiva. Se hace con `INSERT OR IGNORE` para que reimportar el
   * mismo TXT dos veces no duplique nada y no reviente por el indice unico.
   */
  async importRows(rows: readonly IImportRow[]): Promise<IImportSummary> {
    let inserted = 0;
    let alreadyInDb = 0;

    const existing = new Set((await this.listKeyValues()).map(keyFingerprint));

    for (const row of rows) {
      const fingerprint = keyFingerprint(row.keyValue);
      if (existing.has(fingerprint)) {
        alreadyInDb += 1;
        continue;
      }
      existing.add(fingerprint);

      const ahora = touchTimestamp();
      const affected = await this.db.execute(gameKeyInsertStatement(true), [
        row.title,
        normalizeKey(row.keyValue),
        row.platform,
        row.status,
        row.source,
        row.giftedTo,
        row.parentTitle,
        row.note,
        row.tags,
        row.addedOn,
        null,
        ahora,
        ahora,
      ]);

      inserted += affected;
    }

    return {
      inserted,
      skipped: rows.length - inserted,
      duplicates: alreadyInDb,
      gifted: rows.filter((row) => row.status === KeyStatus.Gifted).length,
      available: rows.filter((row) => row.status === KeyStatus.Available).length,
      issues: 0,
      alreadyInDb,
    };
  }
}