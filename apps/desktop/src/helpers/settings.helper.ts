import { DEFAULT_LOCALE, APP_LOCALE_VALUES } from '@/contracts/enums/app-locale.enum';
import { APP_THEME_VALUES, AppTheme } from '@/contracts/enums/app-theme.enum';
import type { AppLocale } from '@/contracts/enums/app-locale.enum';

/**
 * Lectura y escritura de valores en la tabla de ajustes.
 *
 * SQLite no tiene booleano ni enumeraciones: todo son cadenas. Estas funciones
 * son la **frontera** entre lo que se guarda y lo que entiende el resto de la
 * app, y estan separadas del servicio a proposito. Cuando una conversion
 * sale mal, el fallo se detecta en un test en vez de abrir los ajustes y
 * descubrir que el tema elegido no se guardo.
 *
 * La regla es siempre la misma: **lo que no se reconoce se sustituye por el
 * valor por defecto, nunca se propaga**. Un ajuste raro puede venir de una
 * base de datos de una version anterior o de una fila editada a mano, y en los
 * dos casos lo sensato es arrancar con algo que exista.
 */

/** Pasa un valor de `IAppSettings` a lo que se guarda en la tabla. */
export function serializeSetting(
  value: string | number | boolean | null | undefined,
): string {
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value === null || value === undefined) return '';

  return String(value);
}

/**
 * Lee un booleano.
 *
 * Solo se acepta `'1'` y `'true'`. Cualquier otra cosa —incluido `'0'`— es
 * `false`, que es lo que corresponde a "no esta activado". Aceptar cualquier
 * valor no vacio hacia que una fila con `0` activating el ajuste.
 */
export function readBool(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

/**
 * Lee el tema de los cinco valores.
 *
 * La comprobacion va contra la lista, no contra una comparacion con `dark` y
 * `light`: al anadir `midnight` y `paper` la comparacion se quedo corta y los
 * dos temas nuevos se guardaban bien pero al releerse caian en `system`, de
 * modo que el tema elegido se perdia al reiniciar. Comprobar contra la lista
 * hace que anadir un tema nuevo no pueda volver a romperlo.
 */
export function readTheme(value: string | undefined): AppTheme {
  return APP_THEME_VALUES.includes(value as AppTheme)
    ? (value as AppTheme)
    : AppTheme.System;
}

/**
 * Lee el idioma de los cinco valores.
 *
 * Los tres ultimos (fr, pt, ca) estan a medio traducir y caen al castellano,
 * que es el idioma de origen y siempre esta completo.
 */
export function readLocale(value: string | undefined): AppLocale {
  return APP_LOCALE_VALUES.includes(value as AppLocale)
    ? (value as AppLocale)
    : DEFAULT_LOCALE;
}