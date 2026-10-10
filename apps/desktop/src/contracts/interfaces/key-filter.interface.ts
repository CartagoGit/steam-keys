import type { KeyPlatform } from '../enums/key-platform.enum';
import type { KeyStatus } from '../enums/key-status.enum';

/** Filtros que aplica la vista de lista. Todos opcionales y combinables. */
export interface IKeyFilter {
  /** Texto libre sobre titulo, clave, recipient y nota. */
  search: string;
  /** Si esta vacio, no se filtra por plataforma. */
  platforms: readonly KeyPlatform[];
  /** Si esta vacio, no se filtra por estado. */
  statuses: readonly KeyStatus[];
  /** Oculta las claves ya regaladas. */
  onlyGiftable: boolean;
  /** Muestra solo DLC / contenido adicional. */
  onlyAddOns: boolean;
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
  /** Claves visibles con los filtros actuales. */
  visible: number;
}
