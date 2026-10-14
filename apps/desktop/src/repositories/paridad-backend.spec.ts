import { afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { KeyPlatform, KeyStatus, type IDatabaseClient, type IGameKeyDraft, type IGameKeyRepository } from '@/contracts';
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

  test('las dos guardan el titulo y rechazan la etiqueta repetida', async () => {
    const montados = await montarLosDos();

    limpiar = montados.limpiar;

    const titulo = async (
      repo: IGameKeyRepository,
      nombre: string,
    ): Promise<string | undefined> =>
      (await repo.listTags()).find((f) => f.nombre === nombre)?.titulo;

    for (const repo of [montados.memoria, montados.sqlite]) {
      await repo.createTag('dlc', '', 'DLC');
    }

    expect(await titulo(montados.memoria, 'dlc')).toBe('DLC');
    expect(await titulo(montados.sqlite, 'dlc')).toBe('DLC');

    /*
     * El rechazo es lo que convierte el titulo en algo trustworthy: si crear
     * dos veces la misma etiqueta devolviera «hecho» en los dos casos, el
     * aviso de «ya existe» —que es lo que impide tener «dlc» y «DLC» en el
     * catalogo— dependeria de que un(repository) se acuerde. Y el `false` es
     * la unica forma de saberlo sin una consulta previa que deja hueco para
     * que otra peticion cree la misma entre medias.
     */
    expect(await montados.memoria.createTag('dlc', '', 'dlc')).toBe(false);
    expect(await montados.sqlite.createTag('dlc', '', 'dlc')).toBe(false);

    // Y el titulo del que ya estaba sigue intacto.
    expect(await titulo(montados.memoria, 'dlc')).toBe('DLC');
    expect(await titulo(montados.sqlite, 'dlc')).toBe('DLC');
  });

  test('renombrar solo la caja no toca las claves en ninguna de las dos', async () => {
    const montados = await montarLosDos();

    limpiar = montados.limpiar;

    for (const repo of [montados.memoria, montados.sqlite]) {
      await repo.createTag('dlc');
      await repo.renameTag('dlc', 'dlc', 'DLC');
    }

    const titulos = await Promise.all(
      [montados.memoria, montados.sqlite].map(async (repo) =>
        (await repo.listTags()).find((f) => f.nombre === 'dlc')?.titulo,
      ),
    );

    expect(titulos).toEqual(['DLC', 'DLC']);
  });
});