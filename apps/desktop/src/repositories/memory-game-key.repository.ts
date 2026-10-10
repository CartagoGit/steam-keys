import { KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KeySource } from '@/contracts/enums/key-source.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { keyFingerprint, serializeTags } from '@/helpers/normalize-text.helper';
import { nowSqliteTimestamp } from '@/helpers/format-date.helper';
import type { IGameKeyRepository } from '@/contracts/interfaces/database.interface';
import type {
  IGameKey,
  IGameKeyDraft,
  IGameKeyInput,
} from '@/contracts/interfaces/game-key.interface';
import type {
  IImportRow,
  IImportSummary,
} from '@/contracts/interfaces/import-summary.interface';

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
      keyValue: input.keyValue.trim().toUpperCase(),
      platform: input.platform ?? KeyPlatform.Steam,
      status: input.status ?? KeyStatus.Available,
      source: KeySource.Manual,
      giftedTo: input.giftedTo ?? null,
      parentTitle: input.parentTitle ?? null,
      note: input.note ?? null,
      tags: input.tags ?? [],
      addedOn: input.addedOn ?? null,
      lastUsedAt: null,
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
      keyValue: draft.keyValue.trim().toUpperCase(),
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
        tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
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

const STORAGE_KEY = 'steam-keys:memory-repository';

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