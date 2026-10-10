/**
 * Deteccion del entorno de ejecucion.
 *
 * La app se ejecuta dentro de Tauri (ventana nativa + SQLite) pero el mismo
 * front se puede abrir en un navegador para trabajar en la UI sin compilar
 * Rust. Este modulo es el unico que conoce esa diferencia.
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

/** `true` si corremos en el navegador, sin base de datos nativa. */
export function isBrowserPreview(): boolean {
  return !isTauri() && typeof window !== 'undefined';
}