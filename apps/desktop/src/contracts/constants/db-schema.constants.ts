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
];

/** Indices que se consultan para buscar rapido. */
export const SEARCHABLE_COLUMNS: readonly string[] = [
  'title',
  'key_value',
  'gifted_to',
  'note',
  'parent_title',
];