import type { IAppSettings } from '@/contracts';
import { getSettingsRepository } from '@/repositories/repository.factory';

/**
 * Los ajustes, por el nombre con el que se usan en la app.
 *
 * ## Esto ya no toca la base de datos
 *
 * Antes el servicio resolvia su cliente con `getDatabaseClient()` y componia
 * el SQL dentro, y por eso era imposible responder a dos preguntas que salen
 * al tocarlo: que necesitaba —el servicio entero, para probarlo— y que puede
 * hacer el puente —nada, porque no habia forma de saber que parte del trafico
 * de la app llegaba al servidor sin leerlo entero y contar cada `execute`.
 *
 * Ahora es una fachada de tres lineas sobre `ISettingsRepository`, y el
 * repositorio que toca cada modo es el suyo: SQL para el plugin de Tauri y el
 * cliente en memoria, operaciones con nombre para el puente de desarrollo.
 *
 * Se conserva la fachada —y no se llama al factory desde cada sitio— para que
 * las ocho llamadas de `app.component.tsx` no tengan que cambiar y para que
 * `settings.service.spec.ts` siga probando lo mismo.
 */
export const settingsService = {
  async load(): Promise<IAppSettings> {
    return (await getSettingsRepository()).load();
  },

  async set<K extends keyof IAppSettings>(
    key: K,
    value: IAppSettings[K],
  ): Promise<void> {
    await (await getSettingsRepository()).set(key, value);
  },

  async setMany(patch: Partial<IAppSettings>): Promise<void> {
    await (await getSettingsRepository()).setMany(patch);
  },

  /** Borra la clave de la API de la base de datos. */
  forgetApiKey(): Promise<void> {
    return this.set('steamApiKey', '');
  },
};
