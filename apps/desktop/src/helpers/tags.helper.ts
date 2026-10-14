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
