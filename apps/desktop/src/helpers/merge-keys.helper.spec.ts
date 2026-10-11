import { describe, expect, test } from 'bun:test';

import { mergeKeysFromBackup } from './merge-keys.helper';
import { KeyPlatform, KeySource, KeyStatus, RestoreMode, type IDatabaseClient, type IGameKeyRow } from '@/contracts';

/**
 * Cliente falso que responde a las dos consultas que usa la fusion.
 *
 * Basta para ejercitar la logica sin levantar Tauri ni SQLite.
 */
class FakeDatabase implements IDatabaseClient {
  /** ids asignados a cada clave ya presente. */
  readonly existentes = new Map<string, number>();
  /** Sentencias ejecutadas, para inspeccionar el resultado. */
  readonly inserts: unknown[][] = [];
  readonly updates: unknown[][] = [];

  private nextId = 1;

  constructor(clavesIniciales: readonly string[] = []) {
    for (const clave of clavesIniciales) {
      this.existentes.set(normalizar(clave), this.nextId++);
    }
  }

  async execute(sql: string, bind: readonly unknown[] = []): Promise<number> {
    if (/^\s*INSERT/i.test(sql)) {
      this.inserts.push([...bind]);
      this.existentes.set(normalizar(String(bind[1])), this.nextId++);
      return 1;
    }

    if (/^\s*UPDATE/i.test(sql)) {
      this.updates.push([...bind]);
      return 1;
    }

    return 0;
  }

  async select<T>(sql: string, bind: readonly unknown[] = []): Promise<T[]> {
    if (/FROM game_keys WHERE key_value/i.test(sql)) {
      const clave = normalizar(String(bind[0]));
      const id = this.existentes.get(clave);

      return (id === undefined ? [] : [{ id }]) as T[];
    }

    return [];
  }

  async migrate(): Promise<void> {}

  async close(): Promise<void> {}
}

function normalizar(valor: string): string {
  return valor.trim().toUpperCase();
}

/** Fila de una copia de seguridad. Las claves son sinteticas. */
function fila(overrides: Partial<IGameKeyRow> = {}): IGameKeyRow {
  return {
    id: 1,
    title: 'Celeste',
    key_value: 'MQ7RT-29XKL-ZPN84',
    platform: KeyPlatform.Steam,
    status: KeyStatus.Available,
    source: KeySource.LegacyTxt,
    gifted_to: null,
    parent_title: null,
    note: null,
    tags: '',
    added_on: '2025-01-22',
    last_used_at: null,
    created_at: '2025-01-22 00:00:00',
    updated_at: '2025-01-22 00:00:00',
    ...overrides,
  };
}

describe('restaurar una copia sin perder lo actual', () => {
  test('una clave que no existe se inserta', async () => {
    const db = new FakeDatabase();

    const resumen = await mergeKeysFromBackup(db, [fila()], RestoreMode.Fusionar);

    expect(resumen).toEqual({ total: 1, inserted: 1, skipped: 0, updated: 0 });
    expect(db.inserts).toHaveLength(1);
  });

  test('una clave que ya existe no se toca al fusionar', async () => {
    const db = new FakeDatabase(['mq7rt-29xkl-zpn84']);

    const resumen = await mergeKeysFromBackup(db, [fila()], RestoreMode.Fusionar);

    expect(resumen).toEqual({ total: 1, inserted: 0, skipped: 1, updated: 0 });
    expect(db.inserts).toHaveLength(0);
    expect(db.updates).toHaveLength(0);
  });

  test('al sobrescribir, la clave existente vuelve a su estado de la copia', async () => {
    const db = new FakeDatabase(['mq7rt-29xkl-zpn84']);

    const resumen = await mergeKeysFromBackup(
      db,
      [fila({ status: KeyStatus.Gifted })],
      RestoreMode.Sobrescribir,
    );

    expect(resumen).toEqual({ total: 1, inserted: 0, skipped: 0, updated: 1 });
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0]?.[2]).toBe(KeyStatus.Gifted);
  });

  test('fusionar nunca borra: el total no puede bajar', async () => {
    const db = new FakeDatabase(['mq7rt-29xkl-zpn84']);

    await mergeKeysFromBackup(db, [fila()], RestoreMode.Fusionar);

    expect(db.existentes.size).toBe(1);
  });

  test('la comparacion de claves ignora mayusculas y espacios', async () => {
    const db = new FakeDatabase(['  mq7rt-29xkl-zpn84 ']);

    const resumen = await mergeKeysFromBackup(
      db,
      [fila({ key_value: 'MQ7RT-29XKL-ZPN84' })],
      RestoreMode.Fusionar,
    );

    expect(resumen.inserted).toBe(0);
    expect(resumen.skipped).toBe(1);
  });

  test('mezcla de nuevas y existentes', async () => {
    const db = new FakeDatabase(['MQ7RT-29XKL-ZPN84']);

    const resumen = await mergeKeysFromBackup(
      db,
      [
        fila({ key_value: 'MQ7RT-29XKL-ZPN84' }),
        fila({ key_value: 'B4KMD-58RQW-LNCT3', title: 'Hollow Knight' }),
        fila({ key_value: 'ZR92N-7JDMK-QPW45', title: 'Grim Dawn' }),
      ],
      RestoreMode.Sobrescribir,
    );

    expect(resumen).toEqual({ total: 3, inserted: 2, skipped: 0, updated: 1 });
    expect(db.existentes.size).toBe(3);
  });

  test('se conservan los campos del DLC y del destinatario', async () => {
    const db = new FakeDatabase();

    await mergeKeysFromBackup(
      db,
      [
        fila({
          title: 'Cities Skylines Snowfall',
          parent_title: 'Cities Skylines',
          gifted_to: 'Olga',
          note: 'Humble Choice',
          tags: 'dlc,humble',
        }),
      ],
      RestoreMode.Fusionar,
    );

    // Orden del INSERT: title, key, platform, status, source, gifted_to,
    // parent_title, note, tags, added_on, last_used_at, created_at.
    const inserted = db.inserts[0] ?? [];
    expect(inserted[0]).toBe('Cities Skylines Snowfall');
    expect(inserted[5]).toBe('Olga');
    expect(inserted[6]).toBe('Cities Skylines');
    expect(inserted[7]).toBe('Humble Choice');
    expect(inserted[8]).toBe('dlc,humble');
  });

  test('una copia vacia no rompe nada', async () => {
    const db = new FakeDatabase(['MQ7RT-29XKL-ZPN84']);

    const resumen = await mergeKeysFromBackup(db, [], RestoreMode.Fusionar);

    expect(resumen).toEqual({ total: 0, inserted: 0, skipped: 0, updated: 0 });
    expect(db.inserts).toHaveLength(0);
  });
});