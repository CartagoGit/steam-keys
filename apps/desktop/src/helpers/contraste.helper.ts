import { TEXTO_CLARO, TEXTO_OSCURO } from '@/contracts';

/**
 * Que texto se lee encima de un color.
 *
 * Es la unica parte de la app donde el color **no** lo pone el tema, y por eso
 * es tambien la unica donde hace falta medir. Todo lo demas —botones, pastillas
 * de estado, las etiquetas en general antes de queieran color— usa los
 * `--ok` y los `--warn` de cada tema, que estan elegidos para leerse sobre ese
 * fondo. Un color elegido por la persona no lo esta: sobre `#00c950` se lee el
 * blanco y sobre `#7bf1a8` se lee casi negro, y con el mismo texto fijo una de
 * las dos mitades se pierde.
 *
 * Se mide con la formula de luminancia relativa de WCAG, que no es «la mitad de
 * los numeros sumados» sino la misma que usa el contraste de las WCAG de la app:
 * los canales se llevan a una curva sRGB antes de ponderarlos, porque el ojo no
 * los percibe igual —el verde pesa mucho mas que el azul— y sin esa curva un
 * verde medio saldria mas claro de lo que es.
 *
 * El corte no esta en el medio. Se decide por **cual de los dos textos gana**,
 * que es donde sale el punto de giro de verdad: el blanco gana mientras siga
 * sacando mas contraste que el negro, que en un verde como este llega hasta
 * bastante claro. Cortar en la mitad —«si la luminancia es mayor que medio, negro»—
 * deja fuera justo el tramo en el que el blanco aun se lee mejor.
 */

/** Lado de un color, para el calculo de luminancia. */
const LADO = 255;

/** Cuanto pesa cada canal. Suman uno. */
const PESOS = { rojo: 0.2126, verde: 0.7152, azul: 0.0722 } as const;

/**
 * La luminancia relativa de un color, de 0 a 1.
 *
 * Los canales van de 0 a 1 antes de la curva, y la curva de sRGB es la de siempre:
 * menos de 0.03928 es casi lineal —el negro no se ve alisar por debajo de
 * ahi— y por encima se aplica `(c + 0.055) / 1.055` elevado a 2.4.
 */
export function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((cual) => {
    const valor = Number.parseInt(hex.slice(cual, cual + 2), 16) / LADO;

    return valor <= 0.03928 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
  });

  const [rojo, verde, azul] = canales;

  if (rojo === undefined || verde === undefined || azul === undefined) return 0;

  return PESOS.rojo * rojo + PESOS.verde * verde + PESOS.azul * azul;
}

/**
 * El contraste —de 1 a 21— entre dos colores, por la formula de WCAG.
 *
 * Va en el mismo sitio que `luminancia` y no es solo para el texto: el anillo
 * que rodea una pastilla necesita tambien saber si tiene que ser claro u oscuro,
 * y dependria de la misma cuenta.
 */
export function contraste(uno: string, otro: string): number {
  const a = luminancia(uno);
  const b = luminancia(otro);

  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);

  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * El texto que se pone encima de un color: blanco o casi negro.
 *
 * `TEXTO_OSCURO` y no `#000000` a proposito. El negro puro sobre un fondo claro
 * es lo mas molesto que hay para leer —halos alrededor de las letras— y el
 * `--surface-0` de los temas oscuros es justo ese casi negro. Con el se esta
 * usando el color que la propia app usa para el texto de fondo claro, y no un
 * valor que se ha inventado aqui.
 *
 * El corte: gana el blanco mientras que su contraste siga siendo mayor. En un
 * verde como el `#00c950` de la paleta —claro de verdad, con una luminancia
 * alta— el blanco saca 2.2 y el negro 9.6, asi que sale negro. Y en el
 * `#008236` el blanco saca 4.9 y el negro 4.3, asi que sale blanco, que es lo
 * que se ve.
 */
export function textoSobre(hex: string): string {
  return contraste(hex, TEXTO_CLARO) >= contraste(hex, TEXTO_OSCURO)
    ? TEXTO_CLARO
    : TEXTO_OSCURO;
}

/**
 * Si un color se ve lo bastante claro para llevar el texto de la app encima.
 *
 * Es lo que decide si un disco chiquito es un boton o una mancha de color. Un
 * `bg-info` de los temas esta pensado para una pastilla grande; en un circulo de
 * doce pixeles se pierde el borde y se lee como una mancha, con el nombre al lado
 * el ojo ya no sabe donde termina. Ponerle un aro del color del texto lo
 * delimita.
 */
export function necesitaAro(hex: string): boolean {
  return contraste(hex, TEXTO_CLARO) < 3;
}
