import { normalizeTag, type IGameKey, type ITag } from '@/contracts';

/**
 * El catalogo de etiquetas, en el orden en que se pinta.
 *
 * Por usos y no alfabetico, y no es capricho: las que mas se usan son las que
 * se van a necesitar, y una lista de cuarenta etiquetas en orden alfabetico
 * obliga a leerla entera para encontrar la de humble. Las que no usa nadie van
 * al final, que es donde tiene sentido que esten.
 *
 * El desempate es alfabetico a proposito, para que el orden sea estable: con
 * los mismos datos tiene que salir la misma lista, o las etiquetas darían
 * saltos de sitio entre una apertura y otra sin que nada haya cambiado.
 */
export function sortTags(tags: readonly ITag[]): readonly ITag[] {
  return [...tags].sort((a, b) => {
    if (b.usos !== a.usos) return b.usos - a.usos;

    return a.nombre.localeCompare(b.nombre);
  });
}

/**
 * Cuenta cuantas claves lleva cada etiqueta.
 *
 * Las etiquetas viven en una columna de texto separada por comas, asi que no
 * hay forma de contarlas en SQL sin `LIKE` por cada una —y un `LIKE '%humble%'`
 * contaria tambien «superhumble»—. Se cuentan aqui, en una sola pasada por la
 * columna, que con cuatrocientas filas es imediata.
 */
export function contarUsos(
  tagsPorClave: readonly (readonly string[])[],
): Map<string, number> {
  const cuenta = new Map<string, number>();

  for (const tags of tagsPorClave) {
    // Lo que se muestra al lado de una etiqueta es «cuantas claves la llevan»,
    // no «cuantas veces se ha escrito». Una clave con «contexto,contexto» —que
    // se puede dar si dos pulsaciones se cruzan— lleva la etiqueta una vez, y
    // el `Set` es lo que lo garantiza.
    //
    // Y se cuenta por el nombre **normalizado**: las claves guardan las
    // etiquetas tal como se escribieron —«Cumplidos»— y el catalogo las guarda
    // normalizadas —«cumplidos»—, asi que sin normalizar las dos mitades no se
    // encuentran y todas las etiquetas salen con cero usos.
    for (const tag of new Set(tags.map(normalizeTag))) {
      cuenta.set(tag, (cuenta.get(tag) ?? 0) + 1);
    }
  }

  return cuenta;
}

/**
 * El nombre **tal como esta escrito**, de entre todos los que se usan.
 *
 * El catalogo guarda el nombre normalizado —es su clave primaria y por eso «
 * Cumplidos» y «cumplidos» no pueden ser dos etiquetas— pero las claves guardan
 * el texto que se escribio, con su caja. La etiqueta que se ve no puede ser una
 * de las dos cosas:
 *
 * - el nombre del catalogo, porque en la lista de una clave pone «Cumplidos» y
 *   en el filtro «cumplidos», y no se reconoce que son la misma;
 * - un nombre cualquiera, porque entonces «Cumplidos» y «cumplidos» podrian
 *   acabar siendo etiquetas distintas en la vista, aunque el filtro las ffi
 *   como una.
 *
 * Asi que se busca en las claves el nombre que ya se esta usando, y solo se cae
 * al del catalogo —normalizado— cuando ninguna clave lo lleva. Una etiqueta
 * creada desde Ajustes y todavia sin usar sale en minusculas porque es lo unico
 * que hay, y en cuanto se pone en una clave aparece con la caja que tiene.
 *
 * Se devuelven **todos** los que hay, y no solo el primero, porque una misma
 * etiqueta puede estar escrita de dos maneras en la coleccion y hay que elegir
 * la que mas se usa, no la que se encuentre antes.
 */
export function nombresDe(etiquetasDe: readonly (readonly string[])[]): Map<string, string> {
  const cuenta = new Map<string, Map<string, number>>();

  for (const etiquetas of etiquetasDe) {
    for (const etiqueta of new Set(etiquetas)) {
      const clave = normalizeTag(etiqueta);

      if (clave.length === 0) continue;

      const variantes = cuenta.get(clave);

      if (variantes === undefined) {
        cuenta.set(clave, new Map([[etiqueta, 1]]));
        continue;
      }

      variantes.set(etiqueta, (variantes.get(etiqueta) ?? 0) + 1);
    }
  }

  const nombres = new Map<string, string>();

  for (const [clave, variantes] of cuenta) {
    /*
     * A igual de veces gana el que va antes en el alfabeto.
     *
     * Sin ese desempate, una etiqueta repartida a partes iguales entre «
     * Cumplidos» y «cumplidos» —que se puede dar si se fue cambiando la caja—
     * podria salir con cualquiera de las dos, y cambiarla cada vez que se
     * abria el filtro. Con el, el mismo conjunto de claves produce siempre la
     * misma eleccion.
     */
    const elegida = [...variantes.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'),
    )[0];

    if (elegida !== undefined) nombres.set(clave, elegida[0]);
  }

  return nombres;
}

/**
 * Las etiquetas que llevan **todas** las claves de una lista.
 *
 * Sale del primer elemento y se va quitando lo que no comparte con el resto,
 * que es lo unico que se puede hacer en una pasada: cualquier etiqueta que
 * aparezca en todas las claves tiene que estar en la primera, asi que empezar
 * por ahi no deja ninguna fuera.
 *
 * Devuelve las de la primera clave **con su caja**, y no normalizadas: el
 * dialogo de etiquetas las enseña y si se normalizaran saldrian todas en
 * minusculas, que es justo lo que el usuario ya ve corregido en la lista.
 * Comparar con `includes` sin normalizar es correcto porque las etiquetas se
 * guardan normalizadas —ver `normalizeTag`— y por tanto dos etiquetas iguales
 * son la misma cadena.
 */
export function commonTags(entries: readonly IGameKey[]): readonly string[] {
  if (entries.length === 0) return [];

  const [primera, ...resto] = entries;

  // La lista vacia ya ha salido antes, pero `primera` sigue siendo
  // `IGameKey | undefined` para el typechecker y no comprueba rangos.
  if (primera === undefined) return [];

  return primera.tags.filter((tag) => resto.every((key) => key.tags.includes(tag)));
}
