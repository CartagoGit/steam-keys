import { pedir } from '@/repositories/http-bridge.client';
import type {
  BackupReason,
  IBackup,
  IBackupRepository,
  IRestoreSummary,
  RestoreMode,
  StorageHealth,
} from '@/contracts';

/**
 * Copias de seguridad por el puente de desarrollo.
 *
 * El hermano minimo de `SqliteBackupRepository`. Lo que hay aqui son siete
 * lineas por metodo porque lo unico que se hace es nombrar la operacion: la
 * tabla `backups`, la rotacion de las diez ultimas y la fusion fila a fila
 * estan en el servidor, ejecutando el mismo SQL que la app de escritorio.
 *
 * ## Lo que mejora de verdad
 *
 * `restore` es la operacion que mas gana. Antes la fusion viajaba como tres
 * peticiones —leer las filas de la copia, abrir la transaccion, escribir— y
 * dependia de que el puente aguantara la conexion entre ellas. Ahora es una
 * sola, y la fusion ocurre entera dentro del servidor: si algo falla a mitad,
 * no queda la coleccion a medias.
 */
export class HttpBackupRepository implements IBackupRepository {
  create(reason: BackupReason): Promise<IBackup> {
    return pedir('backups/create', { reason });
  }

  list(): Promise<readonly IBackup[]> {
    return pedir('backups/list');
  }

  async remove(name: string): Promise<void> {
    await pedir('backups/remove', { name });
  }

  restore(name: string, mode: RestoreMode): Promise<IRestoreSummary> {
    return pedir('backups/restore', { name, mode });
  }

  previewRestore(name: string, mode: RestoreMode): Promise<IRestoreSummary> {
    return pedir('backups/preview-restore', { name, mode });
  }

  checkHealth(): Promise<{ health: StorageHealth; detail: string | null }> {
    return pedir('backups/check-health');
  }

  countUnknownPlatform(): Promise<number> {
    return pedir('backups/count-unknown-platform');
  }

  /**
   * No hay operacion que la Atienda, y es a proposito.
   *
   * Solo la usa la migracion de las copias antiguas, que corre unicamente dentro
   * de Tauri porque necesita una carpeta de donde traer los ficheros. En el
   * navegador esa funcion ni siquiera llega aqui: no hay nombres, y sin nombres
   * no hay nada que importar.
   *
   * Lanza en vez de fingir: si alguien la llamara desde el navegador, lo que
   * pasaria es que la copia se perderia en silencio, y una copia que no se
   * guarda no se nota hasta que hace falta.
   */
  importExternal(): Promise<void> {
    throw new Error(
      'La migracion de las copias antiguas solo corre dentro de Tauri: no hay ' +
        'carpeta de donde traerlas en el navegador.',
    );
  }
}