import { describe, expect, test } from 'bun:test';

import {
  casillaHsv,
  esColor,
  hexToRgb,
  hsvToCss,
  hsvToRgb,
  normalizaHex,
  puntoTono,
  rgbToHex,
  rgbToHsv,
  tonoDesdePunto,
} from './color.helper';

describe('que una cadena sea un color', () => {
  test('las dos formas que se escriben a mano valen', () => {
    // El panel tiene que aguantar lo que alguien teclee: `#abc` sale igual que
    // `#aabbcc`, y quien lo escribe no tiene por que saber cual de las dos es la
    // buena.
    expect(esColor('#abc')).toBe(true);
    expect(esColor('#ABC')).toBe(true);
    expect(esColor('#aabbcc')).toBe(true);
    expect(esColor('#AABBCC')).toBe(true);
    expect(esColor('  #aabbcc  ')).toBe(true);
  });

  test('lo que no es color se rechaza', () => {
    // El caso que de verdad importa: un `red` o un `#ab` de la base de datos.
    // Si `esColor` los aceptara, el panel escribiria un negro que nadie ha
    // elegido.
    expect(esColor('red')).toBe(false);
    expect(esColor('#ab')).toBe(false);
    expect(esColor('#abcde')).toBe(false);
    expect(esColor('abc')).toBe(false);
    expect(esColor('')).toBe(false);
    expect(esColor('#gggggg')).toBe(false);
  });

  test('normalizar deja una sola forma', () => {
    // Toda la comparacion —«¿este color es el de la etiqueta?»— depende de que
    // haya una unica forma. Con mayusculas y minusculas mezcladas, un color
    // escrito a mano en la base no coincidia con el que pintaba el panel.
    expect(normalizaHex('#abc')).toBe('#AABBCC');
    expect(normalizaHex('#aabbcc')).toBe('#AABBCC');
    expect(normalizaHex('#Ff00aa')).toBe('#FF00AA');
  });
});

describe('hexadecimal a rgb', () => {
  test('las tres componentes', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
  });

  test('la forma de tres digitos se parece a la de seis', () => {
    expect(hexToRgb('#abc')).toEqual(hexToRgb('#AABBCC'));
  });

  test('lo que no es color sale negro, no revienta', () => {
    expect(hexToRgb('basura')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('rgb a hexadecimal', () => {
  test('ida y vuelta sin perder nada', () => {
    for (const color of ['#FF0000', '#123456', '#FFFFFF', '#000000', '#7F3E9D']) {
      expect(rgbToHex(hexToRgb(color))).toBe(color);
    }
  });
});

describe('rgb a tono, saturacion y valor', () => {
  test('los tres colores primarios', () => {
    // El tono va de 0 a 360 en grados: rojo 0, verde 120, azul 240.
    expect(rgbToHsv({ r: 255, g: 0, b: 0 }).h).toBeCloseTo(0, 5);
    expect(rgbToHsv({ r: 0, g: 255, b: 0 }).h).toBeCloseTo(120, 5);
    expect(rgbToHsv({ r: 0, g: 0, b: 255 }).h).toBeCloseTo(240, 5);
  });

  test('el magenta no sale con tono negativo', () => {
    /*
     * Este es el fallo que rompia el cuadrado. En magenta el canal rojo es el
     * maximo y el azul es el minimo, con lo que `(g - b) / delta` sale negativo
     * y el `% 6` lo deja como estaba. Sin sumarle el circulo entero, el tono
     * queda en -60 y al pintar sale un color invalido: el cuadrado entero se
     * queda en blanco en una de las seis columnas.
     */
    const { h } = rgbToHsv({ r: 255, g: 0, b: 255 });

    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeCloseTo(300, 5);
  });

  test('el negro y el gris no tienen tono y no dan NaN', () => {
    /*
     * El negro sale con los tres canales iguales, el gris tambien. Si en los dos
     * se calculara el tono dividiendo por una diferencia de cero sale `NaN`, y
     * `NaN` pintado es un color invalido: el cuadrado se veia en blanco justo
     * en la fila de abajo, que es la de «oscuro».
     */
    const negro = rgbToHsv({ r: 0, g: 0, b: 0 });
    const gris = rgbToHsv({ r: 128, g: 128, b: 128 });

    expect(Number.isNaN(negro.h)).toBe(false);
    expect(Number.isNaN(negro.s)).toBe(false);
    expect(Number.isNaN(gris.h)).toBe(false);
    expect(negro.v).toBe(0);
    expect(negro.s).toBe(0);
    // El gris es gris: sin saturacion, con toda la claridad.
    expect(gris.s).toBeCloseTo(0, 5);
    expect(gris.v).toBeCloseTo(128 / 255, 5);
  });
});

describe('tono, saturacion y valor a rgb', () => {
  test('ida y vuelta con los tres canales distintos', () => {
    for (const color of ['#FF0000', '#123456', '#FFFFFF', '#000000', '#7F3E9D']) {
      expect(rgbToHex(hsvToRgb(rgbToHsv(hexToRgb(color))))).toBe(color);
    }
  });

  test('las esquinas del cuadrado son el tono puro y el negro', () => {
    // Abajo a la izquierda = sin saturacion, que es gris; abajo a la derecha =
    // negro. Arriba, a la izquierda = blanco; a la derecha, el tono entero.
    expect(rgbToHex(hsvToRgb({ h: 0, s: 0, v: 1 }))).toBe('#FFFFFF');
    expect(rgbToHex(hsvToRgb({ h: 0, s: 0, v: 0 }))).toBe('#000000');
    expect(rgbToHex(hsvToRgb({ h: 0, s: 1, v: 0 }))).toBe('#000000');
    expect(rgbToHex(hsvToRgb({ h: 0, s: 1, v: 1 }))).toBe('#FF0000');
  });

  test('los tonos salen en el orden del circulo', () => {
    const tono = (h: number): string => rgbToHex(hsvToRgb({ h, s: 1, v: 1 }));

    expect(tono(0)).toBe('#FF0000');
    expect(tono(60)).toBe('#FFFF00');
    expect(tono(120)).toBe('#00FF00');
    expect(tono(180)).toBe('#00FFFF');
    expect(tono(240)).toBe('#0000FF');
    expect(tono(300)).toBe('#FF00FF');
  });

  test('un tono fuera del circulo da la vuelta', () => {
    // 360 grados es el mismo punto que 0 —rojo—, y 420 ya ha dado una vuelta
    // entera: son 60, que es amarillo. Y por debajo de cero, -60 son 300, que es
    // magenta, que es justo el tono que sale negativo en `rgbToHsv`.
    expect(rgbToHex(hsvToRgb({ h: 360, s: 1, v: 1 }))).toBe('#FF0000');
    expect(rgbToHex(hsvToRgb({ h: 420, s: 1, v: 1 }))).toBe('#FFFF00');
    expect(rgbToHex(hsvToRgb({ h: -60, s: 1, v: 1 }))).toBe('#FF00FF');
  });

  test('el css sale en rgb, que es lo que entiende el estilo', () => {
    expect(hsvToCss({ h: 0, s: 1, v: 1 })).toBe('rgb(255, 0, 0)');
  });
});

describe('el cuadrado y la barra', () => {
  test('abajo es mas oscuro, no mas claro', () => {
    /*
     * La coordenada vertical va al reves: abajo es el valor mas bajo. Al reves
     * —arriba negro— el deslizador hacia abajo aclaraba el color, que es lo
     * contrario de lo que hace el panel del navegador y de lo que espera
     * cualquiera que haya usado uno.
     */
    const arriba = casillaHsv(0, 1, 0);
    const abajo = casillaHsv(0, 1, 1);

    expect(arriba.v).toBe(1);
    expect(abajo.v).toBe(0);
    expect(rgbToHex(hsvToRgb(arriba))).toBe('#FF0000');
    expect(rgbToHex(hsvToRgb(abajo))).toBe('#000000');
  });

  test('a la izquierda no hay saturacion', () => {
    const izquierda = casillaHsv(210, 0, 0.5);

    expect(izquierda.s).toBe(0);
    // Sin saturacion solo queda el gris, que es el mismo para todos los tonos.
    expect(rgbToHex(hsvToRgb(izquierda))).toBe('#808080');
  });

  test('fuera del cuadrado se recorta, no se desborda', () => {
    // Se arrastra fuera del borde con el raton pulsado, y sale mas alla. Un
    // valor sin recortar pinta un color invalido y el punto se sale del cuadro.
    expect(casillaHsv(0, 2, 0).s).toBe(1);
    expect(casillaHsv(0, -1, 0).s).toBe(0);
    expect(casillaHsv(0, 0, 5).v).toBe(0);
    expect(tonoDesdePunto(2)).toBe(360);
    expect(tonoDesdePunto(-1)).toBe(0);
  });

  test('el punto de la barra y su inversa son el mismo numero', () => {
    for (const h of [0, 60, 120, 180, 240, 300, 359]) {
      expect(tonoDesdePunto(puntoTono(h))).toBeCloseTo(h, 5);
    }
  });
});