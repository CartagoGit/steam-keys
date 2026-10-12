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

  /** Si esta vacio, no se filtra por plataforma. */
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
   * Varias a la vez significa «OR»: una clave que lleve cualquiera de ellas
   * sale. Es lo que espera quien marca tres etiquetas para ver «lo mio de este
   * tema», no «lo que lleva las tres», que no suele ser nada.
   */
  tags: readonly string[];
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