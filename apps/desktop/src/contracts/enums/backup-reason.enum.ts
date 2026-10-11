/** Por que se creo una copia de seguridad. Se usa para nombrar el fichero. */
export enum BackupReason {
  Manual = 'manual',
  AntesDeImportar = 'antes-de-importar',
  AntesDeRestaurar = 'antes-de-restaurar',
  AlMigrar = 'al-migrar',
  /**
   * Traida de la carpeta `backups/` de las versiones anteriores.
   *
   * Estas no las crea la app: las copia el usuario de otra instalacion y aqui
   * solo se mete su contenido en la tabla. El motivo esta en el enum y no
   * escrito a mano donde se guarda, porque sale en la lista de copias y para
   * poder mostrarla traducida tiene que ser un valor conocido.
   */
  TraidaDeArchivos = 'traida-de-archivos',
}

export const BACKUP_REASON_VALUES: readonly BackupReason[] = Object.freeze([
  BackupReason.Manual,
  BackupReason.AntesDeImportar,
  BackupReason.AntesDeRestaurar,
  BackupReason.AlMigrar,
  BackupReason.TraidaDeArchivos,
]);