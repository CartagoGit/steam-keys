import {
  AppTheme,
  DEFAULT_KEY_KIND,
  DEFAULT_KEY_SCOPE,
  DEFAULT_LOCALE,
  DEFAULT_VIEW,
  TABLE_APP_SETTINGS,
  type IAppSettings,
  type ISettingRow,
} from '@/contracts';
import { getDatabaseClient } from '@/repositories/repository.factory';
import {
  readBool,
  readKind,
  readLocale,
  readScope,
  readTheme,
  readView,
  serializeSetting,
} from '@/helpers/settings.helper';

/** Ajustes por defecto: los de una instalacion nueva, sin tocar nada. */
export const DEFAULT_SETTINGS: IAppSettings = Object.freeze({
  theme: AppTheme.System,
  locale: DEFAULT_LOCALE,
  steamApiKey: '',
  steamId: '',
  steamLinked: false,
  steamSyncedAt: null,
  lastScope: DEFAULT_KEY_SCOPE,
  lastKind: DEFAULT_KEY_KIND,
  lastView: DEFAULT_VIEW,
});

/**
 * Lectura y escritura de la tabla `app_settings`.
 *
 * Se guarda todo como texto porque SQLite no tiene booleano: `true` y `false`
 * se guardan como `'1'` y `'0'`, que es lo que devuelve `CAST(x AS INTEGER)`
 * en cualquier version. Un ajuste mal escrito se ignora y se cae al valor por
 * defecto, para que una fila corrupta no deje la app sin arrancar.
 */
export const settingsService = {
  /** Todos los ajustes, con los que falten rellenados por su valor por defecto. */
  async load(): Promise<IAppSettings> {
    const db = await getDatabaseClient();

    let filas: readonly ISettingRow[];

    try {
      filas = await db.select<ISettingRow>(
        `SELECT key, value FROM ${TABLE_APP_SETTINGS}`,
      );
    } catch {
      // Una base de datos de una version anterior puede no tener la tabla. No
      // es motivo para dejar la app en blanco: se usan los valores por defecto
      // y la tabla se creara en la proxima migracion.
      return { ...DEFAULT_SETTINGS };
    }

    const tabla = new Map(filas.map((fila) => [fila.key, fila.value]));

    return {
      theme: readTheme(tabla.get('theme')),
      locale: readLocale(tabla.get('locale')),
      steamApiKey: tabla.get('steamApiKey') ?? DEFAULT_SETTINGS.steamApiKey,
      steamId: tabla.get('steamId') ?? DEFAULT_SETTINGS.steamId,
      steamLinked: readBool(tabla.get('steamLinked')),
      steamSyncedAt: tabla.get('steamSyncedAt') || null,
      lastScope: readScope(tabla.get('lastScope')),
      lastKind: readKind(tabla.get('lastKind')),
      lastView: readView(tabla.get('lastView')),
    };
  },

  /** Guarda un ajuste. Los demas se quedan como estaban. */
  async set<K extends keyof IAppSettings>(key: K, value: IAppSettings[K]): Promise<void> {
    const db = await getDatabaseClient();

    await db.execute(
      `INSERT INTO ${TABLE_APP_SETTINGS} (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [key, serializeSetting(value)],
    );
  },

  /**
   * Guarda varios ajustes.
   *
   * Delega en `set` en vez de repetir la sentencia: eran el mismo `INSERT`
   * escrito dos veces, y si un dia cambia solo se acordaba uno. Ademas
   * `setMany` abria una conexion para nada cuando el parche venia vacio.
   */
  async setMany(patch: Partial<IAppSettings>): Promise<void> {
    for (const [key, value] of Object.entries(patch)) {
      await this.set(key as keyof IAppSettings, value as never);
    }
  },

  /** Borra la clave de la API de la base de datos. */
  async forgetApiKey(): Promise<void> {
    await this.set('steamApiKey', '');
  },
};