import {
  DEFAULT_SETTINGS,
  TABLE_APP_SETTINGS,
  type IAppSettings,
  type IDatabaseClient,
  type ISettingRow,
  type ISettingsRepository,
} from '@/contracts';
import { sqlPlaceholders } from '@/helpers/sql.helper';
import {
  readBool,
  readKind,
  readLocale,
  readScope,
  readTheme,
  readView,
  serializeSetting,
} from '@/helpers/settings.helper';

/**
 * Lectura y escritura de la tabla `app_settings` sobre SQL.
 *
 * Sirve para los dos motores que hablan sentencias: el plugin de Tauri y el
 * cliente en memoria del navegador. Cuando no hay ninguno de los dos —el
 * navegador de desarrollo, que va por HTTP— se usa `HttpSettingsRepository`.
 *
 * ## Todo se guarda como texto
 *
 * SQLite no tiene booleano, asi que `true` y `false` van como `'1'` y `'0'`,
 * que es lo que devuelve `CAST(x AS INTEGER)` en cualquier version. Un ajuste
 * mal escrito se ignora y se cae al valor por defecto, para que una fila
 * corrupta no deje la app sin arrancar.
 */
export class SqliteSettingsRepository implements ISettingsRepository {
  constructor(private readonly db: IDatabaseClient) {}

  async load(): Promise<IAppSettings> {
    let filas: readonly ISettingRow[];

    try {
      filas = await this.db.select<ISettingRow>(
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
  }

  async set<K extends keyof IAppSettings>(
    key: K,
    value: IAppSettings[K],
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO ${TABLE_APP_SETTINGS} (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [key, serializeSetting(value)],
    );
  }

  /**
   * Una fila por clave dentro de la misma sentencia.
   *
   * Delegar en `set` —que es como estaba— era el mismo `INSERT` repetido, y si
   * un dia cambiaba solo se acordaba uno de los dos. Ademas, guardar ambito,
   * tipo y vista —que es lo que pasa al cambiar un filtro— eran tres viajes
   * para escribir tres celdas.
   */
  async setMany(patch: Partial<IAppSettings>): Promise<void> {
    const entradas = Object.entries(patch).filter(
      ([, valor]) => valor !== undefined,
    ) as [keyof IAppSettings, never][];

    if (entradas.length === 0) return;

    const binds = entradas.flatMap(([key, valor]) => [
      key,
      serializeSetting(valor),
    ]);

    await this.db.execute(setManyStatement(entradas.length), binds);
  }

  async readRaw(clave: string): Promise<string | null> {
    try {
      const filas = await this.db.select<{ value: string }>(
        `SELECT value FROM ${TABLE_APP_SETTINGS} WHERE key = $1`,
        [clave],
      );

      return filas[0]?.value ?? null;
    } catch {
      // Sin tabla todavia no hay nada guardado. La marca se escribira en la
      // proxima migracion.
      return null;
    }
  }

  async writeRaw(clave: string, valor: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO ${TABLE_APP_SETTINGS} (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [clave, valor],
    );
  }
}

/**
 * El `INSERT` de varios ajustes a la vez.
 *
 * Los marcadores los pone `sqlPlaceholders`, que es quien los lleva haciendo
 * bien en todas partes. El `no-inline-sql` lo acepta justamente porque de los
 * valores aqui solo salen marcadores: las claves y los valores van en `binds`.
 *
 * Se exporta porque hay que poder mirar la sentencia que se va a ejecutar —
 * `settings.service.spec.ts` lo hace— sin montar una base de datos.
 */
export function setManyStatement(cuantas: number): string {
  /*
   * `placeholders`, y no otra cosa, porque es lo unico que va ahi dentro: cada
   * grupo son dos marcadores —clave y valor— montados por `sqlPlaceholders`.
   * Ni una letra de dato entra en el texto, que es justo lo que vigila el
   * `no-inline-sql` cuando ve el nombre.
   */
  const placeholders = Array.from(
    { length: cuantas },
    (_, indice) => `(${sqlPlaceholders(2, indice * 2 + 1)})`,
  ).join(', ');

  return `INSERT INTO ${TABLE_APP_SETTINGS} (key, value) VALUES ${placeholders}
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
}