import { TAG_TONES_DEDUCIDOS, normalizeTag, type ITag, type TagColor } from '@/contracts';

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
 * El tono de una etiqueta que **no tiene ninguno elegido**.
 *
 * Sale de las letras del nombre, y por eso es fijo: la misma etiqueta sale del
 * mismo color en el filtro, en la fila y en el selector, y no cambia entre una
 * sesion y otra. Con un color al azar —`Math.random`— la lista de etiquetas
 * bailaria en cada recarga; con uno fijo por categoria habria que mantener una
 * tabla a mano y basta con que alguien llame «dlc» a «dlc extra» para que las
 * dos se queden sin sitio en ella.
 *
 * Multiplicar por 31 antes de sumar es lo que reparte: con una suma a secas,
 * «dlc» y «dld» darian el mismo color, que es justo lo que no se quiere en
 * etiquetas que se parecen. El numero grande del final es para que el resto no
 * se agrupe siempre en un principio de la lista.
 *
 * De `TAG_TONES_DEDUCIDOS` y no de `TAG_TONES`: por defecto son diluidos. Un
 * color entero en cada etiqueta de cada fila hace que la lista parezca una
 * tabla de estados y que no se distinga lo que alguien ha marcado a proposito
 * de lo que sale solo.
 */
export function tonoPorDefecto(nombre: string): TagColor {
  let suma = 0;

  for (let i = 0; i < nombre.length; i += 1) {
    suma = (suma * 31 + nombre.charCodeAt(i)) % 9973;
  }

  /*
   * El resto no puede salirse: `suma` ya esta acotado por el modulo de arriba y
   * el divisor es el tamano de la paleta. El `??` esta por el tipo —con
   * `noUncheckedIndexedAccess` leer un indice variable devuelve «o nada»— y
   * dice ahi lo que haria si alguna vez pudiera pasar, en vez de callarlo con
   * un `!`.
   */
  const color = TAG_TONES_DEDUCIDOS[suma % TAG_TONES_DEDUCIDOS.length];

  return color ?? 'accent';
}

/**
 * El color con el que se pinta una etiqueta, elegido o deducido.
 *
 * Toda etiqueta visible pasa por aqui. Concentrarlo en un sitio es lo que hace
 * que «dlc» se vea igual en la fila y en el filtro: si cada sitio hiciera su
 * cuenta —`color || DEFAULT`— bastaria con que uno se olvidara y se tuviera la
 * misma palabra en dos colores, que es el fallo que no se nota hasta que se
 * busca.
 */
export function colorDe(tag: Pick<ITag, 'nombre' | 'color'>): TagColor {
  return tag.color === '' ? tonoPorDefecto(tag.nombre) : tag.color;
}
