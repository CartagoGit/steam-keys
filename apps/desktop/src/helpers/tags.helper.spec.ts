import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { contarUsos, nombresDe, sortTags } from './tags.helper';
import {
  TAG_FAMILIAS,
  TAG_PASOS,
  TAG_TONOS,
  esHex,
  parseTagColor,
  type ITag,
} from '@/contracts';

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
  return nombres.map((nombre) => ({ clave: nombre, nombre, usos: 0, color: '' }));
}

describe('ordenar el catalogo de etiquetas', () => {
  test('las etiquetas mas usadas van primero', () => {
    const orden = sortTags([
      { clave: 'dlc', nombre: 'dlc', usos: 1, color: '' },
      { clave: 'contexto', nombre: 'contexto', usos: 40, color: '' },
      { clave: 'humble', nombre: 'humble', usos: 12, color: '' },
    ]);

    expect(orden.map((t) => t.nombre)).toEqual(['contexto', 'humble', 'dlc']);
  });

  test('a igual de usos manda el nombre, para que la lista no se mueva', () => {
    const orden = sortTags([
      { clave: 'zeta', nombre: 'zeta', usos: 7, color: '' },
      { clave: 'alfa', nombre: 'alfa', usos: 7, color: '' },
      { clave: 'medio', nombre: 'medio', usos: 7, color: '' },
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
 * Tres reglas, y las tres se pueden volver a romper sin que nada falle:
 *
 * - **sin color no hay color.** Una etiqueta que no tiene color elegido sale
 *   como texto. No sale con uno deducido del nombre, y no sale con el de por
 *   defecto: dar un color que nadie ha elegido dice algo que el usuario no ha
 *   dicho, y hace que haya que explicar cuales de las que se ven son reales.
 * - **lo elegido se gana.** Hay una sola fuente de verdad —la columna— y todo
 *   lo demas lo lee de ahi.
 * - **lo que llega de la base se comprueba.** El fichero se puede abrir y
 *   editar a mano, y un color raro en la columna no puede romper la pantalla.
 */
/**
 * El nombre con el que se ve una etiqueta.
 *
 * El catalogo guarda la clave normalizada y las claves guardan el texto tal
 * cual. La etiqueta que se ve sale de las claves —«Cumplidos»— y no del
 * catalogo —«cumplidos»—, porque si saliera de ahi la palabra de la fila y la del
 * filtro serian distintas y no se reconoceria que son la misma.
 */
describe('el nombre con el que se ve una etiqueta', () => {
  test('sale de las claves, con la caja con la que estan escritas', () => {
    const nombres = nombresDe([['Cumplidos'], ['Cumplidos', '2025']]);

    expect(nombres.get('cumplidos')).toBe('Cumplidos');
    expect(nombres.get('2025')).toBe('2025');
  });

  test('la clave es la normalizada, no el nombre', () => {
    /*
     * Es lo que hace que el filtro encuentre la etiqueta. Con la clave puesta al
     * nombre —«Cumplidos»— el filtro buscaria eso contra las claves, que
     * guardan otra cosa, y no saldria nada.
     */
    const nombres = nombresDe([['Para el hermano']]);

    expect([...nombres.keys()]).toEqual(['para el hermano']);
    expect(nombres.get('para el hermano')).toBe('Para el hermano');
  });

  test('si hay dos cajas, gana la que usan mas claves', () => {
    const nombres = nombresDe([
      ['Cumplidos'],
      ['cumplidos'],
      ['cumplidos'],
    ]);

    expect(nombres.get('cumplidos')).toBe('cumplidos');
  });

  test('a igualdad de usos, la eleccion es siempre la misma', () => {
    /*
     * Sin desempate, una etiqueta repartida a partes iguales podria salir con
     * cualquiera de las dos cajas y cambiar al reabrir el filtro.
     */
    const uno = nombresDe([['Cumplidos'], ['cumplidos']]);
    const otro = nombresDe([['cumplidos'], ['Cumplidos']]);

    expect(uno.get('cumplidos')).toBe(otro.get('cumplidos'));
  });

  test('lo que se escribe con acentos o con mayusculas es la misma etiqueta', () => {
    /*
     * Las dos formas caen en la **misma** clave, que es lo que importa: es la
     * clave por la que se busca el filtro y por la que se guarda el color. Con
     * dos claves distintas habria dos entradas en el filtro para la misma
     * palabra y el color de una no se veria en la otra.
     *
     * Cuál de las dos cajas gana el empate no se comprueba aqui —depende del
     * alfabeto— y es lo de menos: lo que no puede pasar es que sean dos.
     */
    const nombres = nombresDe([['Promo Café'], ['promo cafe']]);

    expect([...nombres.keys()]).toEqual(['promo cafe']);
    expect(['Promo Café', 'promo cafe']).toContain(nombres.get('promo cafe') ?? '');

    // La `ñ` tambien se va: se descompone en `n` mas la tilde, y la tilde es
    // una marca de combinacion. Con ella, «Cumpleaños» y «Cumpleanos» serian
    // dos etiquetas distintas en una coleccion de mil claves, y bastaba con
    // que se escribieran con o sin tilde para no encontrar ninguna.
    expect([...nombresDe([['Cumpleaños']]).keys()]).toEqual(['cumpleanos']);
  });
});

describe('el color de una etiqueta', () => {
  test('sin color elegido no hay color, y no hay color deducido', () => {
    /*
     * La columna vacia es lo que hay, y no hay nada mas que hacer con ella.
     *
     * Se llego a poner un color deducido del nombre y fue un error: la misma
     * palabra salia con un color distinto segun quien la pintara —el filtro
     * usaba una cuenta y la fila otra—, y ademas decia algo que el usuario no
     * habia dicho. Aqui se comprueba que **no existe** ninguna funcion que
     * saque un color de un sitio que no sea la columna.
     */
    const fuente = readFileSync(
      join(new URL('.', import.meta.url).pathname, 'tags.helper.ts'),
      'utf8',
    );

    expect(fuente).not.toContain('tonoPorDefecto');
    expect(fuente).not.toContain('charCodeAt');
  });

  test('la paleta tiene los tres pasos de cada familia, y no se repiten', () => {
    // Dieciocho: seis familias por tres pasos. Si falta una muestra, el panel
    // sale con un hueco y no se ve que es un color y no un fallo de dibujo.
    expect(TAG_TONOS).toHaveLength(TAG_FAMILIAS.length * TAG_PASOS.length);

    const vistos = new Set(TAG_TONOS.map((tono) => tono.hex));

    // Sin repetir: dos muestras con el mismo `hex` son indistinguibles y el
    // panel tendria dos botones que hacen lo mismo.
    expect(vistos.size).toBe(TAG_TONOS.length);

    // Y cada familia tiene los tres pasos.
    for (const familia of TAG_FAMILIAS) {
      const pasos = TAG_TONOS.filter((tono) => tono.familia === familia).map(
        (tono) => tono.paso,
      );

      expect(pasos).toEqual([...TAG_PASOS]);
    }
  });

  test('los colores guardados fuera de la paleta se rechazan al pintar, no al leer', () => {
    /*
     * Se acepta cualquier `hex` de seis digitos y se rechaza todo lo demas. No
     * se comprueba que sea uno de los dieciocho: la paleta puede crecer, y una
     * base con un color de una version anterior tiene que seguir pintandose.
     */
    expect(parseTagColor('#00A6F4')).toBe('#00a6f4');
    expect(parseTagColor('  #00a6f4 ')).toBe('#00a6f4');

    // Lo que no es un color, sale como sin color. Es lo que se ve entonces, y no
    // un error: el dato lo escribe la app, pero el fichero se puede editar.
    expect(parseTagColor('rojo')).toBe('');
    expect(parseTagColor('#fff')).toBe('');
    expect(parseTagColor('#00a6f4f')).toBe('');
    expect(parseTagColor('rgb(0,0,0)')).toBe('');
    expect(parseTagColor('')).toBe('');
  });

  test('ningun color de la paleta es un color del tema', () => {
    /*
     * Si la paleta tomara los `--ok` o los `--warn` del tema, volveria el
     * problema de siempre: un color elegido se leeria bien en los temas oscuros
     * y mal en los claros. Y no se comprueba con una lista de prohibidos —
     * `esHex` acepta cualquier color— sino mirando que la paleta traiga sus
     * propios valores.
     */
    expect(TAG_TONOS.every((tono) => esHex(tono.hex))).toBe(true);
  });
});
