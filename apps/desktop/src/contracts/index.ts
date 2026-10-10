/**
 * Punto de entrada unico a los contratos compartidos.
 *
 * Cualquier modulo de la app importa de aqui:
 *
 *   import { KeyStatus, type IGameKey } from '@/contracts';
 *
 * Los tres sub-barriles siguen existiendo por si se quiere un import mas
 * estrecho (`@/contracts/enums`, `@/contracts/interfaces`, `@/contracts/constants`).
 */

export * from './constants/index';
export * from './enums/index';
export * from './interfaces/index';