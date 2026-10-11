/**
 * Que claves se ven segun su estado comercial.
 *
 * Tres opciones y solo una activa. "Todos" deja ver la coleccion entera, que
 * es lo que hace falta cuando buscas una clave concreta y no te importa si
 * esta canjeada; "Solo disponibles" deja solo las que aun tienes en la mano.
 */
export enum KeyScope {
  /** La coleccion entera. */
  All = 'all',
  /** Solo las que aun tengo y se pueden regalar o canjear. */
  Available = 'available',
}

/** El valor por defecto: lo que se usa el 90% del tiempo. */
export const DEFAULT_KEY_SCOPE: KeyScope = KeyScope.Available;

export const KEY_SCOPE_VALUES: readonly KeyScope[] = Object.freeze([
  KeyScope.All,
  KeyScope.Available,
]);

/**
 * Que clases se ven segun sean juego base o contenido extra.
 *
 * Es ortogonal al estado: una DLC puede estar disponible o regalada, asi que
 * son dos filtros independientes y por eso van en grupos separados. El nombre
 * `Kind` es a proposito, `OnlyDlc` era ambiguo con el estado.
 */
export enum KeyKind {
  /** Juegos y DLC por igual. */
  All = 'all',
  /** Solo el juego base. */
  Games = 'games',
  /** Solo DLC y contenido adicional. */
  Dlc = 'dlc',
}

export const DEFAULT_KEY_KIND: KeyKind = KeyKind.All;

export const KEY_KIND_VALUES: readonly KeyKind[] = Object.freeze([
  KeyKind.All,
  KeyKind.Games,
  KeyKind.Dlc,
]);