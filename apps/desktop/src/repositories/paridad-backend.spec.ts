import { afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { KeyPlatform, KeyStatus, type IDatabaseClient, type IGameKeyDraft } from '@/contracts';
import { MemoryGameKeyRepository } from '@/repositories/memory-game-key.repository';
import { SqliteGameKeyRepository } from '@/repositories/sqlite-game-key.repository';
import { crearEsquema } from '@/repositories/crear-esquema.repository';

/**
 * Los dos repositorios tienen que contar la misma historia.
 *
 * `MemoryGameKeyRepository` existe para poder trabajar la interfaz en el
 * navegador sin Tauri. Para que sirva de algo tiene que comportarse como el de
 * SQLite, y hasta ahora no lo hacia: devolvia las claves en otro orden —solo
 * por titulo, sin la fecha que usa SQLite—, yia al catalogo de etiquetas lo
 * guardaba **sin normalizar**, que es justo el fallo que SQLite ya tiene
 * corregido: «Cumplidos» y «cumplidos» acababan siendo dos entradas y la mitad
 * de los botones no hacian nada.
 *
 * Los dos fallos eran silenciosos: ninguna consulta fallaba y nada se quejaba
 * por consola. Solo se notaba mirando el navegador, y no siempre.
 *
 * Por eso los mismos datos se meten en los dos y se compara lo que devuelven.
 */

/** Las mismas claves para los dos, con las trampas de orden incluidas. */
function clavesDePrueba(): readonly IGameKeyDraft[] {
  return [
    {
      title: 'Portal',
      keyValue: 'AAAA-1111',
      platform: KeyPlatform.Steam,
      status: KeyStatus.Redeemed,
      tags: ['Cumplidos', 'Navidad'],
      addedOn: '2026-01-05 10:00:00',
      giftedTo: null,
      parentTitle: null,
      note: null,
    },
    {
      title: 'Dead Space 2',
      keyValue: 'AAAA-2222',
      platform: KeyPlatform.Steam,
      status: KeyStatus.Available,
      tags: ['cumplidos', 'Oferta'],
      addedOn: '2026-03-01 10:00:00',
      giftedTo: null,
      parentTitle: null,
      note: null,
    },
    {
      title: 'Alan Wake 2',
      keyValue: 'AAAA-3333',
      platform: KeyPlatform.Steam,
      status: KeyStatus.Available,
      tags: ['cumplidos'],
      addedOn: '2026-02-10 10:00:00',
      giftedTo: null,
      parentTitle: null,
      note: null,
    },
  ];
}

/** El `IDatabaseClient` mas pequeño que sirve para talking con SQLite. */
function clienteDePrueba(db: Database): IDatabaseClient {
  return {
    select: async <T>(sql: string, bind: readonly unknown[] = []) =>
      db.query(sql).all(...(bind as never[])) as T[],
    execute: async (sql: string, bind: readonly unknown[] = []) =>
      Number(db.run(sql, bind as never[]).changes),
    migrate: async () => Promise.resolve(),
    transaccion: async <T>(fn: () => Promise<T>) => fn(),
    close: async () => Promise.resolve(),
  };
}

/** Levanta los dos repositorios con la misma coleccion dentro. */
async function montarLosDos(): Promise<{
  memoria: MemoryGameKeyRepository;
  sqlite: SqliteGameKeyRepository;
  limpiar: () => void;
}> {
  const dir = mkdtempSync(join(tmpdir(), 'steam-keys-paridad-'));
  const db = new Database(join(dir, 'paridad.db'), { create: true });

  await crearEsquema(clienteDePrueba(db));

  const sqlite = new SqliteGameKeyRepository(clienteDePrueba(db));
  const memoria = new MemoryGameKeyRepository();

  for (const clave of clavesDePrueba()) {
    await sqlite.insert(clave);
    await memoria.insert(clave);
  }

  return {
    memoria,
    sqlite,
    limpiar: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe('memoria y SQLite cuentan lo mismo', () => {
  let limpiar: (() => void) | null = null;

  afterEach(() => {
    limpiar?.();
    limpiar = null;
  });

  test('las claves salen en el mismo orden', async () => {
    const montados = await montarLosDos();

    limpiar = montados.limpiar;

    const enMemoria = (await montados.memoria.listAll()).map((clave) => clave.title);
    const enSqlite = (await montados.sqlite.listAll()).map((clave) => clave.title);

    expect(enMemoria).toEqual(enSqlite);
  });

  test('el catalogo guarda una sola entrada por etiqueta', async () => {
    const montados = await montarLosDos();

    limpiar = montados.limpiar;

    await montados.sqlite.syncTagsFromKeys(await montados.sqlite.listAll());
    await montados.memoria.syncTagsFromKeys(await montados.memoria.listAll());

    const enMemoria = (await montados.memoria.listTags()).map((f) => f.nombre).sort();
    const enSqlite = (await montados.sqlite.listTags()).map((f) => f.nombre).sort();

    /*
     * Las tres claves llevan la misma etiqueta escrita de tres maneras:
     * «Cumplidos», «cumplidos» y «Cumplidos». El catalogo tiene que tener
     * **una** fila, no tres. Sin normalizar, el navegador las guardaba tal cual
     * y luego ni el filtro ni el boton de borrar las encontraba.
     */
    expect(enMemoria).toEqual(enSqlite);
    expect(enMemoria.filter((nombre) => nombre === 'cumplidos')).toHaveLength(1);
  });
});