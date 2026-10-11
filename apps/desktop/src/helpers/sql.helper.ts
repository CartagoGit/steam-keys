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
import {
  GAME_KEY_INSERT_SIZE,
  GAME_KEY_WRITE_COLUMNS,
  TABLE_GAME_KEYS,
} from '@/contracts';

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

/**
 * El `INSERT INTO game_keys`, con sus columnas y sus marcadores ya puestos.
 *
 * Habia tres sentencias escritas a mano para la misma tabla —el alta normal, la
 * importacion masiva y la restauracion desde una copia—, y las tres acabaron
 * divergiendo: la de la restauracion llevo `last_used_at` y las otras dos no, y
 * las de alta e importacion repetian `$11` para `created_at` y `updated_at`
 * porque las dos fechas son la misma. Un dia se anade una columna y solo se
 * recuerda en dos de las tres: no sale ningun error, la fila se inserta con el
 * valor por defecto y el dato se pierde en silencio.
 *
 * Ahora la lista sale de `GAME_KEY_WRITE_COLUMNS` y los marcadores de
 * `sqlPlaceholders`, asi que las tres rutas comparten una sola definicion.
 *
 * @param ignorarDuplicados `INSERT OR IGNORE`, para las rutas que pueden
 *   encontrar la clave ya puesta —reimportar el mismo TXT, restaurar dos veces
 *   la misma copia— y deben saltarse en vez de reventar contra el indice unico.
 */
export function gameKeyInsertStatement(ignorarDuplicados = false): string {
  const columnas = GAME_KEY_WRITE_COLUMNS.join(', ');

  return `INSERT ${ignorarDuplicados ? 'OR IGNORE ' : ''}INTO ${TABLE_GAME_KEYS}
           (${columnas})
         VALUES (${sqlPlaceholders(GAME_KEY_INSERT_SIZE)})`;
}