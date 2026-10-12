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
   * Con `excluirPlataformas` se invierte: se descartan las marcadas en vez de
   * acotar a ellas.
   */
  platforms: readonly KeyPlatform[];

  /**
   * Si esta vacio, no se filtra por estado.
   *
   * Cuando `scope` es "solo disponibles" este filtro **no se aplica**: el
   * selector de estado se apaga, porque combinar "solo disponibles" con
   * "muestra las regaladas" no significa nada.
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
   */
  excluir?: boolean;

  /**
   * Plataformas marcadas que se **descartan** en vez de acotar.
   *
   * Aqui el candado no es OR/AND como en las etiquetas, porque una clave tiene
   * **una sola** plataforma: pedir «Steam **y** Epic» no devuelve nada nunca,
   * ni con una coleccion entera. De ahi que con candado abierto acote —«solo
   * Steam o Epic»— y con candado cerrado descarte —«todo menos Steam y Epic»—,
   * que es la unica lectura que si se puede pedir y es la que se quiere.
   */
  excluirPlataformas?: boolean;

  /** Estados marcados que se descartan, por el mismo motivo que las plataformas. */
  excluirEstados?: boolean;
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