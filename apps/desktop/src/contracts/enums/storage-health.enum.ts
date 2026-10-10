/** Estado de la salud de la base de datos. */
export enum StorageHealth {
  /** Se pudo abrir y leer sin problemas. */
  Ok = 'ok',
  /** Se abrio, pero SQLite reporta problemas internos. */
  Degradado = 'degradado',
  /** No se pudo comprobar. */
  Desconocido = 'desconocido',
}