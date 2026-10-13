import {
  COLUMNAS_ANADIDAS,
  SCHEMA_STATEMENTS,
  type IDatabaseClient,
} from '@/contracts';

/**
 * Pone la base de datos al dia: crea lo que falte y anade lo que se quedo corto.
 *
 * Hay **un** sitio donde se hace y no uno por cliente de base de datos. El
 * bucle era una copia en los tres —el de Tauri, el del puente de desarrollo y
 * el de memoria—, y las copias son justo lo que se desincroniza: cuando se anadio
 * una tabla, habia que acordarse de las tres, y la que seolvido no fallaba
 * hasta mucho despues, con un `no such table` en la pantalla y sin relacion
 * apparentemente con el cambio.
 *
 * Por eso este fichero no hace nada raro: ejecuta `SCHEMA_STATEMENTS` —todo
 * idempotente— y despues recorre `COLUMNAS_ANADIDAS`, que es la parte que no
 * se puede escribir como idempotente porque SQLite no tiene
 * `ADD COLUMN IF NOT EXISTS`.
 */
export async function crearEsquema(db: IDatabaseClient): Promise<void> {
  for (const sentencia of SCHEMA_STATEMENTS) {
    await db.execute(sentencia);
  }

  for (const nueva of COLUMNAS_ANADIDAS) {
    /**
     * Se pregunta a la base, no a una constante.
     *
     * `PRAGMA table_info` devuelve las columnas que **esta** base tiene, que es
     * justo la pregunta: si la columna ya esta no se toca. Y se hace una vez por
     * columna y no una vez al abrir, porque el `ALTER` es lo unico de aqui que
     * puede fallar y no interesa fallar en cada arranque.
     */
    const info = await db.select<{ name: string }>(nueva.leer);

    if (info.some((columna) => columna.name === nueva.columna)) continue;

    await db.execute(nueva.agregar);
  }
}