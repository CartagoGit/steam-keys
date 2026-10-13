import {
  CLAVE_VERSION_ESQUEMA,
  COLUMNAS_ANADIDAS,
  SCHEMA_STATEMENTS,
  TABLE_APP_SETTINGS,
  VERSION_ESQUEMA,
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
  /*
   * Una pregunta antes de nueve acciones.
   *
   * `SCHEMA_STATEMENTS` es todo idempotente, asi que ejecutarlo entero en cada
   * arranque funciona... y son nueve viajes al puente para no cambiar nada en
   * una base que ya esta al dia. Con la version guardada, lo normal es leer un
   * numero y salir.
   *
   * Se escribe **al final**, no al principio: si algo falla a medio —el DDL
   * entra pero las columnas no— la base se queda con la version de antes y el
   * siguiente arranque lo vuelve a intentar entero. Marcarla antes haria que un
   * fallo a medias se quedara para siempre.
   */
  const version = await leerVersion(db);

  if (version === VERSION_ESQUEMA) return;

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

  await db.execute(
    `INSERT INTO ${TABLE_APP_SETTINGS} (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [CLAVE_VERSION_ESQUEMA, String(VERSION_ESQUEMA)],
  );
}

/**
 * La version con la que esta construida la base, o `null` si no se sabe.
 *
 * Si la tabla `app_settings` no existe todavia —que es el caso de una base
 * recién creada— la consulta falla, y eso **no** es un error: significa
 * justamente que hay que desplegar el esquema entero.
 */
async function leerVersion(db: IDatabaseClient): Promise<number | null> {
  try {
    const filas = await db.select<{ value: string }>(
      `SELECT value FROM ${TABLE_APP_SETTINGS} WHERE key = $1`,
      [CLAVE_VERSION_ESQUEMA],
    );

    const version = Number.parseInt(filas[0]?.value ?? '', 10);

    return Number.isNaN(version) ? null : version;
  } catch {
    return null;
  }
}