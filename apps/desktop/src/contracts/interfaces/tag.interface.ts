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
}