import { normalizeForMatch } from '@/helpers/match-title.helper';
import type { ISteamOwnedGame } from '@/contracts';

/**
 * Si un juego de la coleccion ya esta en la cuenta de Steam.
 *
 * La pregunta se hace una vez por cada clave, y hay mas de cuatrocientas, asi
 * que la respuesta tiene que ser rapida. De ahi el indice por palabra inicial:
 * comparar un titulo con los ochocientos juegos de la cuenta son 320.000
 * distancias de Levenshtein, y eso se nota al escribir en el buscador.
 *
 * El indice no decide nada: solo reduce el abanico. La decision la toma
 * `similarity()`, que es la misma que usa el emparejado de una clave con un
 * juego concreto.
 */

/**
 * Palabras que no distinguen un juego de otro y solo estan para que el titulo
 * suene a titulo.
 *
 * Sin quitarlas, "The Witcher 3" y "Witcher 3" caerian en indices distintos y
 * no se compararian nunca, que es justo uno de los casos que este emparejado
 * existe para resolver.
 */
const VACIAS: ReadonlySet<string> = new Set([
  'the',
  'a',
  'an',
  'la',
  'el',
  'los',
  'las',
  'les',
  'der',
  'die',
  'das',
  'den',
]);

/**
 * Palabra por la que se indexa un titulo: la primera con contenido.
 *
 * Se corta a 12 caracteres porque "ediciones" pegadas ("edition", "ediciones")
 * comparten inicio largo y solo se parecen al principio, que es justo cuando
 * el titulo ya se distingue por lo que viene despues.
 */
export function palabraInicial(title: string): string {
  const palabras = normalizeForMatch(title).split(' ');

  for (const palabra of palabras) {
    if (palabra && !VACIAS.has(palabra)) return palabra.slice(0, 12);
  }

  return '';
}

/** Juegos de la cuenta, agrupados por `palabraInicial` de su nombre. */
export type IOwnershipIndex = ReadonlyMap<string, readonly ISteamOwnedGame[]>;

/** Prepara el indice una vez por cada vez que cambia la biblioteca. */
export function buildOwnershipIndex(
  juegos: readonly ISteamOwnedGame[],
): IOwnershipIndex {
  const indice = new Map<string, ISteamOwnedGame[]>();

  for (const juego of juegos) {
    const clave = palabraInicial(juego.name);

    // Un nombre vacio no indexa: colisionaria con todo lo demas y no
    // distinguiria nada.
    if (!clave) continue;

    const grupo = indice.get(clave);

    if (grupo) grupo.push(juego);
    else indice.set(clave, [juego]);
  }

  return indice;
}

/**
 * Los juegos con los que este titulo merece compararse.
 *
 * Solo los que comparten palabra inicial, mas los que ya son el mismo nombre
 * exacto: esos son una coincidencia segura y no hace falta ni buscar.
 */
export function ownershipCandidates(
  title: string,
  indice: IOwnershipIndex,
): readonly ISteamOwnedGame[] {
  return indice.get(palabraInicial(title)) ?? [];
}