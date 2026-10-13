import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { colorDe, contarUsos, sortTags, tonoPorDefecto } from './tags.helper';
import {
  TAG_COLORS,
  TAG_COLOR_CLASS,
  parseTagColor,
  type ITag,
} from '@/contracts';

/** El fichero de las constantes, para comprobar que las clases existen en el codigo. */
const FUENTE_TAG = readFileSync(
  join(new URL('.', import.meta.url).pathname, '../contracts/constants/tag.constants.ts'),
  'utf8',
);

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
  return nombres.map((nombre) => ({ nombre, usos: 0, color: '' }));
}

describe('ordenar el catalogo de etiquetas', () => {
  test('las etiquetas mas usadas van primero', () => {
    const orden = sortTags([
      { nombre: 'dlc', usos: 1, color: '' },
      { nombre: 'contexto', usos: 40, color: '' },
      { nombre: 'humble', usos: 12, color: '' },
    ]);

    expect(orden.map((t) => t.nombre)).toEqual(['contexto', 'humble', 'dlc']);
  });

  test('a igual de usos manda el nombre, para que la lista no se mueva', () => {
    const orden = sortTags([
      { nombre: 'zeta', usos: 7, color: '' },
      { nombre: 'alfa', usos: 7, color: '' },
      { nombre: 'medio', usos: 7, color: '' },
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
/**
 * El color de una etiqueta.
 *
 * Lo que se guarda es el **nombre** del tono, y no se guarda nada cuando no se
 * ha elegido: una etiqueta nueva nace sin color y lo deduce del nombre. Esa
 * deduccion tiene que ser **estable**, porque de eso depende que la misma
 * palabra salga del mismo color en la fila, en el filtro y en el catalogo, y
 * que la lista no se reordene sola entre recargas.
 */
describe('el color de una etiqueta', () => {
  test('sin color elegido sale uno del nombre, y siempre el mismo', () => {
    expect(tonoPorDefecto('dlc')).toBe(tonoPorDefecto('dlc'));
    expect(TAG_COLORS).toContain(tonoPorDefecto('dlc'));
  });

  test('el color elegido manda sobre el deducido', () => {
    expect(colorDe({ nombre: 'dlc', color: '' })).toBe(tonoPorDefecto('dlc'));
    expect(colorDe({ nombre: 'dlc', color: 'danger' })).toBe('danger');
  });

  test('los nombres parecidos no salen todos del mismo color', () => {
    /*
     * Con una suma a secas, «dlc» y «dld» dan el mismo numero y el mismo
     * color, que es justo lo que no puede pasar con dos etiquetas que se leen
     * casi igual. Se comprueba con cuatro porque con dos un fallo asi puede
     * colarse por casualidad.
     */
    const tonos = new Set(['dlc', 'dld', 'dlcs', 'dlca'].map(tonoPorDefecto));

    expect(tonos.size).toBeGreaterThan(1);
  });

  test('el color por defecto es diluido', () => {
    /**
     * Un color entero de salida hace que la fila parezca una tabla de estados y
     * que no se distinga lo que alguien ha marcado a proposito de lo que sale
     * solo. Los diluidos son los que de verdad son etiquetas.
     */
    for (const nombre of ['contexto', 'humble', 'dlc', 'promo', 'para el hermano']) {
      expect(tonoPorDefecto(nombre).endsWith('-soft')).toBe(true);
    }
  });

  test('un color guardado que no existe se trata como sin color', () => {
    // Una base editada a mano puede tener cualquier cosa. No es un error: es
    // una etiqueta sin color, que es lo que se puede pintar.
    expect(parseTagColor('rosa')).toBe('');
    expect(parseTagColor('')).toBe('');
    expect(parseTagColor('  DANGER  ')).toBe('danger');
  });

  test('cada color tiene su relleno, su tinta y su aro', () => {
    /*
     * Los tres van **escritos** en el mapa y no montados con `bg-${tono}`.
     * Tailwind lee el codigo fuente: una clase construida en tiempo de
     * ejecucion no sale en el CSS final y la pastilla se queda sin color sin que
     * nada falle. El guard lo comprueba contando, no leyendo el mapa.
     */
    const sinClases = Object.entries(TAG_COLOR_CLASS).filter(
      ([, clases]) =>
        !clases.punto.startsWith('bg-') ||
        !clases.pastilla.startsWith('bg-') ||
        !clases.aro.startsWith('ring-'),
    );

    expect(sinClases).toEqual([]);

    // Y las clases van **en el fuente**, no solo en el objeto.
    for (const color of TAG_COLORS) {
      expect(FUENTE_TAG).toContain(`'${TAG_COLOR_CLASS[color].pastilla}'`);
    }
  });
});
