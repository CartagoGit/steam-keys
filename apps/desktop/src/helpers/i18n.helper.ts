import { TRANSLATIONS } from '@/contracts/constants/i18n.constants';
import { DEFAULT_LOCALE } from '@/contracts/enums/app-locale.enum';
import type {
  TranslationArgs,
  TranslationKey,
} from '@/contracts/constants/i18n.constants';
import type { AppLocale } from '@/contracts/enums/app-locale.enum';

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