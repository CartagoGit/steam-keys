/**
 * Piezas de SQL que se usan en mas de un sitio.
 *
 * Existe por un motivo concreto: los marcadores de posicion (`$1`, `$2`, …) se
 * numeran a mano y **dos listas en la misma sentencia se pisan en silencio**.
 *
 * No es hipotetico. `setTagsMany` hacia
 *
 * ```sql
 * UPDATE game_keys SET tags = $1, updated_at = $2 WHERE id IN ($2, $3)
 * ```
 *
 * con el bind `[tags, sello, ...ids]`. `$2` significaba a la vez la fecha y la
 * primera clave, asi que se actualizaba una clave que no estaba en la lista y
 * se dejaba sin tocar la que si. La app no daba ningun error: SQLite ejecutaba
 * la sentencia y el resultado era sencillamente el equivocado.
 *
 * Por eso los ids empiezan donde toca, explicito, y no con un `+ 2` repetido
 * en cada llamada.
 */

/**
 * Lista de marcadores para un `IN (...)`.
 *
 * @param total Cuantos marcadores hacer.
 * @param primero Numero del **primer** marcador. Se dice a mano porque depende
 * de cuantos valores fijos haya antes en la sentencia, y equivocarse aqui es
 * justo el fallo que se quiere evitar.
 */
export function sqlPlaceholders(total: number, primero = 1): string {
  return Array.from({ length: total }, (_, indice) => `$${primero + indice}`).join(', ');
}