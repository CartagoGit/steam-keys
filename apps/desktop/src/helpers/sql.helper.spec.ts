import { describe, expect, test } from 'bun:test';

import { sqlPlaceholders } from './sql.helper';

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