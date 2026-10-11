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
  [AppLocale.Es]: { label: 'Espanol', flag: '/flags/es.svg' },
  [AppLocale.En]: { label: 'English', flag: '/flags/en.svg' },
  [AppLocale.Fr]: { label: 'Francais', flag: '/flags/fr.svg' },
  [AppLocale.Pt]: { label: 'Portugues', flag: '/flags/pt.svg' },
  [AppLocale.De]: { label: 'Deutsch', flag: '/flags/de.svg' },
});

/**
 * Ancho de cada bandera. La altura sale de la proporcion real (3:2).
 *
 * 22 px y no mas porque a tamano pequeno una bandera solo se distingue por el
 * color dominante, y a partir de 30 px empiezan a dominar el campo y ya parece
 * una coleccion de sellos en vez de un selector de idioma.
 */
export const LOCALE_FLAG_SIZE = 22;

/**
 * Etiquetas de los temas, en el idioma de cada traduccion.
 *
 * Se dejan en ingles a proposito: son las que aparecen asi en Windows, en
 * macOS y en Linux, y traducirlas desorienta mas que ayudar. El tema se elige
 * casi siempre por como se ve, no por como se lee su nombre.
 */
export const THEME_LABELS: Readonly<Record<string, string>> = Object.freeze({
  system: 'System',
  dark: 'Dark',
  midnight: 'Midnight',
  forest: 'Forest',
  nord: 'Nord',
  contrast: 'Contrast',
  light: 'Light',
  paper: 'Paper',
  berry: 'Berry',
});