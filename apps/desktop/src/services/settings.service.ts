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

/** Ajustes por defecto: los de una instalacion nueva, sin tocar nada. */
/**
 * El tema por defecto es Nord, y no «el del sistema».
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

/**
 * Lectura y escritura de la tabla `app_settings`.
 *
 * Se guarda todo como texto porque SQLite no tiene booleano: `true` y `false`
 * se guardan como `'1'` y `'0'`, que es lo que devuelve `CAST(x AS INTEGER)`
 * en cualquier version. Un ajuste mal escrito se ignora y se cae al valor por
 * defecto, para que una fila corrupta no deje la app sin arrancar.
 */
/**
 * El `INSERT` de varios ajustes a la vez.
 *
 * Una fila por clave dentro de la misma sentencia, con el `ON CONFLICT` de
 * siempre: guardar tres cosas son tres viajes, no uno. El navegador guarda
 * ambito, tipo y vista juntos al cambiar un filtro, y con una sentencia por
 * clave eran tres idas y venidas para escribir tres celdas de una tabla de
 * tres filas.
 *
 * Los marcadores los pone `sqlPlaceholders`, que es quien los lleva haciendo
 * bien en todas partes. El `no-inline-sql` lo acepta justamente porque de los
 * valores aqui solo salen marcadores: las claves y los valores van en `binds`.
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
   * Guarda varios ajustes de una vez.
   *
   * Todos en la misma sentencia, y solo los que han cambiado de verdad.
   *
   * Delegar en `set` era lo de antes: eran el mismo `INSERT` repetido, y si un
   * dia cambiaba solo se acordaba uno de los dos. Ademas, guardar ambito, tipo
   * y vista —que es lo que pasa al cambiar un filtro— eran tres viajes para
   * escribir tres celdas.
   */
  async setMany(patch: Partial<IAppSettings>): Promise<void> {
    const entradas = Object.entries(patch).filter(
      ([, valor]) => valor !== undefined,
    ) as [keyof IAppSettings, never][];

    if (entradas.length === 0) return;

    const db = await getDatabaseClient();
    const binds = entradas.flatMap(([key, valor]) => [key, serializeSetting(valor)]);

    await db.execute(setManyStatement(entradas.length), binds);
  },

  /** Borra la clave de la API de la base de datos. */
  async forgetApiKey(): Promise<void> {
    await this.set('steamApiKey', '');
  },
};