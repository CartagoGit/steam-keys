import type { IBackup, IRestoreSummary } from './backup.interface';
import type { IGameKeyRow } from './import-summary.interface';
import type { StorageHealth } from '../enums/storage-health.enum';
import type { BackupReason } from '../enums/backup-reason.enum';
import type { RestoreMode } from '../enums/restore-mode.enum';

/**
 * Las copias de seguridad de la base de datos.
 *
 * ## Que son
 *
 * Filas de la tabla `backups` de la propia base de datos, no ficheros ni
 * comandos de Rust. Antes eran ficheros y solo se podian hacer desde Tauri; el
 * repositorio las guardo en la tabla y con eso pasaron a funcionar en
 * cualquier sitio con un motor de verdad detras —incluido el puente de
 * desarrollo, que es donde se prueba la interfaz—.
 *
 * ## Por que un contrato y no el servicio tal cual
 *
 * `backup.service.ts` resolvia su cliente de base de datos por su cuenta y
 * recibia un `IDatabaseClient` en cada metodo. Eso imposibilitaba dos cosas:
 *
 * - **Probarlo** sin montar una base entera.
 * - **Saber que parte del trafico de la app va al servidor.** No habia forma de
 *   enumerarlo sin leer el servicio entero y contar cada `execute`.
 *
 * Con el contrato, las operaciones del puente citan estas operaciones por
 * nombre, y el servidor las resuelve contra su propio motor.
 */
export interface IBackupRepository {
  /**
   * Copia el estado actual.
   *
   * Rota sola: se quedan las diez mas recientes. Por eso casi todas las
   * llamadas son `AntesDeImportar` o `AntesDeRestaurar` y no `Manual` —cada
   * operacion que cambia mucho se guarda antes, no porque el usuario lo pida.
   */
  create(reason: BackupReason): Promise<IBackup>;

  /** Las copias que hay, de la mas reciente a la mas antigua. */
  list(): Promise<readonly IBackup[]>;

  remove(name: string): Promise<void>;

  /**
   * Fusiona una copia en la base viva.
   *
   * Nunca copia el fichero encima: la app tiene la conexion abierta y SQLite
   * se queda con una referencia obsoleta. Se deposita como
   * `restore-candidate.db`, se abre con una segunda conexion y se fusiona fila
   * a fila. Fusionar **solo anade**: sobrescribir tambien devuelve estados.
   */
  restore(name: string, mode: RestoreMode): Promise<IRestoreSummary>;

  /**
   * Cuenta lo que haria `restore` sin escribir nada.
   *
   * Va antes del dialogo de confirmacion para poder decir «entran 12 y se
   * actualizan 3» con los numeros en la mano. No deja rastro: es una pregunta,
   * no una accion, y no deberia crear una copia cada vez que se abre el
   * dialogo.
   */
  previewRestore(name: string, mode: RestoreMode): Promise<IRestoreSummary>;

  /** Como esta la base: vacia a medias, con claves sin plataforma, etc. */
  checkHealth(): Promise<{ health: StorageHealth; detail: string | null }>;

  /** Cuantas claves no dicen de que plataforma son. */
  countUnknownPlatform(): Promise<number>;

  /**
   * Mete una copia que venia de un fichero, no de la base de datos.
   *
   * Es lo que usa la migracion de las copias antiguas, y usa `INSERT OR
   * IGNORE` por nombre para que se pueda relanzar sin miedo: si ya estaba, no
   * se pisa.
   *
   * **No existe como operacion del puente.** La migracion solo corre dentro de
   * Tauri —el navegador no tiene carpeta de donde traerlas—, asi que abrirla por
   * HTTP seria una puerta que no lleva a ningun sitio.
   */
  importExternal(
    nombre: string,
    reason: BackupReason,
    filas: readonly IGameKeyRow[],
  ): Promise<void>;
}