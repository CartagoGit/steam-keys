import { fileService } from '@/services/file.service';
import { DEFAULT_LOCALE } from '@/contracts';
import { getStorageMode, isTauri, StorageMode } from '@/helpers/runtime.helper';
import type { IStartup } from '@/contracts';

// Los dos tipos viven en `contracts/` —los consume el hook del arranque— y se
// reexportan aqui para que quien ya importaba de este servicio no cambie.
export type { DatabaseState, IStartup } from '@/contracts';

/**
 * Averigua el estado de arranque sin tocar nada.
 *
 * Solo **pregunta**; no crea ficheros ni directorios. Crear la base de datos es
 * una decision de quien la va a usar, y por defecto es que no: un fichero
 * `steam-keys.db` de cero bytes al descargar el programa no le dice nada a
* a nadie, y ocupa el sitio de la copia buena sin decir nada.
 *
 * En el navegador no hay fichero que mirar, asi que se considera `ready`: el
 * puente de desarrollo y la vista previa en memoria ya se encargan de crear lo
 * que necesiten cuando de verdad se escribe algo.
 */
export async function inspectStartup(): Promise<IStartup> {
  if (!isTauri() || getStorageMode() !== StorageMode.Tauri) {
    return {
      database: 'ready',
      databasePath: null,
      locale: DEFAULT_LOCALE,
      localeFromBrowser: false,
    };
  }

  // Si esta pregunta falla, se asume que hay base de datos. Es el lado
  // conservador: crear un aviso de "no hay datos" cuando los hay seria perder
  // la coleccion sin avisar, que es justo lo que hay que evitar a toda costa.
  const info = await fileService.databaseInfo().catch(() => null);

  if (info === null || info.exists) {
    return {
      database: 'ready',
      databasePath: info?.path ?? null,
      locale: DEFAULT_LOCALE,
      localeFromBrowser: false,
    };
  }

  return {
    database: 'empty',
    databasePath: info.path,
    locale: DEFAULT_LOCALE,
    localeFromBrowser: false,
  };
}