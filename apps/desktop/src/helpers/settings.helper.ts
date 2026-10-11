import {
  APP_LOCALE_VALUES,
  APP_THEME_VALUES,
  APP_VIEW_VALUES,
  AppTheme,
  AppView,
  BACKUP_REASON_VALUES,
  BackupReason,
  DEFAULT_KEY_KIND,
  DEFAULT_KEY_SCOPE,
  DEFAULT_LOCALE,
  DEFAULT_VIEW,
  KEY_KIND_VALUES,
  KEY_SCOPE_VALUES,
  KeyKind,
  KeyScope,
  type AppLocale,
} from '@/contracts';

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
 * Lee un enum desde el texto guardado, con reserva.
 *
 * Todos los lectores de la tabla de ajustes son esto con distinta lista, asi
 * que viven aqui para que no se repitan cinco veces. Lo importante es que la
 * comprobacion va **contra la lista completa**, no contra un par de valores:
 * cuando se comprobaba solo `dark` y `light`, al anadir `midnight` y `paper` los
 * dos temas nuevos se guardaban bien pero al releerse caian en `system`, y el
 * tema elegido se perdia al reiniciar. Anadir un valor nuevo al enum no puede
 * volver a romperlo.
 */
export function readEnum<T extends string>(
  value: string | undefined | null,
  valores: readonly T[],
  porDefecto: T,
): T {
  return valores.includes(value as T) ? (value as T) : porDefecto;
}

/** Lee el tema de la interfaz. */
export function readTheme(value: string | undefined): AppTheme {
  return readEnum(value, APP_THEME_VALUES, AppTheme.System);
}

/**
 * Lee el idioma de la interfaz.
 *
 * Los ultimos estan a medio traducir y caen al castellano, que es el idioma de
 * origen y siempre esta completo.
 */
export function readLocale(value: string | undefined): AppLocale {
  return readEnum(value, APP_LOCALE_VALUES, DEFAULT_LOCALE);
}

/** Lee el ambito del filtro. */
export function readScope(value: string | undefined): KeyScope {
  return readEnum(value, KEY_SCOPE_VALUES, DEFAULT_KEY_SCOPE);
}

/** Lee el tipo de clave del filtro. */
export function readKind(value: string | undefined): KeyKind {
  return readEnum(value, KEY_KIND_VALUES, DEFAULT_KEY_KIND);
}

/** Lee la vista abierta. */
export function readView(value: string | undefined): AppView {
  return readEnum(value, APP_VIEW_VALUES, DEFAULT_VIEW);
}

/**
 * Lee el motivo de una copia de seguridad.
 *
 * Una copia creada por una version anterior puede tener un motivo que este
 * proyecto ya no conoce. Se cae a `manual`, que siempre existe, en vez de
 * dejar que el motivo llegue a la interfaz y se pinte en crudo.
 */
export function readBackupReason(value: string | undefined): BackupReason {
  return readEnum(value, BACKUP_REASON_VALUES, BackupReason.Manual);
}