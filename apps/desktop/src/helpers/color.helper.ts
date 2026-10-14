/**
 * Conversion de color entre los espacios que necesita el panel.
 *
 * Todo son funciones puras y sin estado, por dos razones. La primera es que el
 * panel tiene que poder moverse sin guardar: el color cambia mientras se arrastra
 * y cada movimiento se ve al instante, sin ir al servidor. La segunda es que
 * esto es **matematica con numeros de coma flotante**, que es justo lo que
 * necesita pruebas: la conversion de hexadecimal a HSV tiene un caso que sale
 * mal si se redondea en el sitio equivocado —el negro puro no tiene tono— y sin
 * una prueba que lo fije, un dia cambia y el panel deja de pintar el negro.
 *
 * ## Por que HSV y no HSL
 *
 * El cuadrado de saturacion con la claridad encima —HSV— es el que lleva el
 * panel nativo del navegador y el que se espera. En HSL el blanco esta en las
 * dos esquinas de arriba y el negro en las dos de abajo; en HSV la fila de abajo
 * es siempre negro y la de arriba siempre el tono puro, que es lo que hace que
 * «bajar el deslizador hacia la derecha» signifique «mas oscuro» sin Having que
 * pensarlo.
 */

/** Un color como lo guarda la app: `#rrggbb`, o vacio si no hay color. */
export type ColorHex = string;

/** Las tres componentes, de 0 a 255. */
export interface IRgb {
  r: number;
  g: number;
  b: number;
}

/** Tono, saturacion y valor. Los tres de 0 a 1. */
export interface IHsv {
  h: number;
  s: number;
  v: number;
}

/** Recorta un numero al intervalo dado. */
function limita(valor: number, minimo: number, maximo: number): number {
  if (Number.isNaN(valor)) return minimo;

  return Math.min(maximo, Math.max(minimo, valor));
}

/** Un byte a partir de un valor de 0 a 1. Redondea a entero y recorta. */
function aByte(fraccion: number): number {
  return Math.round(limita(fraccion, 0, 1) * 255);
}

/** Dos digitos hexadecimales en mayuscula. */
function aHex(fraccion: number): string {
  return aByte(fraccion).toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Si una cadena es un color que se puede pintar.
 *
 * Acepta las dos formas que se escriben a mano —`#abc` y `#aabbcc`— porque el
 * panel tiene que aguantar lo que alguien teclee en el campo. Lo que sale de la
 * conversion **siempre** es de seis digitos, para que lo que se guarda tenga una
 * sola forma.
 */
export function esColor(valor: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(valor.trim());
}

/**
 * `#abc` a `#AABBCC`.
 *
 * Sale en mayusculas y con seis digitos siempre. Se guardaba en minusculas, pero
 * al compararlo con lo que venia de la base —que si se guardaba escrito a mano
 * puede venir en cualquier caja— no coincidia y la etiqueta salia sin color
 * aunque tuviera uno. Con una sola forma, comparar es comparar.
 */
export function normalizaHex(valor: string): ColorHex {
  const limpio = valor.trim();

  if (/^#[0-9a-f]{3}$/i.test(limpio)) {
    const d = limpio.slice(1).toLowerCase();
    const [r = '', g = '', b = ''] = d;

    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return limpio.toUpperCase();
}

/** El hexadecimal a sus tres componentes. */
export function hexToRgb(hex: ColorHex): IRgb {
  const limpio = normalizaHex(hex);

  if (!esColor(limpio)) return { r: 0, g: 0, b: 0 };

  /*
   * `#abc` son tres digitos y `#aabbcc` son seis, pero en el primero cada
   * digito va repetido. Se pasan a seis antes de trocear, porque trocear los
   * dos casos a la vez obliga a mirar el primero y el segundo por separado y
   * se equivoca uno de los dos.
   */
  const seis: string =
    limpio.length === 4
      ? (limpio[1] ?? '') + (limpio[1] ?? '') + (limpio[2] ?? '') + (limpio[2] ?? '') + (limpio[3] ?? '') + (limpio[3] ?? '')
      : limpio;

  return {
    r: parseInt(seis.slice(1, 3), 16),
    g: parseInt(seis.slice(3, 5), 16),
    b: parseInt(seis.slice(5, 7), 16),
  };
}

/** Las tres componentes a hexadecimal. */
export function rgbToHex({ r, g, b }: IRgb): ColorHex {
  return `#${aHex(r / 255)}${aHex(g / 255)}${aHex(b / 255)}`;
}

/**
 * Las tres componentes a `rgb(r, g, b)`, que es lo que necesita el CSS.
 *
 * **No se exporta.** La unica que la pide de fuera es `hsvToCss`, que ya la
 * envuelve; un `export` que nadie importa es una puerta mas por la que se puede
 * cambiar una firma sin que nadie se entere.
 */
function rgbToCss({ r, g, b }: IRgb): string {
  return `rgb(${aByte(r / 255)}, ${aByte(g / 255)}, ${aByte(b / 255)})`;
}

/**
 * Las tres componentes a tono, saturacion y valor.
 *
 * El caso que hay que mirar es el **negro** y el **gris**: en los dos, `max` y
 * `min` coinciden, y si se calcula el tono con esa division sale `NaN` —que al
 * pintarlo da un color invalido y el cuadrado se queda en blanco—. Se devuelve
 * el tono a cero, que es tan valido como cualquier otro: el negro y el gris no
 * tienen tono, y el que habia antes se pierde de todos modos al elegir otro.
 */
export function rgbToHsv({ r, g, b }: IRgb): IHsv {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;

  const maximo = Math.max(rr, gg, bb);
  const minimo = Math.min(rr, gg, bb);
  const delta = maximo - minimo;

  if (delta === 0) return { h: 0, s: 0, v: maximo };

  let h: number;

  if (maximo === rr) h = ((gg - bb) / delta) % 6;
  else if (maximo === gg) h = (bb - rr) / delta + 2;
  else h = (rr - gg) / delta + 4;

  // `% 6` puede dejar negativo —cuando el canal rojo es el maximo y el azul
  // mayor que el verde, que es el magenta—: se suma el circulo entero.
  if (h < 0) h += 6;

  return {
    h: (h / 6) * 360,
    s: maximo === 0 ? 0 : delta / maximo,
    v: maximo,
  };
}

/** Tono, saturacion y valor a las tres componentes. */
export function hsvToRgb({ h, s, v }: IHsv): IRgb {
  const tono = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((tono / 60) % 2) - 1));
  const m = v - c;

  const [r, g, b] =
    tono < 60
      ? [c, x, 0]
      : tono < 120
        ? [x, c, 0]
        : tono < 180
          ? [0, c, x]
          : tono < 240
            ? [0, x, c]
            : tono < 300
              ? [x, 0, c]
              : [c, 0, x];

  return {
    r: aByte(r + m),
    g: aByte(g + m),
    b: aByte(b + m),
  };
}

/** Un hexadecimal a `hsv(...)`, para el fondo del cuadrado y de la barra. */
export function hsvToCss({ h, s, v }: IHsv): string {
  const { r, g, b } = hsvToRgb({ h, s, v });

  return rgbToCss({ r, g, b });
}

/**
 * El color de una casilla del cuadrado, en coordenadas de 0 a 1.
 *
 * La coordenada vertical va al reves —arriba es el valor mas alto— porque es
 * como lo pinta el panel nativo y como lo espera cualquiera que haya usado
 * uno: bajar es oscurecer.
 */
export function casillaHsv(h: number, x: number, y: number): IHsv {
  return { h, s: limita(x, 0, 1), v: 1 - limita(y, 0, 1) };
}

/** El punto de la barra de tono para un tono dado, de 0 a 1. */
export function puntoTono(h: number): number {
  return (((h % 360) + 360) % 360) / 360;
}

/** El tono que hay en la coordenada `x` de la barra. */
export function tonoDesdePunto(x: number): number {
  return limita(x, 0, 1) * 360;
}