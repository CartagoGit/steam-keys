import {
  GAME_KEY_COLUMNS,
  mapRowToGameKey,
  touchTimestamp,
} from '@/helpers/map-row.helper';
import { sqlPlaceholders } from '@/helpers/sql.helper';
import {
  keyFingerprint,
  normalizeKey,
  serializeTags,
} from '@/helpers/normalize-text.helper';
import { KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KeySource } from '@/contracts/enums/key-source.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import type { IDatabaseClient, IGameKeyRepository } from '@/contracts/interfaces/database.interface';
import type {
  IGameKey,
  IGameKeyDraft,
  IGameKeyInput,
} from '@/contracts/interfaces/game-key.interface';
import type {
  IGameKeyRow,
  IImportRow,
  IImportSummary,
} from '@/contracts/interfaces/import-summary.interface';

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
      `SELECT ${GAME_KEY_COLUMNS} FROM game_keys
       ORDER BY COALESCE(added_on, created_at) DESC, title COLLATE NOCASE ASC`,
    );

    return rows.map(mapRowToGameKey);
  }

  async getById(id: number): Promise<IGameKey | null> {
    const rows = await this.db.select<IGameKeyRow>(
      `SELECT ${GAME_KEY_COLUMNS} FROM game_keys WHERE id = $1`,
      [id],
    );

    const row = rows[0];
    return row ? mapRowToGameKey(row) : null;
  }

  async insert(input: IGameKeyInput): Promise<IGameKey> {
    const keyValue = normalizeKey(input.keyValue);

    await this.db.execute(
      `INSERT INTO game_keys
         (title, key_value, platform, status, source, gifted_to, parent_title,
          note, tags, added_on, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
      [
        input.title.trim(),
        keyValue,
        input.platform ?? KeyPlatform.Steam,
        input.status ?? KeyStatus.Available,
        KeySource.Manual,
        input.giftedTo ?? null,
        input.parentTitle ?? null,
        input.note ?? null,
        serializeTags(input.tags),
        input.addedOn ?? null,
        touchTimestamp(),
      ],
    );

    const created = await this.findByKey(keyValue);
    if (!created) throw new Error('No se pudo recuperar la key recien creada.');

    return created;
  }

  async update(id: number, draft: IGameKeyDraft): Promise<IGameKey> {
    await this.db.execute(
      `UPDATE game_keys SET
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
    await this.db.execute('DELETE FROM game_keys WHERE id = $1', [id]);
  }

  async removeMany(ids: readonly number[]): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = sqlPlaceholders(ids.length);
    await this.db.execute(`DELETE FROM game_keys WHERE id IN (${placeholders})`, [...ids]);
  }

  async setStatus(id: number, status: KeyStatus): Promise<void> {
    await this.db.execute(
      'UPDATE game_keys SET status = $1, updated_at = $2 WHERE id = $3',
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
      `UPDATE game_keys SET status = $1, updated_at = $2 WHERE id IN (${placeholders})`,
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

    const ids = entries.map((entry) => entry.id);
    const idPlaceholders = sqlPlaceholders(ids.length, 2);

    // Los destinatarios van detras de los ids, que ocupan del 2 al 1+ids.length.
    const casosDesde = ids.length + 2;

    const cases = entries
      .map(
        (_, index) =>
          `WHEN ${index + 1} THEN $${casosDesde + index}`,
      )
      .join(' ');

    await this.db.execute(
      `UPDATE game_keys
          SET status = 'gifted',
              gifted_to = CASE id ${cases} END,
              updated_at = $1
        WHERE id IN (${idPlaceholders})`,
      [
        touchTimestamp(),
        ...ids,
        ...entries.map((entry) => entry.giftedTo),
      ],
    );
  }

  async markUsed(id: number, usedAt?: string): Promise<void> {
    await this.db.execute(
      'UPDATE game_keys SET last_used_at = $1, updated_at = $2 WHERE id = $3',
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
      `UPDATE game_keys SET tags = $1, updated_at = $2 WHERE id IN (${placeholders})`,
      [serializeTags(tags), touchTimestamp(), ...ids],
    );
  }

  async findByKey(keyValue: string): Promise<IGameKey | null> {
    const rows = await this.db.select<IGameKeyRow>(
      `SELECT ${GAME_KEY_COLUMNS} FROM game_keys WHERE key_value = $1`,
      [normalizeKey(keyValue)],
    );

    const row = rows[0];
    return row ? mapRowToGameKey(row) : null;
  }

  async countAll(): Promise<number> {
    const rows = await this.db.select<{ total: number }>(
      'SELECT COUNT(*) AS total FROM game_keys',
    );

    return rows[0]?.total ?? 0;
  }

  async listKeyValues(): Promise<readonly string[]> {
    const rows = await this.db.select<{ key_value: string }>(
      'SELECT key_value FROM game_keys',
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

      const affected = await this.db.execute(
        `INSERT OR IGNORE INTO game_keys
           (title, key_value, platform, status, source, gifted_to, parent_title,
            note, tags, added_on, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
        [
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
          touchTimestamp(),
        ],
      );

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