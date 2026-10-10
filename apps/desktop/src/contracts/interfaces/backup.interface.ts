import type { StorageHealth } from '../enums/storage-health.enum';

/** Datos del fichero de base de datos en disco. */
export interface IDatabaseInfo {
  /** Ruta completa del fichero. */
  path: string;
  /** `false` si todavia no se ha creado. */
  exists: boolean;
  /** Tamaño en bytes. `0` si el fichero no existe. */
  sizeBytes: number;
}

/** Una copia de seguridad de la base de datos. */
export interface IBackup {
  /** Nombre del fichero dentro del directorio de copias. Es su identificador. */
  name: string;
  /** Ruta completa en disco, solo informativa. */
  path: string;
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