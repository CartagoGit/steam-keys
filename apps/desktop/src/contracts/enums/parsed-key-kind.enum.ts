/** Como se ha detectado la clave dentro de una linea del TXT. */
export enum ParsedKeyKind {
  /** Formato Steam clasico: XXXXX-XXXXX-XXXXX. */
  Steam = 'steam',
  /** URL de Humble Bundle con `?key=` o `/gift?key=`. */
  HumbleUrl = 'humble_url',
  /** Clave alfanumerica de otra tienda (Battle.net, GW2, ESO, ...). */
  Alphanumeric = 'alphanumeric',
}