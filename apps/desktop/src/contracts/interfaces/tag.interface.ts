import type { TagColor } from '../constants/tag.constants';

/**
 * Una etiqueta del catalogo, con cuantos juegos la usan.
 *
 * El **catalogo** es la lista de etiquetas que existen en la app y que se
 * pueden volver a usar. Antes no habia ninguna: el dialogo de etiquetas las
 * reunia aplanando las cuatrocientas filas de la tabla en memoria cada vez que
 * se abria, y una etiqueta nueva solo existia en la fila en la que se
 * escribia. No habia forma de quitar una etiqueta que hubiera dejado de
 * servir, ni de saber cuantas claves la usaban.
 */
export interface ITag {
  /** La etiqueta, ya normalizada para poder compararla. */
  nombre: string;
  /**
   * El tono con el que se pinta, o `''` si no tiene ninguno.
   *
   * Viaja **en la etiqueta** y no como un ajuste aparte porque es parte de lo
   * que la etiqueta es: «dlc» en rojo tiene que ser el mismo «dlc» en la fila,
   * en el filtro y en el selector de etiquetas. Separado, el filtro y el
   * catalogo podrian acabar mostrando colores distintos para la misma palabra.
   *
   * Se guarda el **nombre** del tono y no su color —`info`, no `#38bdf8`— para
   * que siga siendo legible en los nueve temas; quien lo pone es
   * `styles/index.css`.
   */
  color: TagColor | '';
  /**
   * Cuantas claves la llevan ahora mismo.
   *
   * Va en la lista para poder decir «la usan 40 claves» antes de borrarla: es
   * la diferencia entre quitarse una etiqueta que se ha quedado sin usar y
   * vaciar medio catalogo por un clic de mas.
   */
  usos: number;
}

/** Fila cruda de la tabla de etiquetas, tal cual la devuelve SQLite. */
export interface ITagRow {
  nombre: string;
  /** Lo que hay en la columna, sin comprobar: puede no ser un tono. */
  color: string;
}