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
  /**
   * La etiqueta **tal como se ve**, con la caja con la que esta escrita.
   *
   * No es la clave del catalogo —esa va normalizada en `clave`—, sino el texto
   * que hay escrito en las claves de la coleccion. Las dos cosas se separan
   * porque el catalogo necesita una clave unica y sin mayusculas y la lista
   * necesita enseñar lo que puso el usuario; usar la clave para todo hacia que
   * «Cumplidos» saliera «cumplidos» en el filtro y en la ficha, y entonces no
   * se reconocía la etiqueta de la fila.
   */
  nombre: string;
  /**
   * La etiqueta normalizada, que es como se busca en todas partes.
   *
   * Es la clave primaria de la tabla `tags` y lo que comparan el filtro, el
   * borrado, el renombrado y el color. Todo lo que vaya a tocar la base de
   * datos pasa por aqui, sin excepciones: es lo unico que evita que «
   * Cumplidos» y «cumplidos» se acaben tratando como dos etiquetas.
   */
  clave: string;
  /**
   * El color con el que se pinta, o `''` si no tiene ninguno.
   *
   * Viaja **en la etiqueta** y no como un ajuste aparte porque es parte de lo
   * que la etiqueta es: «dlc» en rojo tiene que ser el mismo «dlc» en la fila,
   * en el filtro y en el selector de etiquetas. Separado, el filtro y el
   * catalogo podrian acabar mostrando colores distintos para la misma palabra.
   *
   * Es un `hex` y no el nombre de un color de la app. Se cambio porque los
   * nombres unifican el color con el tema —y con eso se leia bien en los cinco
   * oscuros y mal en los cuatro claros— pero no dejan elegir: eran cinco, y en
   * una coleccion con veinte etiquetas «dlc» y «dlc extra» no se distinguian.
   * Con un `hex` hay dieciocho y el texto que va encima lo decide `textoSobre`,
   * que lo mide. Es la unica parte de la app que se pinta con un color que no
   * viene de `styles/index.css`, y por eso es la unica que lleva la cuenta.
   *
   * La cadena vacia **no** quiere decir «que le pongan un color». Quiere decir
   * que la etiqueta no tiene color y sale como texto, que es como se ha
   * visto siempre.
   */
  color: string;
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
  /** La clave normalizada: sin mayusculas ni acentos. Busca con esta. */
  nombre: string;
  /**
   * Como se ve la etiqueta, o `''` si se ve como `nombre`.
   *
   * Solo se llena cuando el titulo y la clave **no** coinciden, que es cuando
   * alguien ha escrito «DLC» para una etiqueta cuya clave es «dlc». En el caso
   * normal —la etiqueta que nunca se ha renombrado— va vacio y se enseña
   * `nombre`: dos copias del mismo texto que alguien tendria que mantener
   * sincronizadas no aportan nada.
   */
  titulo: string;
  /** Lo que hay en la columna, sin comprobar: puede no ser un tono. */
  color: string;
}