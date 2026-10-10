/** Resumen de una operacion de importacion/exportacion. */
export interface IImportSummary {
  inserted: number;
  skipped: number;
  duplicates: number;
  gifted: number;
  available: number;
  /** Numero de lineas del TXT que no se pudieron interpretar. */
  issues: number;
  /** Claves ya presentes en la base de datos. */
  alreadyInDb: number;
}

/** Una fila tal y como la devuelve SQLite, antes de convertirse en `IGameKey`. */
export interface IGameKeyRow {
  id: number;
  title: string;
  key_value: string;
  platform: string;
  status: string;
  source: string;
  gifted_to: string | null;
  parent_title: string | null;
  note: string | null;
  tags: string | null;
  added_on: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Fila para upsert masivo durante la importacion. */
export interface IImportRow {
  title: string;
  keyValue: string;
  platform: string;
  status: string;
  source: string;
  giftedTo: string | null;
  parentTitle: string | null;
  note: string | null;
  tags: string;
  addedOn: string | null;
}

/** Configuracion del pool de la base de datos. */
export interface IDatabaseOptions {
  /** Cadena de conexion de Tauri, p.ej. `sqlite:steam-keys.db`. */
  connection: string;
  /** Crea las tablas si no existen. Por defecto `true`. */
  migrate?: boolean;
}