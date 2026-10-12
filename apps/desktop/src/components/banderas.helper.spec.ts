import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AppLocale, LOCALE_META } from '@/contracts';

/**
 * Las banderas del selector de idioma.
 *
 * Se comprueban **leyendo el SVG**, no con una captura, porque una captura
 * depende de que el navegador pinte el antialiasing como toca y de que alguien
 * mire; el SVG tiene numeros, y los numeros se comparan.
 *
 * Y la referencia es el fichero oficial de Wikimedia, medido con el mismo
 * metodo que este: la caja de lo que **no** es banda. La de Espana oficial va
 * de 0,211 a 0,455 del ancho y de 0,300 a 0,699 del alto. Con eso, «el escudo
 * esta donde debe» es una afirmacion verificable en vez de una opinion.
 */

const RAIZ = join(new URL('.', import.meta.url).pathname, '..', '..');

/** El Real Decreto: el mismo rojo en las bandas y en el escudo. */
const ROJO = '#aa151b';

/** Y el mismo oro. */
const ORO = '#f1bf00';

function bandera(idioma: AppLocale): string {
  return readFileSync(join(RAIZ, 'public', LOCALE_META[idioma].flag), 'utf8');
}

/**
 * Un rectangulo del SVG, con sus medidas y su color.
 *
 * `x` e `y` son opcionales de verdad: el rectangulo base de la bandera no los
 * lleva, y con `noUncheckedIndexedAccess` eso obliga a comprobarlos —que es lo
 * que se quiere, porque son los que separan «la bandera» de «donde esta
 * puesto algo encima».
 */
interface IRect {
  x?: number;
  y?: number;
  width: number;
  height: number;
  color: string;
}

/**
 * Los `<rect>` con sus atributos, en el orden en que salen.
 *
 * El del recorte de las esquinas no cuenta: va dentro del `<clipPath>` y es la
 * caja entera de la bandera. Se queda fuera por no tener `fill`: el color va
 * puesto en cada elemento y no heredado de un `<g>`, asi que un rectangulo sin
 * `fill` no es parte del dibujo.
 */
function rectangulos(svg: string, color?: string): IRect[] {
  return [...svg.matchAll(/<rect[^>]*>/g)]
    .map((m): IRect | null => {
      const ancho = Number(m[0].match(/\bwidth="(-?[\d.]+)"/)?.[1]);
      const alto = Number(m[0].match(/\bheight="(-?[\d.]+)"/)?.[1]);
      const color = m[0].match(/fill="(#[0-9a-f]{6})"/)?.[1];

      if (!Number.isFinite(ancho) || !Number.isFinite(alto) || color === undefined) {
        return null;
      }

      return {
        x: m[0].match(/\bx="(-?[\d.]+)"/) ? Number(m[0].match(/\bx="(-?[\d.]+)"/)![1]) : undefined,
        y: m[0].match(/\by="(-?[\d.]+)"/) ? Number(m[0].match(/\by="(-?[\d.]+)"/)![1]) : undefined,
        width: ancho,
        height: alto,
        color,
      };
    })
    .filter((r): r is IRect => r !== null)
    .filter((r) => color === undefined || r.color === color);
}

/**
 * Las dos bandas: lo que va antes del escudo.
 *
 * Devuelve una tupla y no un array porque el orden es fijo —roja y luego
 * amarilla— y con un array cada lectura queda como `undefined` posible con
 * `noUncheckedIndexedAccess`, que es ruido en un sitio donde el orden no puede
 * cambiar: el primero en salir es el rojo y el segundo el oro.
 */
function bandas(svg: string): [roja: IRect, amarilla: IRect] {
  const [roja, amarilla] = rectangulos(svg);

  if (roja === undefined || amarilla === undefined) {
    throw new Error('la bandera no tiene las dos bandas al principio');
  }

  return [roja, amarilla];
}

describe('las banderas', () => {
  test('las cinco son SVG, de 3:2 y del mismo ancho', () => {
    // La caja la fija el `<img>` del selector con `LOCALE_FLAG_SIZE` y la
    // proporcion real. Si una bandera sale con otra proporcion, el alto de la
    // caja la recorta o la deja al aire.
    for (const idioma of Object.values(AppLocale)) {
      const svg = bandera(idioma);
      const ancho = svg.match(/\bwidth="(\d+)"/)?.[1];
      const alto = svg.match(/\bheight="(\d+)"/)?.[1];

      expect(`${idioma}:${ancho}x${alto}`).toBe(`${idioma}:24x16`);
    }
  });

  test('la de España usa el mismo rojo y el mismo oro que sus bandas', () => {
    /**
     * Un solo color por cosa.
     *
     * El escudo usaba `#ad1519` y las bandas `#aa151b`: dos rojos a cinco
     * unidades de diferencia. A 22 px no se nota, pero cualquier ojo que
     * ampliase el fichero veía dos banderas en una.
     */
    const colores = [...new Set(
      [...bandera(AppLocale.Es).matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]),
    )];

    expect(colores.sort()).toEqual([ORO, ROJO].sort());
  });

  test('las bandas son 1:2:1 y el escudo cabe dentro de la amarilla', () => {
    /**
     * Cuatro partes iguales y la bandera parece de Anyguy.
     *
     * Y el escudo tiene que caber **dentro** de la franja amarilla: la oficial
     * va de 0,300 a 0,699 del alto y la franja de 0,25 a 0,75. Uno que se sale
     * por arriba y por abajo se come las bandas rojas, y eso no lo hace
     * ninguna bandera de Espana —tampoco la de la Copa, que es la unica con
     * cuatro bandas—.
     */
    const svg = bandera(AppLocale.Es);
    const [roja, amarilla] = bandas(svg);

    /**
     * El rojo es **un solo rectangulo** a toda la altura con la amarilla
     * encima, no tres franjas: lo que sale es 4 de rojo, 8 de oro y 4 de rojo
     * otra vez, que es 1:2:1.
     */
    const ALTO = 16;

    /** La cuarta parte del alto: lo que mide cada franja roja. */
    const CADA_ROJA = ALTO / 4;

    expect(roja.height).toBe(ALTO);
    expect(amarilla.height).toBe(CADA_ROJA * 2);
    expect(amarilla.y).toBe(CADA_ROJA);
    expect(ALTO - ((amarilla.y ?? 0) + amarilla.height)).toBe(CADA_ROJA);

    // Y el escudo entero cae dentro: arriba de 4 y abajo de 12.
    const rojos = rectangulos(svg, ROJO).slice(1);
    const arriba = Math.min(...rojos.map((r) => r.y ?? 0));
    const abajo = Math.max(...rojos.map((r) => (r.y ?? 0) + r.height));

    expect(arriba).toBeGreaterThanOrEqual(4);
    expect(abajo).toBeLessThanOrEqual(12);
  });

  test('el escudo va a un tercio del ancho, no centrado', () => {
    /**
     * Lo que la hacia inconfundible, y lo que estaba mal.
     *
     * El centro de la caja oficial esta en 0,333 del ancho, o sea en x=8 de 24.
     * Estaba en x=12 —el centro— por «centrado suena bien», y con eso no se
     * parecia a ninguna: quien conoce la bandera la busca a un tercio.
     *
     * Se mide con los `<rect>` del escudo y no con los `path`, porque los
     * numeros de un `path` vienen en parejas x,y que no tienen porque
     * corresponderse y de ahi no sale una caja. Las columnas, que son las que
     * dan el ancho, son rectangulos.
     */
    const svg = bandera(AppLocale.Es);
    const delEscudo = rectangulos(svg, ROJO).slice(1);

    const izquierda = Math.min(...delEscudo.map((r) => r.x ?? 0));
    const derecha = Math.max(
      ...delEscudo.map((r) => (r.x ?? 0) + r.width),
    );
    const centro = (izquierda + derecha) / 2;

    /*
     * La oficial va de 5,06 a 10,93 de 24. Se admite un margen de 0,15 a cada
     * lado, que es lo que puede haber cambiado al dibujar a ojo, y nada mas:
     * con margen mas, volveria a caber un escudo centrado, que es justo lo que
     * se quiere que no vuelva a pasar.
     */
    const MARGEN = 0.15;

    expect(izquierda).toBeGreaterThanOrEqual(5.06 - MARGEN);
    expect(izquierda).toBeLessThanOrEqual(5.06 + MARGEN);
    expect(derecha).toBeGreaterThanOrEqual(10.93 - MARGEN);
    expect(derecha).toBeLessThanOrEqual(10.93 + MARGEN);

    // Y el centro a un tercio, con la misma tolerancia.
    expect(centro).toBeGreaterThanOrEqual(8 - MARGEN);
    expect(centro).toBeLessThanOrEqual(8 + MARGEN);
  });

  test('el escudo tiene corona, cuerpo, columnas y cuarteles', () => {
    /**
     * Las columnas son las que dan **ancho**.
     *
     * Sin ellas la mancha ocupaba 0,137 del ancho de la bandera frente a los
     * 0,245 de la oficial, y se leia como una bandera con algo pequeno pegado
     * en vez de con un escudo. A 22 px cada columna mide 0,7 y es medio pixel de
     * gris: no se ve, pero ensancha lo que tiene que ensanchar.
     */
    const svg = bandera(AppLocale.Es);
    const rojos = rectangulos(svg, ROJO).slice(1);
    const dorados = rectangulos(svg, ORO).slice(1);

    // La banda de la corona, las dos columnas, sus dos capiteles y el liston
    // que las une.
    expect(rojos.length).toBe(6);

    // Los dos cuarteles de oro en diagonal; el fondo lo pone el rojo.
    expect(dorados.length).toBe(2);

    // En diagonal: el de arriba a la izquierda y el de abajo a la derecha, que
    // es como se lee el cuartelado sin dibujar los demas cuarteles.
    const [arribaIzq, abajoDer] = dorados;

    expect(arribaIzq?.x).toBeLessThan(abajoDer?.x ?? 0);
    expect(arribaIzq?.y).toBeLessThan(abajoDer?.y ?? 0);

    // Y los dos `<path>`: la corona y el cuerpo del escudo.
    expect((svg.match(/<path/g) ?? []).length).toBe(2);
  });
});
