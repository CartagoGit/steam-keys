/** Por que se creo una copia de seguridad. Se usa para nombrar el fichero. */
export enum BackupReason {
  Manual = 'manual',
  AntesDeImportar = 'antes-de-importar',
  AntesDeRestaurar = 'antes-de-restaurar',
  AlMigrar = 'al-migrar',
}