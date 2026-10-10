/** Como se aplica una copia de seguridad al restaurar. */
export enum RestoreMode {
  /** Añade solo las claves que no existan. Nunca borra ni cambia nada. */
  Fusionar = 'fusionar',
  /** Ademas de fusionar, actualiza el estado de las claves ya presentes. */
  Sobrescribir = 'sobrescribir',
}