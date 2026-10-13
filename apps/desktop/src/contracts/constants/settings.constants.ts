import { AppTheme } from '../enums/app-theme.enum';
import { DEFAULT_LOCALE } from '../enums/app-locale.enum';
import { DEFAULT_VIEW } from '../enums/app-view.enum';
import { DEFAULT_KEY_KIND, DEFAULT_KEY_SCOPE } from '../enums/key-scope.enum';
import type { IAppSettings } from '../interfaces/app-settings.interface';

/**
 * Ajustes por defecto: los de una instalacion nueva, sin tocar nada.
 *
 * ## El tema por defecto es Nord, y no «el del sistema»
 *
 * Con `System` lo que aparecia dependia de la configuracion del escritorio de
 * cada maquina: la misma app se abria clara en una y oscura en otra, y eso
 * hace imposible decir «la ventana esta rara» sin mirar antes cual era el
 * tema. Nord es el que mejor aguanta las dos cosas que se hacen aqui —una
 * lista larga de texto pequeño y un panel de color— y ademas sus variables
 * estan todas definidas, sin aproximaciones.
 *
 * En cuanto se elige otro, se guarda y a partir de ahi manda lo guardado, que
 * es justo lo que se espera: lo unico que se decide una vez es la primera.
 *
 * ## Por que vive aqui y no en el servicio
 *
 * Lo leen tres capas distintas —el repositorio de SQLite al rellenar lo que
 * falte, el cliente HTTP al traducirlo y la pantalla al montar— y el servicio
 * esta por debajo de las dos primeras. Un `DEFAULT_SETTINGS` en
 * `services/settings.service.ts` obligaba al repositorio a importar de
 * `services/`, que es justo la direccion que las capas prohiben.
 *
 * Los imports van **por fichero**, no por `../index`. Volver al barril desde un
 * fichero que el barril reexporta es un ciclo: este se evalua antes de que
 * `app-theme.enum` tenga sus valores, y `DEFAULT_SETTINGS.theme` sale `undefined`
 * sin que nada falle al compilar. Cuesta un test entero para verlo —la app
 * arranca en blanco y el error apunta a `AppTheme.Nord`, tres ficheros mas
 * alla— asi que los imports directos son la norma, no la excepcion.
 */
export const DEFAULT_SETTINGS: IAppSettings = Object.freeze({
  theme: AppTheme.Nord,
  locale: DEFAULT_LOCALE,
  steamApiKey: '',
  steamId: '',
  steamLinked: false,
  steamSyncedAt: null,
  lastScope: DEFAULT_KEY_SCOPE,
  lastKind: DEFAULT_KEY_KIND,
  lastView: DEFAULT_VIEW,
});