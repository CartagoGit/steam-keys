import { DEFAULT_LOCALE, TRANSLATIONS, type AppLocale, type TranslationArgs, type TranslationKey } from '@/contracts';

/** Sustituye los marcadores `{0}`, `{1}`… por los argumentos dados. */
export function interpolate(
  template: string,
  args: TranslationArgs = [],
): string {
  return template.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

/**
 * Elige entre la forma singular y la plural de un recuento.
 *
 * Se escribe una clave por forma —`algo.one` y `algo.many`— en vez de meter el
 * numero en una sola cadena. Con una sola clave sale «1 keys»: el texto existe,
 * el idioma se cambia bien y las pruebas de traduccion pasan, porque ninguna de
 * las tres cosas mira la concordancia.
 *
 * El aleman declara las dos claves con la misma palabra, que es lo que hace el
 * idioma. Decide quien escribe el diccionario, no el helper: meter reglas de
 * plural dentro fallaria en frances.
 *
 * @param count    La cantidad. El singular se usa solo si es exactamente 1.
 * @param singular Clave del singular.
 * @param plural   Clave del plural.
 */
export function pluralKey(
  count: number,
  singular: TranslationKey,
  plural: TranslationKey,
): TranslationKey {
  return count === 1 ? singular : plural;
}

/**
 * Traduce una clave al idioma pedido.
 *
 * Si el idioma no tiene la clave se cae al español, y si el español tampoco la
 * tiene se devuelve la propia clave. Nunca devuelve cadena vacia: es preferible
 * un texto en español a un hueco en pantalla.
 */
export function translate(
  locale: AppLocale,
  key: TranslationKey,
  args: TranslationArgs = [],
): string {
  const propia = TRANSLATIONS[locale]?.[key];

  if (propia !== undefined) return interpolate(propia, args);

  const origen = TRANSLATIONS[DEFAULT_LOCALE]?.[key];

  if (origen !== undefined) return interpolate(origen, args);

  return interpolate(key, args);
}

/**
 * Idioma con el que se esta pintando la pantalla ahora mismo.
 *
 * Es una variable de modulo a proposito, y es lo unico aqui que no sea una
 * funcion pura. Sin ella los servicios no tienen forma de hablar el idioma del
 * usuario: el traductor vive en un contexto de React, asi que un `service` solo
 * puede usar `useT()` si se convierte en componente, y si no, escribe el texto
 * en castellano y se acaba viendo en ingles.
 *
 * Donde realmente hace falta son los titulos de las ventanas nativas del
 * sistema —el `open()` y el `save()` del plugin de dialogo—: esos textos los ve
 * el usuario siempre, en cualquier idioma, y nadie los puede formatear.
 *
 * Se fija en un unico sitio, la app, al arrancar y cada vez que cambia, de modo
 * que cualquier punto de entrada lo consulta.
 */
let idiomaActual: AppLocale = DEFAULT_LOCALE;

/** Fija el idioma global. Lo llama la app, y solo ella. */
export function setCurrentLocale(locale: AppLocale): void {
  idiomaActual = locale;
}

/** Traduce con el idioma global. Para codigo fuera de React. */
export function t(clave: TranslationKey, args?: TranslationArgs): string {
  return translate(idiomaActual, clave, args);
}

/** Idioma que el navegador pide, si esta entre los que soportamos. */
export function detectLocale(candidatos: readonly string[]): AppLocale {
  for (const candidato of candidatos) {
    const limpio = candidato.trim().toLowerCase().split('-')[0];

    if (limpio !== undefined && limpio in TRANSLATIONS) {
      return limpio as AppLocale;
    }
  }

  return DEFAULT_LOCALE;
}

/** Idioma del navegador, para cuando aun no hay nada guardado. */
export function browserLocale(): AppLocale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;

  const crudo: string[] = [...(navigator.languages ?? []), navigator.language ?? ''];

  return detectLocale(crudo);
}

/** Todas las claves que existen en español. Sirve para los tests de cobertura. */
export function baseKeys(): readonly string[] {
  return Object.keys(TRANSLATIONS[DEFAULT_LOCALE]);
}