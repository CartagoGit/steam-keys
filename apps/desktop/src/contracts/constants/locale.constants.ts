import { AppLocale } from '../enums/app-locale.enum';

/**
 * Idiomas con etiqueta propia.
 *
 * Cada uno se escribe en su idioma y no en el nuestro a proposito: quien lo
 * busca ya sabe leerlo, y un catalogo traducido al ingles es menos util que el
 * nombre del idioma tal cual lo llaman sus hablantes. Los nombres propios si
 * llevan su grafia correcta con tildes, que es como se escriben siempre.
 */
export const LOCALE_META: Readonly<
  Record<AppLocale, { label: string; flag: string }>
> = Object.freeze({
  [AppLocale.Es]: { label: 'Español', flag: 'ES' },
  [AppLocale.En]: { label: 'English', flag: 'EN' },
  [AppLocale.Fr]: { label: 'Français', flag: 'FR' },
  [AppLocale.Pt]: { label: 'Português', flag: 'PT' },
  [AppLocale.Ca]: { label: 'Català', flag: 'CA' },
});

/**
 * Etiquetas de los temas.
 *
 * Se dejan intencionadamente en ingles (`System`, `Dark`, `Light`) porque son
 * las que aparecen asi en Windows, en macOS y en Linux, y traducirlas
 * desorienta mas que ayudar.
 */
export const THEME_LABELS: Readonly<Record<string, string>> = Object.freeze({
  system: 'System',
  dark: 'Dark',
  light: 'Light',
});