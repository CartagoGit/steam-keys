import { KeyStatus, type IImportRow, type IImportSummary } from '@/contracts';

/**
 * El resumen de una importacion, igual en los dos repositorios.
 *
 * `MemoryGameKeyRepository` y `SqliteGameKeyRepository` implementan el mismo
 * `importRows()` y solo se diferencian en como escriben. El resumen que
 * devuelven —cuantas entradas, cuantas repetidas, cuantas regaladas— tiene que
 * ser el mismo en los dos, porque es lo que despues lee la pantalla para decir
 * «30 anadidas, 4 repetidas». Tenian el objeto entero escrito dos veces, y
 * anadir un campo obligaba a acordarse de los dos sitios; si uno se quedaba
 * corto, el navegador y el escritorio contaban cosas distintas.
 *
 * `issues` va a cero a proposito y no es un olvido: el repositorio no puede
 * saber cuantas lineas no se pudieron leer, porque esa cuenta la hace el
 * analizador antes de llamar aqui. La sobreescribe `game-key.service` con la
 * del analizador. Lo que se queda en cero es el dato de este ambito, que no lo
 * tiene.
 */
export function resumenDeImportacion(
  rows: readonly IImportRow[],
  inserted: number,
  alreadyInDb: number,
): IImportSummary {
  return {
    inserted,
    skipped: rows.length - inserted,
    duplicates: alreadyInDb,
    gifted: rows.filter((row) => row.status === KeyStatus.Gifted).length,
    available: rows.filter((row) => row.status === KeyStatus.Available).length,
    issues: 0,
    alreadyInDb,
  };
}