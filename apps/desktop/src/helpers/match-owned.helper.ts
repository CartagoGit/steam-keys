import { normalizeForMatch } from '@/helpers/match-title.helper';
import type { ISteamOwnedGame, MatchConfidence } from '@/contracts';

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

/**
 * Coletillas que distinguen una edicion de otra.
 *
 * Es la razon por la que el emparejamiento por nombre no puede ser de fiar: dos
 * claves del mismo juego pueden llamarse casi igual y ser **juegos distintos**
 * en Steam. Un "GOTY Edition" y la edicion normal son el mismo appid, pero un
 * "Snowfall" es un DLC con appid propio. Quitar estas palabras reduce el ruido,
 * pero no lo elimina, y por eso el resultado lleva confianza.
 */
/**
 * Quita la coletilla de edicion de un nombre y lo deja comparable.
 *
 * "Middle-earth: Shadow of Mordor GOTY Edition" pasa a ser "middle earth shadow
 * of mordor", que ya se parece a lo que Steam llama al juego base. De paso se
 * quitan los signos de puntuacion, porque "Cities: Skylines" y "Cities
 * Skylines" son el mismo juego escritos de dos formas y sale mas a cuenta
 * compararlos asi que puntuando cada letra.
 */
/**
 * Que tan parecidas son dos cadenas, de 0 a 1.
 *
 * Se usa la distancia de Levenshtein normalizada porque "Cities Skylines" y
 * "Cities: Skylines" solo se diferencian en un caracter, mientras que "Witcher"
 * y "Twisted Metal" no tienen nada que ver. Comparar palabras sueltas daria
 * falsos positivos en titulos cortos.
 */
export function similarity(a: string, b: string): number {
  const x = normalizeForMatch(a);
  const y = normalizeForMatch(b);

  if (x === y) return 1;
  if (x.length === 0 || y.length === 0) return 0;

  const distancia = levenshtein(x, y);
  const largo = Math.max(x.length, y.length);

  return 1 - distancia / largo;
}

/** Distancia de Levenshtein, con dos filas en vez de una matriz entera. */
export function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  let actual = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    actual[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;

      actual[j] = Math.min(
        (actual[j - 1] ?? 0) + 1,
        (anterior[j] ?? 0) + 1,
        (anterior[j - 1] ?? 0) + coste,
      );
    }

    [anterior, actual] = [actual, anterior];
  }

  return anterior[b.length] ?? a.length;
}

/** Que confianza merece un emparejamiento segun lo que se parece el nombre. */
export function confidenceFor(similitud: number, candidatos: number): MatchConfidence {
  if (similitud >= 0.97) return 'exact';
  if (similitud >= 0.85) return candidatos === 1 ? 'likely' : 'loose';
  if (similitud >= 0.7) return 'loose';
  return 'none';
}

/**
 * Elige el mejor candidato de una busqueda para un titulo dado.
 *
 * No devuelve el primero: elige el que mas se parezca y **descarta los DLC**
 * cuando hay un juego normal con parecido parecido, porque lo que se busca es
 * "tengo este juego", no "tengo este contenido extra". Si solo hay DLC, se
 * devuelve igualmente, que es mejor que un "no lo tienes" cuando lo que hay es
 * el juego.
 */
export function bestCandidate(
  title: string,
  candidatos: readonly ISteamOwnedGame[],
): { elegido: ISteamOwnedGame | null; confianza: MatchConfidence; puntuaciones: number[] } {
  if (candidatos.length === 0) {
    return { elegido: null, confianza: 'none', puntuaciones: [] };
  }

  const puntuados = candidatos
    .map((candidato) => ({
      candidato,
      puntuacion: similarity(title, candidato.name),
    }))
    .sort((a, b) => b.puntuacion - a.puntuacion);

  const puntuaciones = puntuados.map((p) => p.puntuacion);
  const mejor = puntuados[0];

  if (!mejor) {
    return { elegido: null, confianza: 'none', puntuaciones };
  }

  // Si el mejor es un DLC pero hay un juego normal casi igual de parecido, se
  // prefiere el juego normal: es casi siempre el que se quiere decir.
  if (mejor.candidato.isDlc) {
    const juego = puntuados.find((p) => !p.candidato.isDlc);

    if (juego && juego.puntuacion >= mejor.puntuacion - 0.05) {
      return {
        elegido: juego.candidato,
        confianza: confidenceFor(juego.puntuacion, candidatos.length),
        puntuaciones,
      };
    }
  }

  return {
    elegido: mejor.candidato,
    confianza: confidenceFor(mejor.puntuacion, candidatos.length),
    puntuaciones,
  };
}

/**
 * Similitud a partir de la cual se dice «ya lo tienes».
 *
 * El valor sale de `confidenceFor`: `exact` es 0.97 o mas, y `likely` es 0.85
 * cuando ademas hay un solo candidato. Se eligen esos dos y se descarta `loose`
 * a proposito.
 *
 * `loose` empieza en 0.70, y ahi entran cosas que **no** son el mismo juego:
 * «Portal» contra «Portal 2» se puntua en 0.75, igual que «Half-Life» contra
 * «Half-Life 2». Marcar esas como propias seria lo peor que puede hacer este
 * badge: dice que la clave sobra, y el usuario la regala y pierde el juego.
 *
 * 0.85 sube justo con las diferencias de verdad:
 * - «World War III Black Gold» contra «World War 3 Black Gold» → 1.00, porque
 *   `normalizeForMatch` escribe los numeros romanos como digitos.
 * - «Broken Sword 1: Shadow of the Templars - Director's Cut» contra
 *   «Broken Sword: Shadow of the Templars - Director's Cut» → 0.96
 *
 * Sin la conversion de romanos el primer caso se queda en 0.84, a una centesima
 * del umbral. Por eso la conversion esta en `normalizeForMatch` y no aqui.
 */
const PROPIO_MINIMO: MatchConfidence[] = ['exact', 'likely'];

/** `true` si esta confianza alcanza para marcar el juego como propio. */
export function cuentaComoPropio(confianza: MatchConfidence): boolean {
  return PROPIO_MINIMO.includes(confianza);
}
