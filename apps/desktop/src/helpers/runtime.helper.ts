import { StorageMode, type TranslationKey } from '@/contracts';

export { StorageMode };

/**
 * Texto corto para cada modo, mostrado en la interfaz.
 *
 * Guarda **claves de traduccion**, no texto. Antes era el texto en castellano
 * y por eso el aviso de abajo salia en castellano con la app puesta en otros
 * idiomas.
 *
 * Que el tipo sea `string` no obliga a nada: no compila como red de seguridad
 * para esto. La obligacion la cumple el test de traduccion, que revisa que
 * estas claves existan en los cinco diccionarios.
 */
export const STORAGE_MODE_LABEL: Readonly<Record<StorageMode, TranslationKey>> =
  Object.freeze({
    [StorageMode.Tauri]: 'storage.mode.desktop',
    [StorageMode.DevBridge]: 'storage.mode.devBridge',
    [StorageMode.Memory]: 'storage.mode.memory',
  });

/** Aviso de cada modo sobre lo que sobrevive y lo que no. Tambien con claves. */
export const STORAGE_MODE_NOTICE: Readonly<Record<StorageMode, TranslationKey>> =
  Object.freeze({
    [StorageMode.Tauri]: 'storage.notice.desktop',
    [StorageMode.DevBridge]: 'storage.notice.devBridge',
    [StorageMode.Memory]: 'storage.notice.memory',
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

/**
 * `true` si se pueden crear y restaurar copias de seguridad.
 *
 * Las copias son filas de la tabla `backups` de la propia base de datos, no
 * ficheros ni comandos de Rust: funcionan siempre que haya un motor de verdad
 * detras. Antes de que fueran filas eran ficheros y solo se podian hacer desde
 * Tauri, y por eso esto era `isTauri()`. Ese predicado se quedo puesto cuando
 * el almacenamiento cambio, y el resultado era el contrario del real: la UI
 * deshabilitaba el boton de copia en el puente de desarrollo, que es donde se
 * prueba la interfaz, y lo hacia con el texto de "solo en la app de
 * escritorio". Una copia en la base de descartes no es asunto del usuario.
 *
 * Unica fuente de verdad. `backupService.available()` decia lo mismo con otro
 * nombre y no lo llamaba nadie.
 */
export function supportsBackups(): boolean {
  return isPersistent();
}