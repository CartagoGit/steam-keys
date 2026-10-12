import type { ITag } from '@/contracts';

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
    for (const tag of new Set(tags)) {
      cuenta.set(tag, (cuenta.get(tag) ?? 0) + 1);
    }
  }

  return cuenta;
}
