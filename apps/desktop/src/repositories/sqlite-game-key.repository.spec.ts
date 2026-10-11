import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SqliteGameKeyRepository } from './sqlite-game-key.repository';
import { KeyPlatform, KeySource, KeyStatus, SCHEMA_STATEMENTS, type IDatabaseClient } from '@/contracts';

/**
 * Tests del repositorio de claves contra un SQLite de verdad.
 *
 * Aqui no se comprueba que el codigo llame a la sentencia que quiere, sino
 * lo que queda escrito en la base de datos. Es la unica forma de cazar los
 * errores de `bind`: una sentencia puede tener la forma perfecta y aun asi
 * guardar el valor equivocado si los indices no cuadran, y eso no se ve leyendo
 * el SQL.
 */

/** Repositorio sobre una base de datos temporal, con el esquema de la app. */
function crearRepositorio(): {
  repo: SqliteGameKeyRepository;
  db: IDatabaseClient;
  leer: (sql: string) => unknown[];
  limpiar: () => void;
} {
  const dir = mkdtempSync(join(tmpdir(), 'steam-keys-repo-'));
  const sqlite = new Database(join(dir, 'test.db'), { create: true });

  for (const sentencia of SCHEMA_STATEMENTS) sqlite.run(sentencia);

  const db: IDatabaseClient = {
    async execute(sql, bind = []) {
      const resultado = sqlite.run(sql, [...bind] as never[]);

      return Number(resultado.changes);
    },
    async select<T>(sql: string, bind: readonly unknown[] = []) {
      return sqlite.query(sql).all(...(bind as never[])) as T[];
    },
    async migrate() {
      for (const sentencia of SCHEMA_STATEMENTS) sqlite.run(sentencia);
    },
    async close() {
      sqlite.close();
    },
  };

  return {
    repo: new SqliteGameKeyRepository(db),
    db,
    leer: (sql) => sqlite.query(sql).all(),
    limpiar: () => {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Una marca de tiempo de SQLite tiene forma `AAAA-MM-DD HH:MM:SS`. */
const ES_SELLO = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

describe('cambiar el estado de varias claves a la vez', () => {
  test('updated_at recibe una fecha, no el estado', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.importRows([
        fila('AAAA-1111-AAAA'),
        fila('BBBB-2222-BBBB'),
        fila('CCCC-3333-CCCC'),
      ]);

      await repo.setStatusMany(
        [1, 2, 3],
        KeyStatus.Gifted,
      );

      const filas = leer(
        'SELECT status, updated_at FROM game_keys ORDER BY id',
      ) as { status: string; updated_at: string }[];

      expect(filas.length).toBe(3);

      for (const fila of filas) {
        expect(fila.status).toBe(KeyStatus.Gifted);

        // Este es el fallo que se cuela: si `updated_at` comparte el bind con
        // `status`, la columna acaba guardando `gifted` y la clave queda con
        // una fecha de modificacion que no existe.
        expect(fila.updated_at).toMatch(ES_SELLO);
      }
    } finally {
      limpiar();
    }
  });

  test('deja fuera las claves que no estan en la lista', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.importRows([
        fila('AAAA-1111-AAAA'),
        fila('BBBB-2222-BBBB'),
        fila('CCCC-3333-CCCC'),
      ]);

      await repo.setStatusMany([1, 3], KeyStatus.Redeemed);

      const estados = leer('SELECT id, status FROM game_keys ORDER BY id') as {
        id: number;
        status: string;
      }[];

      expect(estados.map((fila) => fila.status)).toEqual([
        KeyStatus.Redeemed,
        KeyStatus.Available,
        KeyStatus.Redeemed,
      ]);
    } finally {
      limpiar();
    }
  });

  test('una lista vacia no toca nada', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.importRows([fila('AAAA-1111-AAAA')]);
      const antes = leer('SELECT updated_at FROM game_keys') as { updated_at: string }[];

      await repo.setStatusMany([], KeyStatus.Gifted);

      const despues = leer('SELECT updated_at FROM game_keys') as { updated_at: string }[];

      expect(despues).toEqual(antes);
    } finally {
      limpiar();
    }
  });
});

describe('regalar varias claves a la vez', () => {
  // Aqui no hay tests de `giftMany` a proposito, y el motivo merece explicarse
  // porque es justo la trampa que hace escribir un test que miente.
  //
  // `giftMany` arma un `CASE` con un destinatario por clave. Para eso la
  // sentencia necesita marcadores `$1`, `$2`... numerados, que es lo que habla
  // el motor de verdad: sqlx, en Rust.
  //
  // Pero `bun:sqlite` **cuenta esos marcadores mal**. Con seis marcadores
  // numerados distintos y siete valores responde `expected 6 values, received
  // 7`; y cuando el numero si coincide, enlaza los valores al reves y actualiza
  // cero filas sin decir nada. Se comprobo aislando el SQL.
  //
  // Un test aqui, entonces, no comprobaria el codigo: comprobaria que
  // `bun:sqlite` se equivoca. Pasaria con el bug puesto y fallaria con el
  // codigo bien, que es peor que no tener ninguno.
  //
  // Lo que si es comprobable son los indices, y se comprueba mas abajo en
  // `sql.helper.spec.ts`: esa es la parte que falla en silencio de verdad, y la
  // que motivo los errores de `setStatusMany` y `setTagsMany`.
});

describe('el estado y la plataforma por defecto', () => {
  test('una clave nueva nace con la plataforma declarada en el enum', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      const creada = await repo.insert({ title: 'Half Life', keyValue: 'aaaa-1111-aaaa' });

      const filas = leer('SELECT platform, status FROM game_keys') as {
        platform: string;
        status: string;
      }[];

      expect(creada.platform).toBe(KeyPlatform.Steam);
      expect(filas[0]?.platform).toBe(KeyPlatform.Steam);
      expect(filas[0]?.status).toBe(KeyStatus.Available);
    } finally {
      limpiar();
    }
  });

  test('el sello de actualizacion es una fecha, no el estado', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.importRows([fila('AAAA-1111-AAAA')]);
      await repo.setStatus(1, KeyStatus.Redeemed);

      const filas = leer('SELECT updated_at FROM game_keys') as { updated_at: string }[];

      expect(filas[0]?.updated_at).toMatch(ES_SELLO);
    } finally {
      limpiar();
    }
  });

  test('cambiar las etiquetas a la vez tampoco rompe el sello', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.importRows([fila('AAAA-1111-AAAA'), fila('BBBB-2222-BBBB')]);
      await repo.setTagsMany([1, 2], ['regalo', 'verano']);

      const filas = leer('SELECT tags, updated_at FROM game_keys ORDER BY id') as {
        tags: string;
        updated_at: string;
      }[];

      expect(filas.map((fila) => fila.tags)).toEqual(['regalo,verano', 'regalo,verano']);
      expect(filas[0]?.updated_at).toMatch(ES_SELLO);
    } finally {
      limpiar();
    }
  });
});

/** Fila de importacion minima, con el estado ya disponible. */
function fila(keyValue: string) {
  return {
    title: 'Juego de prueba',
    keyValue,
    platform: KeyPlatform.Steam,
    status: KeyStatus.Available,
    source: KeySource.Manual,
    giftedTo: null,
    parentTitle: null,
    note: null,
    tags: '',
    addedOn: null,
  };
}