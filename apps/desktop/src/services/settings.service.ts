import { AppTheme, DEFAULT_LOCALE, type IAppSettings, type ISettingRow } from '@/contracts';
import { getDatabaseClient } from '@/repositories/repository.factory';
import {
  readBool,
  readLocale,
  readTheme,
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
  lastScope: 'available',
  lastKind: 'all',
  lastView: 'keys',
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
      filas = await db.select<ISettingRow>('SELECT key, value FROM app_settings');
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
      lastScope: tabla.get('lastScope') || DEFAULT_SETTINGS.lastScope,
      lastKind: tabla.get('lastKind') || DEFAULT_SETTINGS.lastKind,
      lastView: tabla.get('lastView') || DEFAULT_SETTINGS.lastView,
    };
  },

  /** Guarda un ajuste. Los demas se quedan como estaban. */
  async set<K extends keyof IAppSettings>(key: K, value: IAppSettings[K]): Promise<void> {
    const db = await getDatabaseClient();

    await db.execute(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [key, serializeSetting(value)],
    );
  },

  /** Guarda varios ajustes en una sola transaccion logica. */
  async setMany(patch: Partial<IAppSettings>): Promise<void> {
    const db = await getDatabaseClient();

    for (const [key, value] of Object.entries(patch)) {
      await db.execute(
        `INSERT INTO app_settings (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [key, serializeSetting(value)],
      );
    }
  },

  /** Borra la clave de la API de la base de datos. */
  async forgetApiKey(): Promise<void> {
    await this.set('steamApiKey', '');
  },
};