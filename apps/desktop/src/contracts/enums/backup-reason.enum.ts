/** Por que se creo una copia de seguridad. Se usa para nombrar el fichero. */
import type { TranslationKey } from '../constants/i18n.constants';

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

/**
 * Clave de traduccion de cada motivo.
 *
 * Va pegada al enum y no en el componente porque el motivo se pinta en dos sitios
 * —la lista de copias y el dialogo de restaurar— y con el mapa al lado del enum
 * los dos leen de la misma tabla. `Record<BackupReason, ...>` hace que anadir un
 * motivo sin su clave no compile, en vez de dejar un texto en castellano.
 * Cuando `TranslationKey` deje de ser `string` esto pasa a comprobar ademas
 * que la clave existe en los cinco diccionarios.
 */
export const BACKUP_REASON_LABEL: Record<BackupReason, TranslationKey> = {
  [BackupReason.Manual]: 'storage.reason.manual',
  [BackupReason.AntesDeImportar]: 'storage.reason.beforeImport',
  [BackupReason.AntesDeRestaurar]: 'storage.reason.beforeRestore',
  [BackupReason.AlMigrar]: 'storage.reason.onMigrate',
  [BackupReason.TraidaDeArchivos]: 'storage.reason.fromFiles',
};