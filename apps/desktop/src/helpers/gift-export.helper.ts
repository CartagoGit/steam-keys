import type { IGameKey } from '@/contracts/interfaces/game-key.interface';

/**
 * Genera el TXT para regalar una seleccion de claves.
 *
 * El formato es el mas simple que se puede leer de un vistazo y de un vistazo
 * copiar: **dos lineas por juego**, el nombre arriba y la clave debajo,
 * separadas por una linea en blanco.
 *
 * ```
 * Celeste
 * MQ7RT-29XKL-ZPN84
 *
 * Hollow Knight
 * B4KMD-58RQW-LNCT3
 * ```
 *
 * Se eligio asi, y no `Juego - CLAVE`, porque hay titulos largos con guiones
 * dentro ("Company of Heroes 2 - The Western Front Armies"), y con el juego y
 * la clave en la misma linea no se distingue donde acaba una cosa y empieza la
 * otra. Con una linea cada uno no hay ambiguedad, y al pegar en un chat o en un
 * correo el bloque entero se lee igual de bien.
 *
 * Los juegos van en el mismo orden en que salen en la app, para que el fichero
 * se parezca a lo que se ve al seleccionar.
 */

/** Nombre del fichero que se genera, sin extension. */
export const GIFT_FILE_STEM = 'claves-para-regalar';

/** Una clave selectada, en el formato que va al TXT. */
export interface IGiftEntry {
  title: string;
  keyValue: string;
}

/** Quita los saltos de linea y el caracter de tabulador de un texto. */
function limpiar(texto: string): string {
  return texto.replace(/[\r\n\t]+/g, ' ').trim();
}

/**
 * Convierte las claves seleccionadas en el texto del fichero.
 *
 * Las claves se emiten **en claro**, sin enmascarar: el fichero es para
 * regalarlas, y una clave enmascarada no se puede canjear. Por eso este
 * helper no debe usarse para nada que vaya a un sitio compartido sin querer.
 */
export function buildGiftTxt(keys: readonly IGameKey[]): string {
  return keys
    .map((key) => `${limpiar(key.title)}\n${limpiar(key.keyValue)}`)
    .join('\n\n');
}

/** Nombre completo del fichero, con la fecha para no sobrescribir. */
export function giftFileName(fecha: Date): string {
  const dia = fecha.toISOString().slice(0, 10);

  return `${GIFT_FILE_STEM}-${dia}.txt`;
}