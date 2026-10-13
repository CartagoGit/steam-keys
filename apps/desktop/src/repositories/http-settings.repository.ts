import { pedir } from '@/repositories/http-bridge.client';
import type { IAppSettings, ISettingsRepository } from '@/contracts';

/**
 * Ajustes por el puente de desarrollo.
 *
 * El hermano minimo de `SqliteSettingsRepository`, igual que lo es
 * `HttpGameKeyRepository` del de claves. Lo que hay aqui son tres lineas por
 * metodo porque lo unico que se hace es nombrar la operacion: la tabla
 * `app_settings`, el `ON CONFLICT` y el relleno con los valores por defecto
 * estan en el servidor, en el mismo sitio que los ejecuta la app de escritorio.
 */
export class HttpSettingsRepository implements ISettingsRepository {
  async load(): Promise<IAppSettings> {
    return pedir('settings/load');
  }

  async set<K extends keyof IAppSettings>(
    key: K,
    value: IAppSettings[K],
  ): Promise<void> {
    await pedir('settings/set', { key, value });
  }

  async setMany(patch: Partial<IAppSettings>): Promise<void> {
    await pedir('settings/set-many', { patch });
  }

  async readRaw(clave: string): Promise<string | null> {
    return pedir('settings/read-raw', { clave });
  }

  async writeRaw(clave: string, valor: string): Promise<void> {
    await pedir('settings/write-raw', { clave, valor });
  }
}