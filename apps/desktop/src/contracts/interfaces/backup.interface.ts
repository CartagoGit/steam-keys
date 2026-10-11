import type { StorageHealth } from '../enums/storage-health.enum';

/** Datos del fichero de base de datos en disco. */
export interface IDatabaseInfo {
  /** Ruta completa del fichero. */
  path: string;
  /** `false` si todavia no se ha creado. */
  exists: boolean;
  /** Tamaño en bytes. `0` si el fichero no existe. */
  sizeBytes: number;
  /**
   * `true` si los datos estan al lado del ejecutable y no en la carpeta de
   * configuracion del sistema.
   */
  portable: boolean;
}

/**
 * Una copia de seguridad.
 *
 * Ya no es un fichero: son las filas de la tabla `backups`. Por eso no hay
 * `path`—antes era la del `.db` en la carpeta `backups/`, y eso ya no existe—
 * y aparece `rowCount`, que antes no se podia saber sin abrir la copia.
 */
export interface IBackup {
  /** Nombre de la copia. Es su identificador. */
  name: string;
  /** Por que se hizo: `manual`, `antes-de-importar`… */
  reason: string;
  /** Cuantas claves contiene. `-1` si no se pudo leer el contenido. */
  rowCount: number;
  /** Tamaño del contenido de la copia. */
  sizeBytes: number;
  /** Epoch en milisegundos, para formatearlo en la interfaz. */
  createdAtMs: number;
}

/** Resultado de restaurar una copia. */
export interface IRestoreSummary {
  /** Filas que estaban en la copia. */
  total: number;
  /** Claves nuevas que no estaban en la base de datos. */
  inserted: number;
  /** Claves que ya existian y se han dejado como estaban. */
  skipped: number;
  /** Claves existentes cuyo estado se ha actualizado. */
  updated: number;
}

/** Resumen de almacenamiento, para el panel de datos. */
export interface IStorageInfo {
  /** Ruta del fichero de base de datos. `null` en la vista de navegador. */
  databasePath: string | null;
  /** `true` si los datos viven en SQLite y no en memoria. */
  persistent: boolean;
  /**
   * `true` si los datos estan al lado del ejecutable (modo portable).
   *
   * Importa porque en ese modo las claves viajan con la carpeta del programa:
   * si mueves el ejecutable, te quedas sin ellas salvo que copies tambien el
   * `.db`. En el modo normal no hay que hacer nada, de ahi que el panel lo diga.
   */
  portable: boolean;
  /** Tamaño del fichero, en bytes. `0` si no se puede conocer. */
  databaseSizeBytes: number;
  /** Numero de claves almacenadas. */
  totalKeys: number;
  /** Numero de claves con plataforma sin determinar, que piden revision. */
  unknownPlatform: number;
  backups: readonly IBackup[];
  health: StorageHealth;
  /** Detalle de la comprobacion, si hubo algo que reseñar. */
  healthDetail: string | null;
}