import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { operationFrom } from '../../dev-bridge.contract';

/**
 * Tests del puente de desarrollo.
 *
 * Lo que se comprueba aqui no es la base de datos real, sino lo que el puente
 * hace con una base de datos temporal: que devuelve filas, que ejecuta
 * escrituras y que rechaza peticiones mal formadas sin dejar nada a medias.
 *
 * Ninguna clave real aparece en este fichero.
 */

/** Crea una base de datos aislada con el esquema de la app. */
function crearBdTemporal(schema: readonly string[]): {
  ruta: string;
  limpiar: () => void;
} {
  const dir = mkdtempSync(join(tmpdir(), 'steam-keys-bridge-'));
  const ruta = join(dir, 'test.db');

  const db = new Database(ruta, { create: true });
  for (const sentencia of schema) db.run(sentencia);
  db.close();

  return { ruta, limpiar: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Las mismas sentencias que aplica la app, en miniatura. */
const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS game_keys (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     title        TEXT    NOT NULL,
     key_value    TEXT    NOT NULL,
     platform     TEXT    NOT NULL DEFAULT 'steam',
     status       TEXT    NOT NULL DEFAULT 'available',
     source       TEXT    NOT NULL DEFAULT 'manual',
     gifted_to    TEXT    NULL,
     parent_title TEXT    NULL,
     note         TEXT    NULL,
     tags         TEXT    NOT NULL DEFAULT '',
     added_on     TEXT    NULL,
     last_used_at TEXT    NULL,
     created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
     updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_game_keys_key_value
     ON game_keys (key_value);`,
];

describe('operaciones del puente', () => {
  test('la operacion se deduce de la URL', () => {
    expect(operationFrom('/__dev-bridge__/sql?op=exec')).toBe('exec');
    expect(operationFrom('/__dev-bridge__/sql?op=select')).toBe('select');
  });

  test('una operacion desconocida se rechaza en vez de degradarse', () => {
    // No hay una operacion por defecto: `?op=drop` tiene que fallar de forma
    // visible, no ejecutarse como si fuera otra cosa.
    expect(operationFrom('/__dev-bridge__/sql')).toBeNull();
    expect(operationFrom('/__dev-bridge__/sql?op=drop')).toBeNull();
    expect(operationFrom('/__dev-bridge__/sql?op=')).toBeNull();
    expect(operationFrom('/__dev-bridge__/sql?op=dump')).toBeNull();
  });
});

describe('el puente opera sobre una base de datos real', () => {
  test('una consulta devuelve las filas que pide', async () => {
    const { ruta, limpiar } = crearBdTemporal(ESQUEMA);

    try {
      const db = new Database(ruta, { create: true });
      db.run(
        `INSERT INTO game_keys (title, key_value, status) VALUES ($1, $2, $3)`,
        ['Celeste', 'MQ7RT-29XKL-ZPN84', 'available'],
      );
      db.run(
        `INSERT INTO game_keys (title, key_value, status) VALUES ($1, $2, $3)`,
        ['Hollow Knight', 'B4KMD-58RQW-LNCT3', 'gifted'],
      );
      db.close();

      // El script se ejecuta como proceso aparte, igual que haria Vite.
      const peticion = JSON.stringify({
        sql: 'SELECT title FROM game_keys ORDER BY id',
        binds: [],
      });

      const salida = await ejecutarBridge(ruta, 'select', peticion);
      const datos = JSON.parse(salida) as {
        ok: boolean;
        rows: Array<{ title: string }>;
      };

      expect(datos.ok).toBe(true);
      expect(datos.rows).toHaveLength(2);
      expect(datos.rows.map((fila) => fila.title).sort()).toEqual([
        'Celeste',
        'Hollow Knight',
      ]);
    } finally {
      limpiar();
    }
  });

  test('una escritura informa de las filas afectadas', async () => {
    const { ruta, limpiar } = crearBdTemporal(ESQUEMA);

    try {
      const peticion = JSON.stringify({
        sql: `INSERT INTO game_keys (title, key_value, status) VALUES ($1, $2, $3)`,
        binds: ['Grim Dawn', 'N8VQP-3KLMR-7XWZY', 'available'],
      });

      const salida = await ejecutarBridge(ruta, 'exec', peticion);
      const datos = JSON.parse(salida) as { ok: boolean; rowsAffected: number };

      expect(datos.ok).toBe(true);
      expect(datos.rowsAffected).toBe(1);
    } finally {
      limpiar();
    }
  });

  test('el indice unico hace que una clave repetida no se inserte dos veces', async () => {
    const { ruta, limpiar } = crearBdTemporal(ESQUEMA);

    try {
      const peticion = JSON.stringify({
        sql: `INSERT OR IGNORE INTO game_keys (title, key_value, status) VALUES ($1, $2, $3)`,
        binds: ['Celeste', 'MQ7RT-29XKL-ZPN84', 'available'],
      });

      await ejecutarBridge(ruta, 'exec', peticion);
      const segunda = await ejecutarBridge(ruta, 'exec', peticion);

      const datos = JSON.parse(segunda) as { rowsAffected: number };
      expect(datos.rowsAffected).toBe(0);
    } finally {
      limpiar();
    }
  });

  test('una peticion sin SQL se rechaza sin tocar nada', async () => {
    const { ruta, limpiar } = crearBdTemporal(ESQUEMA);

    try {
      const salida = await ejecutarBridge(ruta, 'exec', JSON.stringify({ binds: [] }));
      const datos = JSON.parse(salida) as { ok: boolean; error?: string };

      expect(datos.ok).toBe(false);
      expect(datos.error).toContain('SQL');
    } finally {
      limpiar();
    }
  });

  test('un SELECT devuelve filas y no las modifica', async () => {
    const { ruta, limpiar } = crearBdTemporal(ESQUEMA);

    try {
      const db = new Database(ruta, { create: true });
      db.run(
        `INSERT INTO game_keys (title, key_value, status) VALUES ($1, $2, $3)`,
        ['Celeste', 'MQ7RT-29XKL-ZPN84', 'available'],
      );
      db.close();

      const peticion = JSON.stringify({
        sql: 'SELECT id, title FROM game_keys WHERE status = $1',
        binds: ['available'],
      });

      const salida = await ejecutarBridge(ruta, 'select', peticion);
      const datos = JSON.parse(salida) as { ok: boolean; rows: unknown[] };

      expect(datos.ok).toBe(true);
      expect(datos.rows).toHaveLength(1);
    } finally {
      limpiar();
    }
  });

  test('abrir en solo lectura no puede escribir', async () => {
    const { ruta, limpiar } = crearBdTemporal(ESQUEMA);

    try {
      const peticion = JSON.stringify({
        sql: `INSERT INTO game_keys (title, key_value, status) VALUES ($1, $2, $3)`,
        binds: ['X', 'AAAAA-BBBBB-CCCCC', 'available'],
      });

      // Con la opcion `select` la base se abre en solo lectura.
      const salida = await ejecutarBridge(ruta, 'select', peticion);
      const datos = JSON.parse(salida) as { ok: boolean };

      expect(datos.ok).toBe(false);
    } finally {
      limpiar();
    }
  });
});

/**
 * Ejecuta el puente contra una base de datos concreta.
 *
 * El script lee `STEAM_KEYS_DB_PATH` para saber que fichero abrir, asi que los
 * tests nunca tocan la base de datos real. Se invoca como proceso aparte, que
 * es exactamente lo que hara el middleware de Vite.
 */
async function ejecutarBridge(
  rutaBd: string,
  operacion: string,
  entrada: string,
): Promise<string> {
  const hijo = Bun.spawn(['bun', 'run', SCRIPT, operacion], {
    env: { ...process.env, STEAM_KEYS_DB_PATH: rutaBd },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // El stdin tiene que cerrarse, o el script se queda esperando la entrada.
  hijo.stdin.write(entrada);
  hijo.stdin.end();

  // `stdout` es un ReadableStream: se consume con `Response`.
  const salida = await new Response(hijo.stdout).text();
  const errores = await new Response(hijo.stderr).text();

  return salida.length > 0 ? salida : JSON.stringify({ ok: false, error: errores || 'sin salida' });
}

/** Ruta al script del puente. */
const SCRIPT = join(
  import.meta.dir,
  '..',
  '..',
  '..',
  '..',
  'tools',
  'scripts',
  'dev-bridge.serve.ts',
);