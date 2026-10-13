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
   * El catalogo de etiquetas, en su propia tabla.
   *
   * Las etiquetas de cada clave siguen viviendo en su columna de texto, en
   * `game_keys.tags`. Normalizar eso a una tabla puente obligaria a migrar las
   * cuatrocientas filas que ya hay y a reescribir cada consulta, y no mejora
   * nada que se note: cuatrocientas filas con unas pocas etiquetas cada una
   * se leen enteras sin problema.
   *
   * Lo que faltaba era el **catalogo**: la lista de etiquetas que existen en la
   * app y se pueden volver a usar. Antes se reconstruia en memoria cada vez
   * que se abria el dialogo, aplanando todas las filas, y por eso no habia
   * forma de quitar una etiqueta que hubiera dejado de servir ni de saber
   * cuantas claves usaban cada una.
   *
   * Solo el nombre, sin id ni contador. Los usos se cuentan leyendo la columna
   * de las claves, que es la unica que dice la verdad: un contador guardado
   * aqui se desincroniza en cuanto una etiqueta se pone o se quita a una clave
   * por cualquier via.
   *
   * `nombre` es la clave primaria ya normalizada, asi que «humble» y «Humble »
   * son la misma fila y no pueden coexistir.
   */
  `CREATE TABLE IF NOT EXISTS tags (
     nombre TEXT PRIMARY KEY,
     color  TEXT NOT NULL DEFAULT ''
   );`,

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
export const TABLE_TAGS = 'tags';

/**
 * Columnas que se han anadido a una tabla **despues** de crearla.
 *
 * `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe: quien ejecuto
 * la version anterior se queda con la forma de entonces y no se entera. Por eso
 * la columna de arriba esta en el DDL *y* aqui, y las dos cosas tienen que
 * estar: el DDL para las bases nuevas y esta lista para las que ya hay.
 *
 * Cada entrada trae el `ALTER TABLE` **entero**, y no sus partes, porque SQLite
 * no tiene `ADD COLUMN IF NOT EXISTS` y porque SQLite tampoco admite
 * parametrizar un identificador —el nombre de la tabla y el de la columna van
 * dentro de la cadena—: dejarlos montados aqui, con `TABLE_TAGS` en su sitio,
 * es lo unico que hace que el `no-inline-sql` siga viendo solo identificadores
 * conocidos y no un `${algo}` suelto.
 *
 * El `PRAGMA` va tambien entero por lo mismo: es la forma de preguntar si la
 * columna existe **en esa base de datos**, que es un estado y no una
 * definicion, asi que la pregunta no puede estar en el esquema.
 */
/**
 * Version del esquema, guardada en `app_settings`.
 *
 * Todas las sentencias de `SCHEMA_STATEMENTS` son idempotentes y se ejecutan
 * todas en cada arranque, lo que son **nueve viajes** para no cambiar nada en
 * una base ya al dia. Con esta marca, `crearEsquema` pregunta primero y solo
 * entra si la base va por detras.
 *
 * **Hay que subirla cuando se toque el esquema.** No hay ninguna forma de que se
 * avise sola: `CREATE TABLE IF NOT EXISTS` es idempotente precisamente porque
 * no distingue una base nueva de una ya hecha, que es justo lo que hace falta
 * distinguir aqui.
 */
export const CLAVE_VERSION_ESQUEMA = 'schemaVersion';

/** Version del esquema tal y como esta este codigo. */
export const VERSION_ESQUEMA = 2;

export const COLUMNAS_ANADIDAS: readonly IColumnaAnadida[] = Object.freeze([
  Object.freeze({
    tabla: TABLE_TAGS,
    columna: 'color',
    leer: `PRAGMA table_info(${TABLE_TAGS})`,
    agregar: `ALTER TABLE ${TABLE_TAGS} ADD COLUMN color TEXT NOT NULL DEFAULT ''`,
  }),
]);

/** Una columna que se anade a una tabla que ya puede existir. */
export interface IColumnaAnadida {
  /** Tabla a la que se anade. */
  tabla: string;
  /** Nombre de la columna nueva. */
  columna: string;
  /** El `PRAGMA` que dice si ya esta. */
  leer: string;
  /** El `ALTER TABLE` que la anade. */
  agregar: string;
}

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