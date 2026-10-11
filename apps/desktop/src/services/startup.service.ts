import { fileService } from '@/services/file.service';
import { browserLocale } from '@/helpers/i18n.helper';
import { getStorageMode, isTauri, StorageMode } from '@/helpers/runtime.helper';
import type { AppLocale } from '@/contracts/enums/app-locale.enum';

/**
 * Que pasa con los datos al arrancar.
 *
 * - `empty`: no hay base de datos todavia. La app no ha creado ninguna y no
 *   va a hacerlo sola.
 * - `ready`: hay base de datos y se puede leer con normalidad.
 *
 * La diferencia con `exists` a secas es que **no se consulta la base de datos
 * para averiguarlo**: se mira el fichero. Abrirla crearia una vacia, que es
 * justo lo que este modulo existe para evitar.
 */
export type DatabaseState = 'empty' | 'ready';

/**
 * Lo que hay que saber antes de pintar nada.
 *
 * El idioma va aqui porque el que eligio el usuario esta **dentro** de la base
 * de datos, en la tabla `app_settings`: si no hay base de datos no hay idioma
 * guardado, y la primera pantalla —que es justamente la del aviso— tendria que
 * mostrarse en un idioma que nadie ha elegido. Sin idioma guardado solo hay un
 * dato disponible, el del navegador.
 */
export interface IStartup {
  /** Que hay o no hay base de datos. */
  database: DatabaseState;
  /** Ruta donde estara o esta la base de datos, para poder nombrarla. */
  databasePath: string | null;
  /** Idioma con el que arrancar. */
  locale: AppLocale;
  /**
   * Si el idioma viene del navegador y no de un ajuste guardado.
   *
   * El aviso de "no hay base de datos" se escribe en el idioma del navegador,
   * que es lo unico que hay. Es una pista de por que no sale en español.
   */
  localeFromBrowser: boolean;
}

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
      locale: browserLocale(),
      localeFromBrowser: true,
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
      locale: browserLocale(),
      localeFromBrowser: true,
    };
  }

  return {
    database: 'empty',
    databasePath: info.path,
    locale: browserLocale(),
    localeFromBrowser: true,
  };
}