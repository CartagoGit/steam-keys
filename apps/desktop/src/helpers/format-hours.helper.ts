import { LOCALE_BCP47, type AppLocale } from '@/contracts';

/**
 * Horas jugadas, en el idioma de la pantalla.
 *
 * Vive aqui y no dentro de la tabla de juegos porque es el unico numero de la
 * aplicacion que se pintaba con `toFixed` en vez de pasar por `Intl`. Con el
 * resto de numeros ya lo hace el navegador con el idioma de la pantalla —las
 * fechas, los tamanos— y las horas quedaban fuera por descuido.
 *
 * No es cosmetico: `toFixed` escribe siempre **con punto** como separador
 * decimal, y en castellano, frances y portugues el separador es la coma. Se
 * veia «2.5 h jugados» al lado de una fecha que si salia bien, que es
 * justo cuando una cosa delata que la otra no se ha mirado.
 *
 * Ademas el separador de millares: con mas de mil horas jugadas —en una
 * coleccion grande, no es raro— `toFixed` daria «1234.5» y el idioma daria
 * «1234,5» o «1.234,5» segun el pais.
 */

/**
 * `150` → `2,5` en castellano, `2.5` en ingles.
 *
 * Siempre **un** decimal, tambien cuando sale entero: «2,0 h jugados» y no
 * «2 h jugados». El numero va dentro de un texto con su unidad, y en una
 * columna de cifras a la derecha el ancho lo fija el caso mas largo; si el
 * entero saliera sin decimal, la columna daria un bote al cambiar de juego.
 */
export function formatHours(minutes: number, locale: AppLocale): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0.0';

  return new Intl.NumberFormat(LOCALE_BCP47[locale], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(minutes / 60);
}
