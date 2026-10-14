/**
 * Punto de entrada unico a los contratos compartidos.
 *
 * Cualquier modulo de la app importa de aqui:
 *
 *   import { KeyStatus, type IGameKey } from '@/contracts';
 *
 * Los cuatro sub-barriles siguen existiendo por si se quiere un import mas
 * estrecho (`@/contracts/enums`, `@/contracts/interfaces`, `@/contracts/constants`).
 */

export * from './bridge/index';
export * from './constants/index';
export * from './enums/index';
export * from './errors/index';
export * from './interfaces/index';