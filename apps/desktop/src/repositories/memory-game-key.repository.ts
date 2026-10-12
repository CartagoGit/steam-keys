import { KeyPlatform, KeySource, KeyStatus, STORAGE_KEY_PREFIX, type IGameKey, type IGameKeyDraft, type IGameKeyInput, type IGameKeyRepository, type IImportRow, type IImportSummary } from '@/contracts';
import { keyFingerprint, normalizeKey, parseTags, serializeTags } from '@/helpers/normalize-text.helper';
import { nowSqliteTimestamp } from '@/helpers/format-date.helper';

/**
 * Repositorio en memoria para trabajar en el navegador.
 *
 * Implementa el mismo contrato que el de SQLite, asi que la UI se puede
 * desarrollar y depurar con `bun run dev` sin compilar Rust ni Tauri.
 * Los datos viven en `localStorage`, de modo que sobreviven a un refresco.
 */
export class MemoryGameKeyRepository implements IGameKeyRepository {
  private keys: IGameKey[] = [];

  constructor() {
    this.keys = loadFromStorage();
  }

  async listAll(): Promise<readonly IGameKey[]> {
    return [...this.keys].sort((a, b) => a.title.localeCompare(b.title, 'es'));
  }

  async getById(id: number): Promise<IGameKey | null> {
    return this.keys.find((key) => key.id === id) ?? null;
  }

  async insert(input: IGameKeyInput): Promise<IGameKey> {
    const now = nowSqliteTimestamp();

    const created: IGameKey = {
      id: nextId(),
      title: input.title.trim(),
      keyValue: normalizeKey(input.keyValue),
      platform: input.platform ?? KeyPlatform.Steam,
      status: input.status ?? KeyStatus.Available,
      // Como en la base: por defecto una clave creada desde el formulario es
      // manual, y el deshacer de un borrado es el que pasa el valor
      // explicito para devolver la fila tal cual estaba.
      source: input.source ?? KeySource.Manual,
      giftedTo: input.giftedTo ?? null,
      parentTitle: input.parentTitle ?? null,
      note: input.note ?? null,
      tags: input.tags ?? [],
      addedOn: input.addedOn ?? null,
      lastUsedAt: input.lastUsedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.keys = [...this.keys, created];
    persist(this.keys);

    return created;
  }

  async update(id: number, draft: IGameKeyDraft): Promise<IGameKey> {
    const existing = this.keys.find((key) => key.id === id);
    if (!existing) throw new Error(`No existe la key con id ${id}.`);

    const updated: IGameKey = {
      ...existing,
      title: draft.title.trim(),
      keyValue: normalizeKey(draft.keyValue),
      platform: draft.platform,
      status: draft.status,
      giftedTo: draft.giftedTo,
      parentTitle: draft.parentTitle,
      note: draft.note,
      tags: draft.tags,
      addedOn: draft.addedOn,
      updatedAt: nowSqliteTimestamp(),
    };

    this.keys = this.keys.map((key) => (key.id === id ? updated : key));
    persist(this.keys);

    return updated;
  }

  async remove(id: number): Promise<void> {
    this.keys = this.keys.filter((key) => key.id !== id);
    persist(this.keys);
  }

  async removeMany(ids: readonly number[]): Promise<void> {
    const doomed = new Set(ids);
    this.keys = this.keys.filter((key) => !doomed.has(key.id));
    persist(this.keys);
  }

  async setStatus(id: number, status: KeyStatus): Promise<void> {
    this.keys = this.keys.map((key) =>
      key.id === id ? { ...key, status, updatedAt: nowSqliteTimestamp() } : key,
    );
    persist(this.keys);
  }

  async setStatusMany(ids: readonly number[], status: KeyStatus): Promise<void> {
    if (ids.length === 0) return;

    const objetivo = new Set(ids);
    const ahora = nowSqliteTimestamp();

    this.keys = this.keys.map((key) =>
      objetivo.has(key.id) ? { ...key, status, updatedAt: ahora } : key,
    );
    persist(this.keys);
  }

  async giftMany(entries: readonly { id: number; giftedTo: string }[]): Promise<void> {
    if (entries.length === 0) return;

    const porId = new Map(entries.map((entry) => [entry.id, entry.giftedTo]));
    const ahora = nowSqliteTimestamp();

    this.keys = this.keys.map((key) =>
      porId.has(key.id)
        ? { ...key, status: KeyStatus.Gifted, giftedTo: porId.get(key.id) ?? null, updatedAt: ahora }
        : key,
    );
    persist(this.keys);
  }

  async setTagsMany(ids: readonly number[], tags: readonly string[]): Promise<void> {
    if (ids.length === 0) return;

    const objetivo = new Set(ids);
    const ahora = nowSqliteTimestamp();

    this.keys = this.keys.map((key) =>
      objetivo.has(key.id) ? { ...key, tags: [...tags], updatedAt: ahora } : key,
    );
    persist(this.keys);
  }

  /**
   * Etiquetas distintas por clave.
   *
   * Aqui la atomicidad sale gratis —el `map` construye la lista entera y
   * solo se asigna si ha salido bien—; en SQLite hace falta la transaccion
   * de verdad. Se escribe en esa forma para que las dos implementaciones
   * hagan lo mismo aunque una no pueda transaccionarse.
   */
  async setTagsForKeys(
    asignaciones: readonly { id: number; tags: readonly string[] }[],
  ): Promise<void> {
    if (asignaciones.length === 0) return;

    const porId = new Map(asignaciones.map((a) => [a.id, a.tags]));
    const ahora = nowSqliteTimestamp();

    this.keys = this.keys.map((key) => {
      const tags = porId.get(key.id);

      return tags === undefined ? key : { ...key, tags: [...tags], updatedAt: ahora };
    });

    persist(this.keys);
  }

  async markUsed(id: number, usedAt?: string): Promise<void> {
    const stamp = usedAt ?? nowSqliteTimestamp();
    this.keys = this.keys.map((key) =>
      key.id === id ? { ...key, lastUsedAt: stamp, updatedAt: stamp } : key,
    );
    persist(this.keys);
  }

  async findByKey(keyValue: string): Promise<IGameKey | null> {
    const fingerprint = keyFingerprint(keyValue);
    return this.keys.find((key) => keyFingerprint(key.keyValue) === fingerprint) ?? null;
  }

  async countAll(): Promise<number> {
    return this.keys.length;
  }

  async listKeyValues(): Promise<readonly string[]> {
    return this.keys.map((key) => key.keyValue);
  }

  async importRows(rows: readonly IImportRow[]): Promise<IImportSummary> {
    const existing = new Set(this.keys.map((key) => keyFingerprint(key.keyValue)));
    let inserted = 0;
    let alreadyInDb = 0;
    const now = nowSqliteTimestamp();

    for (const row of rows) {
      const fingerprint = keyFingerprint(row.keyValue);
      if (existing.has(fingerprint)) {
        alreadyInDb += 1;
        continue;
      }
      existing.add(fingerprint);

      this.keys.push({
        id: nextId(),
        title: row.title,
        keyValue: row.keyValue,
        platform: row.platform as KeyPlatform,
        status: row.status as KeyStatus,
        source: row.source as KeySource,
        giftedTo: row.giftedTo,
        parentTitle: row.parentTitle,
        note: row.note,
        tags: parseTags(row.tags),
        addedOn: row.addedOn,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      inserted += 1;
    }

    persist(this.keys);

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

/**
 * Clave de `localStorage` de las claves.
 *
 * Sale de `STORAGE_KEY_PREFIX` y no esta escrita a mano: `memory-database.client`
 * guarda los ajustes en `steam-keys:settings` y aqui las claves en
 * `steam-keys:memory-repository`, y el prefijo tenia que cambiar en los dos a
 * la vez. Los datos ya guardados con la escritura anterior se siguen leyendo:
 * el valor es identico.
 */
const STORAGE_KEY = `${STORAGE_KEY_PREFIX}:memory-repository`;

function loadFromStorage(): IGameKey[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IGameKey[]) : [];
  } catch {
    return [];
  }
}

function persist(keys: readonly IGameKey[]): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Cuotasuperada o modo privado: la app sigue funcionando en memoria.
  }
}

function nextId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

/** Tags en texto plano, reutilizado por el exportador. */
export { serializeTags };