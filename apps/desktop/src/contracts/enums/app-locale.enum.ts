/**
 * Idiomas de la interfaz.
 *
 * El español es el idioma de origen y nunca se puede quitar. Los demas se
 * anaden como traduccion completa o parcial: `t()` devuelve la clave tal cual
 * cuando no hay traduccion, de modo que un idioma a medio hacer degrada con
 * elegancia en vez de romperse.
 */
export enum AppLocale {
  /** Español. Idioma de origen, siempre completo. */
  Es = 'es',
  /** Ingles. */
  En = 'en',
  /** Frances. */
  Fr = 'fr',
  /** Portugues. */
  Pt = 'pt',
  /** Catalan. */
  Ca = 'ca',
}

export const APP_LOCALE_VALUES: readonly AppLocale[] = Object.freeze([
  AppLocale.Es,
  AppLocale.En,
  AppLocale.Fr,
  AppLocale.Pt,
  AppLocale.Ca,
]);

/** Idioma que se usa cuando no hay nada guardado o el guardado no existe. */
export const DEFAULT_LOCALE: AppLocale = AppLocale.Es;