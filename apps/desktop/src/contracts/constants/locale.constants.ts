import { AppLocale } from '../enums/app-locale.enum';
import { AppTheme } from '../enums/app-theme.enum';

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
 * Codigo BCP 47 de cada idioma, para `Intl`.
 *
 * Vive aqui y no en un componente porque lo necesitan todos los que formatean
 * una fecha: el panel de datos, la tabla de juegos de Steam y el helper de
 * fechas. Cuando estaba dentro de `storage-panel`, los demas componentes no
 * tenian donde mirar y acababan escribiendo `'es'` a mano.
 *
 * El ingles es `en-GB` y no `en-US` a proposito: con `en-US` el 2 de marzo sale
 * `3/2/2026`, y en una coleccion europea ese orden se lee al reves. Los demas
 * idiomas usan su codigo real de region.
 */
export const LOCALE_BCP47: Readonly<Record<AppLocale, string>> = Object.freeze({
  [AppLocale.Es]: 'es-ES',
  [AppLocale.En]: 'en-GB',
  [AppLocale.Fr]: 'fr-FR',
  [AppLocale.Pt]: 'pt-PT',
  [AppLocale.De]: 'de-DE',
});

/**
 * Etiquetas de los temas, en el idioma de cada traduccion.
 *
 * Se dejan en ingles a proposito: son las que aparecen asi en Windows, en
 * macOS y en Linux, y traducirlas desorienta mas que ayudar. El tema se elige
 * casi siempre por como se ve, no por como se lee su nombre.
 *
 * El tipo es `Record<AppTheme, string>` y no `Record<string, string>` para que
 * borrar o renombrar un tema en el enum rompa aqui, en vez de dejar una
 * etiqueta huerfana que el selector ya no enseña.
 */
export const THEME_LABELS: Readonly<Record<AppTheme, string>> = Object.freeze({
  [AppTheme.System]: 'System',
  [AppTheme.Dark]: 'Dark',
  [AppTheme.Midnight]: 'Midnight',
  [AppTheme.Forest]: 'Forest',
  [AppTheme.Nord]: 'Nord',
  [AppTheme.Contrast]: 'Contrast',
  [AppTheme.Light]: 'Light',
  [AppTheme.Paper]: 'Paper',
  [AppTheme.Berry]: 'Berry',
});