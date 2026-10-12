import type { IconName } from './icon-name.interface';

/**
 * Una opcion que se puede elegir y que ademas se **ve**: icono y color.
 *
 * Es el tipo que comparten las dos piezas de la interfaz que representan un
 * estado o una plataforma: la pastilla de cada fila y el desplegable del
 * editor. Las dos leen estos mismos datos de `KEY_STATUS_META` y
 * `KEY_PLATFORM_META`, de modo que un color o un icono se cambia en un unico
 * sitio y cambia en las dos a la vez.
 *
 * Vive en `contracts` y no en el componente porque el componente es React y
 * aqui no hay nada de React: son datos de dominio que la UI pinta.
 */
export interface IMetaOption {
  /** Valor que se guarda. */
  value: string;
  /** Texto ya traducido, listo para pintar. */
  label: string;
  /** Icono del distintivo. */
  icon?: IconName;
  /**
   * Clases del distintivo de color, tal cual vienen del dominio.
   *
   * Van como clases completas y no como un nombre de color a proposito: los
   * tonos del tema son semanticos (`bg-ok`, `text-warn`) y cada tema declara
   * los suyos. Si aqui se tradujera un `'ok'`, el desplegable tendria su
   * propia tabla de colores, distinta de la de la pastilla, y volveria a
   * haber dos fuentes de verdad —justo lo que esto evita.
   */
  tone?: string;
  /** Texto corto, para chips donde el nombre completo no cabe. */
  short?: string;
}