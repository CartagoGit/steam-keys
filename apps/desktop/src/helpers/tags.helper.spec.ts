import { describe, expect, test } from 'bun:test';

import { contarUsos, sortTags } from './tags.helper';
import type { ITag } from '@/contracts';

/**
 * Tests del orden del catalogo de etiquetas.
 *
 * El criterio es fijo a proposito: las mas usadas primero, y a igualdad de
 * usos el nombre, para que la lista no se reordene sola entre recargas. Una
 * lista que baila al abrirla obliga a buscar de nuevo lo que ya estaba a la
 * vista.
 */

/** Catalogue ya ordenado, como lo devuelve el repositorio. */
function catalogo(...nombres: string[]): ITag[] {
  return nombres.map((nombre) => ({ nombre, usos: 0 }));
}

describe('ordenar el catalogo de etiquetas', () => {
  test('las etiquetas mas usadas van primero', () => {
    const orden = sortTags([
      { nombre: 'dlc', usos: 1 },
      { nombre: 'contexto', usos: 40 },
      { nombre: 'humble', usos: 12 },
    ]);

    expect(orden.map((t) => t.nombre)).toEqual(['contexto', 'humble', 'dlc']);
  });

  test('a igual de usos manda el nombre, para que la lista no se mueva', () => {
    const orden = sortTags([
      { nombre: 'zeta', usos: 7 },
      { nombre: 'alfa', usos: 7 },
      { nombre: 'medio', usos: 7 },
    ]);

    expect(orden.map((t) => t.nombre)).toEqual(['alfa', 'medio', 'zeta']);
  });

  test('un catalogo vacio se devuelve tal cual', () => {
    expect(sortTags([])).toEqual([]);
  });
});

describe('contar los usos de cada etiqueta', () => {
  test('cuenta una vez por clave, no por repeticion', () => {
    // Una clave con «contexto,contexto» tiene un uso, no dos: el numero que se
    // muestra al lado de la etiqueta es de claves, no de veces escrita.
    const usos = contarUsos([
      ['contexto', 'contexto', 'dlc'],
      ['contexto'],
      [],
    ]);

    expect(usos.get('contexto')).toBe(2);
    expect(usos.get('dlc')).toBe(1);
  });

  test('las claves sin etiquetas no cuentan para nadie', () => {
    const usos = contarUsos([[], []]);

    expect(usos.size).toBe(0);
  });

  test('sin claves el conteo viene vacio, no con ceros', () => {
    expect(contarUsos([]).size).toBe(0);
  });

  test('las etiquetas que aun no estan en el catalogo tambien salen', () => {
    // Este es el caso que hace util el helper: una clave puede llevar una
    // etiqueta que nadie ha guardado en el catalogo, y al montar el catalogo
    // tiene que aparecer con el numero de usos correcto o se veria con un
    // cero al lado y nadie la elegiria.
    const usos = contarUsos([
      ['contexto'],
      ['contexto'],
      ['nueva'],
    ]);

    expect(usos.get('contexto')).toBe(2);
    expect(usos.get('nueva')).toBe(1);
    expect(catalogo('contexto').map((t) => t.nombre)).toEqual(['contexto']);
  });
});