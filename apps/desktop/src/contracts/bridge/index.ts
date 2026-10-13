/**
 * Barril del puente de desarrollo.
 *
 * Importar desde aqui: `@/contracts/bridge`. Lo consumen los dos lados del
 * puente —el servidor, que monta los manejadores, y el cliente del navegador,
 * que construye las peticiones— y ninguno de los dos puede viver sin el otro,
 * asi que la lista de operaciones es una sola por definicion.
 */
export type {
  IBridgeOperations,
  IBridgeContext,
  BridgeHandlers,
  BridgeOperationName,
  BridgeArgs,
  BridgeResult,
} from './bridge-operations';