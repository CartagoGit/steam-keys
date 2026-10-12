import type { KeyKind, KeyScope } from '../enums/key-scope.enum';
import type { KeyPlatform } from '../enums/key-platform.enum';
import type { KeyStatus } from '../enums/key-status.enum';

/**
 * Filtros que aplica la vista de lista. Todos opcionales y combinables.
 *
 * `scope` y `kind` son grupos de opciones excluyentes y van aparte del resto
 * porque se muestran como selectores y no como chips: son la decision principal
 * de que se esta viendo, no un recorte fino.
 */
export interface IKeyFilter {
  /** Texto libre sobre titulo, clave, destinatario y nota. */
  search: string;

  /** Todos, o solo las que siguen disponibles. */
  scope: KeyScope;

  /** Todos, solo juegos base, o solo DLC. */
  kind: KeyKind;

  /**
   * Si esta vacio, no se filtra por plataforma.
   *
   * No lleva candado, y no es una falta: una clave tiene **una sola**
   * plataforma, asi que «Steam **y** Epic» no devuelve nada ni con la
   * coleccion entera. Un filtro que solo puede devolver la lista vacia no es
   * un filtro. El candado lo lleva el de etiquetas, que si puede pedir AND.
   */
  platforms: readonly KeyPlatform[];

  /**
   * Si esta vacio, no se filtra por estado.
   *
   * Cuando `scope` es "solo disponibles" este filtro **no se aplica**: el
   * selector de estado se apaga, porque combinar "solo disponibles" con
   * "muestra las regaladas" no significa nada.
   *
   * Tampoco lleva candado, por lo mismo que `platforms`: una clave tiene un
   * solo estado.
   */
  statuses: readonly KeyStatus[];

  /**
   * Si esta vacio, no se filtra por etiqueta.
   *
   * Se guardan **normalizadas** —`normalizeTag`—, que es como las guarda el
   * resto de la app: la etiqueta de una clave, la del catalogo y la de aqui
   * tienen que ser la misma cadena para poder compararse con `===` sin
   * canonicalizar en cada comparacion.
   *
   * Varias a la vez significa «OR» por defecto: una clave que lleve cualquiera
   * de ellas sale. Es lo que espera quien marca tres etiquetas para ver «lo mio
   * de este tema», no «lo que lleva las tres», que no suele ser nada.
   *
   * Con `excluir` la cosa se da vuelta y pasa a ser «AND»: hay que llevar
   * **todas** las marcadas. Es el otro filtro que se quiere a veces —«cumplidos
   * **y** regalados»— y con OR no hay manera de pedirlo, porque sale tambien lo
   * que solo cumple una.
   */
  tags: readonly string[];

  /**
   * Que varias etiquetas marcadas sean «una o la otra» o «esta y la otra».
   *
   * `false` —lo normal— es OR. `true` es AND.
   *
   * Vive en el filtro y no dentro de las etiquetas porque es una pregunta por
   * filtro, no una propiedad de las etiquetas. Con ninguna marcada no dice
   * nada, asi que en los dos modos el resultado es el mismo.
   *
   * Y con una sola marcada tampoco: una etiqueta se cumple o no se cumple. Por
   * eso el boton **no se apaga** con una —si se apagara, no se podria dejar el
   * modo puesto antes de seguir marcando, que es justo cuando se decide—.
   *
   * **Es el unico filtro con candado**, y no por gusto sino porque es el
   * unico que puede pedir las dos cosas: una clave lleva todas las etiquetas
   * que lleva, y por eso «cumplidos **y** regalados» existe.
   */
  excluir?: boolean;
}

/** Resumen para la barra de estadisticas. */
export interface IKeyStats {
  total: number;
  available: number;
  gifted: number;
  redeemed: number;
  expired: number;
  unknown: number;
  byPlatform: Readonly<Record<string, number>>;
  /** Cuantas claves son juego base y cuantas DLC. */
  games: number;
  addOns: number;
  /** Claves visibles con los filtros actuales. */
  visible: number;
}