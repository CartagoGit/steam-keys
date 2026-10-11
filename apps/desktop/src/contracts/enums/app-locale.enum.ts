/**
 * Idiomas de la interfaz.
 *
 * El espanol es el idioma de origen y nunca se puede quitar. Los demas se
 * anaden **completos**: la regla esta en `APP_LOCALE_VALUES`, mas abajo.
 */
export enum AppLocale {
  /** Espanol. Idioma de origen, siempre completo. */
  Es = 'es',
  /** Ingles. */
  En = 'en',
  /** Frances. */
  Fr = 'fr',
  /** Portugues. */
  Pt = 'pt',
  /** Aleman. */
  De = 'de',
}

/**
 * Idiomas que se ofrecen, en el orden en que aparecen.
 *
 * Solo entra aqui un idioma **completo**. Al principio el selector traia
 * frances, portugues y catalan, pero sus diccionarios estaban vacios: al elegir
 * uno no pasaba nada visible, porque `t()` caia al espanol en cada clave. Desde
 * fuera era un selector que no hacia nada, y la sensacion era de app rota.
 *
 * Un idioma a medio traducir no es un idioma: es un fallo. O se completa y
 * entra en la lista, o se queda fuera hasta que este listo. El test de
 * cobertura de traducciones obliga a que cada clave de aqui exista en todos
 * los diccionarios de `TRANSLATIONS`.
 *
 * El orden no es alfabetico: primero el idioma de origen y el ingles, que son
 * los que de verdad se usan, y despues los demas.
 */
export const APP_LOCALE_VALUES: readonly AppLocale[] = Object.freeze([
  AppLocale.Es,
  AppLocale.En,
  AppLocale.Fr,
  AppLocale.Pt,
  AppLocale.De,
]);

/**
 * Idioma que se usa cuando no hay nada guardado o el guardado no existe.
 *
 * El ingles y no el espanol. El idioma guardado esta en la tabla
 * `app_settings`, que vive **dentro** de la base de datos: si la base de datos
 * no esta, no hay idioma guardado que leer, y el primer arranque tendria que
 * invented uno. English es el que hace que ese primer arranque se entienda
 * fuera de Espana y de Portugal, que es donde esta el autor.
 */
export const DEFAULT_LOCALE: AppLocale = AppLocale.En;
