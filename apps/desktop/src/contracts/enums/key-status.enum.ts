/**
 * Estado comercial de una key dentro de la coleccion.
 *
 * `Available` es el unico estado por defecto de una key nueva: significa
 * "todavia en mis manos, regalable". El TXT original no distingue entre
 * caducada y sin caducidad conocida, asi que `Unknown` cubre "no lo se".
 */
export enum KeyStatus {
  /** En mis manos, pendiente de regalar. */
  Available = 'available',
  /** Ya regalada (el TXT la marcaba con un `-` inicial). */
  Gifted = 'gifted',
  /** Canjeada por mi (el TXT lo marcaba con `ACTIVAR YO`). */
  Redeemed = 'redeemed',
  /** Caducada por fecha limite de activacion superada. */
  Expired = 'expired',
  /** Estado desconocido o pendiente de revisar. */
  Unknown = 'unknown',
}

export const KEY_STATUS_VALUES: readonly KeyStatus[] = Object.freeze([
  KeyStatus.Available,
  KeyStatus.Gifted,
  KeyStatus.Redeemed,
  KeyStatus.Expired,
  KeyStatus.Unknown,
]);

/** Estados que la app considera "regalables hoy mismo". */
export const GIFTABLE_STATUSES: readonly KeyStatus[] = Object.freeze([
  KeyStatus.Available,
]);