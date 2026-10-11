import type { AppLocale } from '../enums/app-locale.enum';
import type { AppTheme } from '../enums/app-theme.enum';
import type { AppView } from '../enums/app-view.enum';
import type { KeyKind, KeyScope } from '../enums/key-scope.enum';

/**
 * Ajustes de la aplicacion, guardados en la tabla `app_settings`.
 *
 * Se guardan como pares clave/valor y no como columnas porque esta tabla va a
 * crecer: anadir un ajuste nuevo debe ser un `INSERT` mas, no un `ALTER TABLE`
 * que obliga a los demas a migrar.
 */
export interface IAppSettings {
  /** Tema de la interfaz. */
  theme: AppTheme;
  /** Idioma de la interfaz. */
  locale: AppLocale;
  /**
   * Clave de la API de Steam Web.
   *
   * Se guarda en la base de datos local, que vive en el directorio de
   * configuracion del usuario y no se sube a ningun sitio. Se vacia al pulsar
   * "Olvidar".
   */
  steamApiKey: string;
  /** Identificador publico de la cuenta de Steam (7656119...). */
  steamId: string;
  /** `true` si alguna vez se ha sincronizado la biblioteca de Steam. */
  steamLinked: boolean;
  /** Ultima sincronizacion correcta, en ISO. */
  steamSyncedAt: string | null;
  /** Que ambito estaba seleccionado la ultima vez. */
  lastScope: KeyScope;
  /** Que tipo estaba seleccionado la ultima vez. */
  lastKind: KeyKind;
  /** Que vista estaba abierta la ultima vez. */
  lastView: AppView;
}

/** Claves de la tabla `app_settings`. */
export type AppSettingKey =
  | 'theme'
  | 'locale'
  | 'steamApiKey'
  | 'steamId'
  | 'steamLinked'
  | 'steamSyncedAt'
  // Lo ultimo que se estaba viendo. Se guarda para que al reabrir la app se
  //Caiga donde se dejo y no haya que volver a pulsar los filtros cada vez.
  | 'lastScope'
  | 'lastKind'
  | 'lastView'
  /** Marca de que las copias antiguas ya se han traido a la base de datos. */
  | 'backupsMigratedToDatabase';

/** Un ajuste tal y como sale de la tabla, antes de interpretar el tipo. */
export interface ISettingRow {
  key: string;
  value: string;
}