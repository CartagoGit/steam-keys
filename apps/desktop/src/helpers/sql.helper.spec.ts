import { describe, expect, test } from 'bun:test';

import { sqlPlaceholders, gameKeyInsertStatement } from './sql.helper';
import {
  GAME_KEY_COLUMNS,
  GAME_KEY_INSERT_SIZE,
  GAME_KEY_WRITE_COLUMNS,
} from './map-row.helper';

/**
 * Tests de los marcadores de posicion de SQL.
 *
 * Se prueban solos, sin base de datos, porque lo que sale de aqui son
 * **cadenas**. Esa es justo la parte que falla sin avisar: dos listas de
 * marcadores en la misma sentencia pueden pisarse, y SQLite no protesta,
 * simplemente enlaza los valores al reves y actualiza las filas equivocadas.
 *
 * Los dos bugs reales que motivo esto se los puede reprobar a mano bajando el
 * `primero` de un `3` a un `2` en `setTagsMany` y `setStatusMany`.
 */

describe('marcadores para un IN', () => {
  test('empiezan en el 1 por defecto', () => {
    expect(sqlPlaceholders(3)).toBe('$1, $2, $3');
  });

  test('siguen donde toca cuando ya hay valores fijos delante', () => {
    expect(sqlPlaceholders(3, 3)).toBe('$3, $4, $5');
    expect(sqlPlaceholders(2, 2)).toBe('$2, $3');
  });

  test('uno solo no lleva coma', () => {
    expect(sqlPlaceholders(1)).toBe('$1');
    expect(sqlPlaceholders(1, 5)).toBe('$5');
  });

  test('ninguno no deja un IN vacio', () => {
    expect(sqlPlaceholders(0)).toBe('');
  });

  test('no repite ni se salta numeros', () => {
    const numeros = sqlPlaceholders(6, 4)
      .split(', ')
      .map((m) => Number(m.replace('$', '')));

    expect(numeros).toEqual([4, 5, 6, 7, 8, 9]);
    expect(new Set(numeros).size).toBe(numeros.length);
  });
});

describe('el INSERT de game_keys', () => {
  const columnas = (sql: string): string[] =>
    sql.slice(sql.indexOf('('), sql.indexOf('VALUES')).replace(/[()\s]/g, '').split(',');

  const marcadores = (sql: string): string[] =>
    sql.slice(sql.indexOf('VALUES') + 'VALUES'.length).replace(/[()\s]/g, '').split(',');

  test('escribe todas las columnas menos el id', () => {
    const sql = gameKeyInsertStatement();

    expect(columnas(sql)).toEqual([...GAME_KEY_WRITE_COLUMNS]);
  });

  test('lleva un marcador por columna, en orden y sin repetir', () => {
    // Un marcador por columna, y cada columna con el suyo. La version anterior
    // repetia `$11` para las dos fechas, que funciona en el alta —donde valen
    // lo mismo— y hacia perder la de modificacion al restaurar una copia.
    const esperados = GAME_KEY_WRITE_COLUMNS.map((_, indice) => `$${indice + 1}`);

    expect(marcadores(gameKeyInsertStatement())).toEqual(esperados);
    expect(marcadores(gameKeyInsertStatement(true))).toEqual(esperados);
  });

  test('la variante que ignora duplicados lleva OR IGNORE', () => {
    expect(gameKeyInsertStatement()).toMatch(/^INSERT INTO game_keys/);
    expect(gameKeyInsertStatement()).not.toContain('OR IGNORE');
    expect(gameKeyInsertStatement(true)).toMatch(/^INSERT OR IGNORE INTO game_keys/);
  });

  test('el numero de marcadores lo dice la lista de columnas, no el codigo', () => {
    // Si el esquema crece, el `VALUES` tiene que crecer con el. Este es el
    // fallo que cuesta un rato de depuracion: una columna de mas en la lista y
    // un valor de menos, y SQLite acepta la sentencia y escribe el valor en la
    // columna equivocada.
    const sql = gameKeyInsertStatement();

    expect(GAME_KEY_INSERT_SIZE).toBe(GAME_KEY_WRITE_COLUMNS.length);
    expect(marcadores(sql).length).toBe(GAME_KEY_INSERT_SIZE);
    expect(columnas(sql).length).toBe(GAME_KEY_INSERT_SIZE);
  });

  test('el SELECT y el INSERT leen de la misma lista de columnas', () => {
    expect(GAME_KEY_COLUMNS).toEqual(['id', ...GAME_KEY_WRITE_COLUMNS].join(', '));
  });
});