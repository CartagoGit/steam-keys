import { DEFAULT_LOCALE } from '@/contracts/enums/app-locale.enum';
import { AppTheme } from '@/contracts/enums/app-theme.enum';
import { getDatabaseClient } from '@/repositories/repository.factory';
import type {
  IAppSettings,
  ISettingRow,
} from '@/contracts/interfaces/app-settings.interface';
import type { AppLocale } from '@/contracts/enums/app-locale.enum';

/** Ajustes por defecto: los de una instalacion nueva, sin tocar nada. */
export const DEFAULT_SETTINGS: IAppSettings = Object.freeze({
  theme: AppTheme.System,
  locale: DEFAULT_LOCALE,
  steamApiKey: '',
  steamId: '',
  steamLinked: false,
  steamSyncedAt: null,
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
    };
  },

  /** Guarda un ajuste. Los demas se quedan como estaban. */
  async set<K extends keyof IAppSettings>(key: K, value: IAppSettings[K]): Promise<void> {
    const db = await getDatabaseClient();

    await db.execute(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [key, serialize(value)],
    );
  },

  /** Guarda varios ajustes en una sola transaccion logica. */
  async setMany(patch: Partial<IAppSettings>): Promise<void> {
    const db = await getDatabaseClient();

    for (const [key, value] of Object.entries(patch)) {
      await db.execute(
        `INSERT INTO app_settings (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [key, serialize(value)],
      );
    }
  },

  /** Borra la clave de la API de la base de datos. */
  async forgetApiKey(): Promise<void> {
    await this.set('steamApiKey', '');
  },
};

function serialize(value: IAppSettings[keyof IAppSettings]): string {
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value === null || value === undefined) return '';
  return String(value);
}

function readBool(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function readTheme(value: string | undefined): AppTheme {
  return value === AppTheme.Dark || value === AppTheme.Light ? value : AppTheme.System;
}

function readLocale(value: string | undefined): AppLocale {
  return (value ?? DEFAULT_LOCALE) as AppLocale;
}