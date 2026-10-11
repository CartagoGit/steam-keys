import { normalizeTag } from '@/contracts';

/**
 * Como se comparan dos nombres de juego para saber si son el mismo.
 *
 * Estaba escrito dos veces: `normalizeTitle` en `steam.service` y
 * `normalizar` + `stripEdition` en `app.component`. Y no eran lo mismo.
 *
 * El del servicio quita la coletilla de edicion y los signos de puntuacion. El
 * de la app quita acentos, puntuacion... y **no** quitaba la coletilla, asi que
 * dependia de acordarse de llamar antes a `stripEdition`. Ese troceado hacia
 * falta justo para el caso que mas lo necesitaba: una clave llamada
 * "Shadow of Mordor GOTY Edition" contra un juego que Steam llama
 * "Middle-earth: Shadow of Mordor".
 *
 * Ademas el del servicio **no quitaba acentos**, asi que "Pokemon" y "Pokémon"
 * eran juegos distintos a la hora de emparejar. Con una sola funcion, los dos
 * caminos hacen lo mismo y no pueden separarse.
 *
 * Va en un helper y no en un servicio porque lo usan un componente y un
 * servicio por igual, y porque es una funcion pura: no toca disco ni red.
 */

/**
 * Sufijos de edicion que se quitan antes de comparar.
 *
 * Es una lista y no una expresion regular porque hay que reconocerlos al final
 * del titulo y en este orden: `"Game of the Year Edition"` tiene que caerse
 * antes que `"Game of the Year"`, o el primero se comeria medio y dejaria
 * `"Edition"` colgando. Con la lista, el orden se ve.
 */
const SUFIJOS: readonly string[] = Object.freeze([
  'game of the year edition',
  'game of the year',
  'definitive edition',
  'definitive',
  'complete edition',
  'ultimate edition',
  'ultimate',
  'gold edition',
  'gold',
  'collectors edition',
  "collector's edition",
  'deluxe edition',
  'deluxe',
  'limited edition',
  'extended edition',
  'enhanced edition',
  'anniversary edition',
  'remastered edition',
  'goty edition',
  'goty',
  'director s cut',
  'directors cut',
  'theatrical cut',
  'final cut',
]);

/**
 * Deja un nombre comparable: sin acentos, sin puntuacion y sin coletilla de
 * edicion.
 *
 * "Middle-earth: Shadow of Mordor GOTY Edition" pasa a ser
 * `"middle earth shadow of mordor"`, que ya se parece a lo que Steam llama al
 * juego base.
 */
export function normalizeForMatch(title: string): string {
  let limpio = normalizeTag(title);

  for (const sufijo of SUFIJOS) {
    if (limpio.endsWith(sufijo) && limpio.length > sufijo.length) {
      limpio = limpio.slice(0, -sufijo.length).trim();
    }
  }

  return limpio.replace(/[^a-z0-9]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}