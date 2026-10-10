/** Origen de una entrada. Solo informativo: ayuda a saber como se 해석o cada linea. */
export enum KeySource {
  /** Importada desde el TXT plano original. */
  LegacyTxt = 'legacy_txt',
  /** Creada a mano en la app. */
  Manual = 'manual',
}