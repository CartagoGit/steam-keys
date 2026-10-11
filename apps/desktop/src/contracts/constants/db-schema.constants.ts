/**
 * Esquema SQLite de la app.
 *
 * Vive en TypeScript, no en Rust, para que haya una unica fuente de verdad y
 * los adaptadores de navegador y de Tauri compartan exactamente el mismo DDL.
 * Todas las sentencias son idempotentes: `migrate()` se puede llamar siempre.
 */

export const SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS game_keys (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     title        TEXT    NOT NULL,
     key_value    TEXT    NOT NULL,
     platform     TEXT    NOT NULL DEFAULT 'steam',
     status       TEXT    NOT NULL DEFAULT 'available',
     source       TEXT    NOT NULL DEFAULT 'manual',
     gifted_to    TEXT    NULL,
     parent_title TEXT    NULL,
     note         TEXT    NULL,
     tags         TEXT    NOT NULL DEFAULT '',
     added_on     TEXT    NULL,
     last_used_at TEXT    NULL,
     created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
     updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
   );`,

  // Una misma clave no puede aparecer dos veces. Normalizamos el valor en la
  // capa de escritura (sin espacios, en mayusculas) antes de insertar.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_game_keys_key_value
     ON game_keys (key_value);`,

  `CREATE INDEX IF NOT EXISTS idx_game_keys_status
     ON game_keys (status);`,

  `CREATE INDEX IF NOT EXISTS idx_game_keys_platform
     ON game_keys (platform);`,

  `CREATE INDEX IF NOT EXISTS idx_game_keys_title
     ON game_keys (title);`,

  /**
   * Ajustes de la aplicacion, en pares clave/valor.
   *
   * Se guardan asi a proposito, y no como columnas: anadir un ajuste nuevo
   * (el idioma, un tema, la clave de la API de Steam) debe consistir en un
   * `INSERT` mas y no en un `ALTER TABLE` que obliga a migrar a quien ya tiene
   * la base de datos creada.
   */
  `CREATE TABLE IF NOT EXISTS app_settings (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL DEFAULT ''
   );`,

  /**
   * Copias de seguridad, **dentro** de la propia base de datos.
   *
   * Antes eran ficheros sueltos en una carpeta `backups/` al lado del
   * ejecutable, y eso obliga a mover tres cosas en vez de dos al cambiar de
   * carpeta o pasarlo a un USB.
   *
   * Lo que se guarda son **las filas**, no una copia del fichero, y no es un
   * detalle menor: si cada copia guardase el fichero entero, incluiria las
   * copias anteriores y el crecimiento seria del orden del doble en cada
   * copia —156 KB de datos se convertian en 156 MB con diez copias—. Con las
   * filas, el crecimiento es lineal y diez copias ocupan lo que ocupa la tabla
   * de claves unas cuantas veces.
   *
   * `contenido` es el JSON de las filas de `game_keys`, porque es justo lo que
   * necesita `mergeKeysFromBackup` para restaurar. Como ademas no hay que
   * montar una segunda conexion SQLite sobre un fichero temporal para leer la
   * copia, tambien es menos codigo que el que habia antes.
   */
  `CREATE TABLE IF NOT EXISTS backups (
     nombre     TEXT PRIMARY KEY,
     reason     TEXT    NOT NULL DEFAULT '',
     creado_ms  INTEGER NOT NULL,
     contenido  TEXT    NOT NULL
   );`,
];

/** Cuantas copias de seguridad se conservan como maximo. */
export const MAX_BACKUPS = 10;

/**
 * Nombres de tabla, junto al DDL que las crea.
 *
 * Van aqui porque el nombre de una tabla aparece en cada sentencia que la
 * toca, y de cinco ficheros a la vez: repositorios, servicios y el puente.
 * Escritos a mano, un `CREATE TABLE backups` anadido al esquema no llegaria a
 * las consultas, y el fallo sale como `no such table`, que no senala el sitio
 * donde esta la diferencia.
 *
 * Son para el SQL. El DDL de arriba los lleva escritos dentro porque ahi no hay
 * forma de concatenar una constante sin perder la sentencia legible.
 */
export const TABLE_GAME_KEYS = 'game_keys';
export const TABLE_APP_SETTINGS = 'app_settings';
export const TABLE_BACKUPS = 'backups';

/**
 * Columnas de `game_keys` que se escriben, en el orden del esquema.
 *
 * Es la **unica** lista de columnas de la tabla, y de ella salen las dos que se
 * usan en SQL: la del `SELECT` —la de `GAME_KEY_COLUMNS`, con `id` delante— y la
 * del `INSERT`. Escribir las dos a mano hacia que se separen: se anade una
 * columna al `INSERT` y el `SELECT` se queda sin ella, o al reves, y en los dos
 * casos la fila se lee a medias sin que nada falle.
 *
 * Va aqui y no junto a quien la usa porque este fichero **es** el esquema: el
 * DDL de arriba, los nombres de tabla y las columnas de `game_keys` son la misma
 * verdad y tienen que estar en el mismo sitio. Los scripts de `tools/scripts/`
 * escriben SQL contra esta base y llegan aqui por el alias `@/`, asi que leen
 * exactamente la misma lista que la app. Cuando se escribia la lista en cada
 * consumidor —el alta, la importacion masiva, la restauracion y el importador
 * de linea de comandos— cualquier columna nueva se anadia en unos sitios y no
 * en otros, y la fila se guardaba con el valor por defecto sin decir nada.
 *
 * Van todas, tambien las que la entrada no trae —`last_used_at`—: el `INSERT` es
 * uno solo para todas las rutas que escriben, y las que no tienen ese valor
 * pasan `null`, que es lo que la columna admitia antes.
 */
export const GAME_KEY_WRITE_COLUMNS = [
  'title',
  'key_value',
  'platform',
  'status',
  'source',
  'gifted_to',
  'parent_title',
  'note',
  'tags',
  'added_on',
  'last_used_at',
  'created_at',
  'updated_at',
] as const;

/** Cuantos valores lleva la lista de valores de un `INSERT` de `game_keys`. */
export const GAME_KEY_INSERT_SIZE = GAME_KEY_WRITE_COLUMNS.length;

/** Columnas en el orden en que las devuelve `SELECT *`. */
export const GAME_KEY_COLUMNS = ['id', ...GAME_KEY_WRITE_COLUMNS].join(', ');