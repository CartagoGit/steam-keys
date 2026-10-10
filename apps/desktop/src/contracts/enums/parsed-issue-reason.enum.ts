/** Por que una linea del TXT no ha podido convertirse en una entrada. */
export enum ParsedIssueReason {
  /** La linea no contenia ninguna clave. */
  SinClave = 'sin_clave',
  /** La clave tiene un formato raro o lleva sufijos pegados. */
  ClaveSospechosa = 'clave_sospechosa',
  /** Se-ha leido la clave pero no el nombre del juego. */
  SinNombre = 'sin_nombre',
  /** Linea puramente decorativa o separador. */
  LineaDecorativa = 'linea_decorativa',
  /** Instrucciones de canjeo, sin clave. */
  Instrucciones = 'instrucciones',
  /** La clave ya aparecia antes en el archivo o en la base de datos. */
  ClaveRepetidaEnLinea = 'clave_repetida_en_linea',
}