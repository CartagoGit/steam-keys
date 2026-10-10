/** Como se esta guardando la coleccion en este momento. */
export enum StorageMode {
  /** App de escritorio: SQLite nativo, en disco, con copias de seguridad. */
  Tauri = 'tauri',
  /** `bun run dev`: SQLite real a traves del puente de desarrollo. */
  DevBridge = 'dev-bridge',
  /** Build estatico servido sin Tauri: solo `localStorage`. */
  Memory = 'memory',
}