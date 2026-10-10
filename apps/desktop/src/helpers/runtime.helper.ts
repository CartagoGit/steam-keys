import { StorageMode } from '@/contracts/enums/storage-mode.enum';

export { StorageMode };

/** Texto corto para cada modo, mostrado en la interfaz. */
export const STORAGE_MODE_LABEL: Readonly<Record<StorageMode, string>> = Object.freeze({
  [StorageMode.Tauri]: 'App de escritorio',
  [StorageMode.DevBridge]: 'Desarrollo (BD real)',
  [StorageMode.Memory]: 'Vista previa en navegador',
});

/** Aviso de cada modo sobre lo que sobrevive y lo que no. */
export const STORAGE_MODE_NOTICE: Readonly<Record<StorageMode, string>> = Object.freeze({
  [StorageMode.Tauri]:
    'Las claves estan en tu disco, en una base de datos SQLite, con copias de seguridad automaticas.',
  [StorageMode.DevBridge]:
    'Estás viendo la base de datos real a través del puente de desarrollo. Lo que edites aquí se guarda en ella.',
  [StorageMode.Memory]:
    'Vista previa en navegador: los datos viven en localStorage y se pierden si limpias los datos del navegador.',
});

/**
 * Deteccion del entorno de ejecucion.
 *
 * La app se ejecuta dentro de Tauri (ventana nativa y plugin SQL), pero el
 * mismo front se puede abrir en un navegador. Este modulo es el unico que
 * conoce esa diferencia: decide que motor de almacenamiento se usa y deja que
 * la UI diga la verdad en vez de suponer.
 */

/** `true` si estamos dentro del shell de Tauri. */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    navigator.userAgent.includes('Tauri')
  );
}

/** `true` si hay un motor real sobre el que trabajar (no `localStorage`). */
export function isDevBridge(): boolean {
  if (typeof window === 'undefined') return false;
  if (!import.meta.env.DEV) return false;

  // El token solo existe si el plugin de Vite esta inyectandolo.
  return typeof __STEAM_KEYS_DEV_TOKEN__ === 'string' && __STEAM_KEYS_DEV_TOKEN__.length > 0;
}

declare const __STEAM_KEYS_DEV_TOKEN__: string | undefined;

/** Modo de almacenamiento de esta sesion. */
export function getStorageMode(): StorageMode {
  if (isTauri()) return StorageMode.Tauri;
  if (isDevBridge()) return StorageMode.DevBridge;

  return StorageMode.Memory;
}

/**
 * `true` si los datos viven en SQLite.
 *
 * Con el puente de desarrollo tambien son persistentes, pero las copias de
 * seguridad son una funcion de Tauri: por eso se consulta por separado.
 */
export function isPersistent(): boolean {
  return getStorageMode() !== StorageMode.Memory;
}

/** `true` si se pueden crear y restaurar copias de seguridad. */
export function supportsBackups(): boolean {
  return isTauri();
}

/** `true` si solo hay `localStorage` detrás. */
export function isBrowserPreview(): boolean {
  return getStorageMode() === StorageMode.Memory;
}