import {
  SCHEMA_STATEMENTS,
  STORAGE_KEY_PREFIX,
  TABLE_APP_SETTINGS,
  type IAppSettings,
  type IDatabaseClient,
} from '@/contracts';

/**
 * Clave de `localStorage` de los ajustes.
 *
 * Sale de `STORAGE_KEY_PREFIX` y no esta escrita a mano: `memory-game-key.repository`
 * guarda las claves en `steam-keys:memory-repository` y aqui los ajustes en
 * `steam-keys:settings`, y el prefijo tenia que cambiar en los dos a la vez.
 */
const STORAGE_KEY = `${STORAGE_KEY_PREFIX}:settings`;

/**
 * Cliente de base de datos en memoria, para el navegador sin Tauri.
 *
 * Solo implementa las cuatro operaciones de `IDatabaseClient`, pero ninguna
 * entiende SQL de verdad: reconoce las sentencias que la app emite de verdad
 * (una lectura de `app_settings` y un upsert) y el resto las acepta como no
 * op. Es a proposito. El repositorio de claves del navegador ya tiene su propia
 * implementacion en memoria y no pasa por aqui; este cliente existe unicamente
 * para que los ajustes se guarden tambien en el navegador, sin Tauri.
 *
 * Si alguna vez hiciera falta ejecutar SQL de verdad aqui, habria que traerse
 * `sql.js`, que son varios megabytes solo para el modo de desarrollo.
 */
export function memoryDatabaseClient(): IDatabaseClient {
  let ajustes: Record<string, string> = read();

  // Los dos patrones se montan con el nombre de la tabla y no escritos a mano:
  // si la tabla se renombra en el esquema, esto deja de reconocerla y falla en
  // silencio — el navegador guardaria ajustes en un almacen y la app no los
  // veria nunca—. La constante es un identificador sin metacaracteres, asi que
  // interpolar en la expresion regular es seguro.
  const ES_UPSERT = new RegExp(`^INSERT INTO ${TABLE_APP_SETTINGS}`, 'i');
  const ES_LECTURA = new RegExp(`^SELECT key, value FROM ${TABLE_APP_SETTINGS}`, 'i');

  return {
    async execute(sql: string, bind: readonly unknown[] = []) {
      const limpio = sql.replace(/\s+/g, ' ').trim();

      if (ES_UPSERT.test(limpio)) {
        const [key, value] = bind;
        ajustes[String(key)] = bindToString(value);
        persist(ajustes);
        return 1;
      }

      return 0;
    },

    async select<T>(sql: string, bind: readonly unknown[] = []): Promise<T[]> {
      const limpio = sql.replace(/\s+/g, ' ').trim();

      if (ES_LECTURA.test(limpio)) {
        void bind;

        return Object.entries(ajustes).map(([key, value]) => ({
          key,
          value,
        })) as T[];
      }

      return [];
    },

    async migrate() {
      // Las sentencias CREATE no aplican a un almacen de pares clave/valor: la
      // tabla no existe de verdad. Se recorren igual para que, si alguna vez se
      // anade aqui algo que si deba aplicarse, no se pase por alto.
      for (const statement of SCHEMA_STATEMENTS) {
        void statement;
      }
    },

    async close() {
      persist(ajustes);
    },

    /**
     * Solo ejecuta: cada escritura se persiste en cuanto se hace.
     *
     * No es una transaccion real y no se disfraza de una. Es que una escritura
     * es **una** escritura —un `localStorage.setItem` no puede quedar a medias—,
     * asi que el contrato se cumple sin `BEGIN` ni `ROLLBACK`. Si alguna vez
     * anaden aqui una operacion de varias sentencias, esto tiene que cambiar y
     * el comentario con el.
     */
    async transaccion<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    },
  };
}

function read(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};

  try {
    const crudo = localStorage.getItem(STORAGE_KEY);
    if (!crudo) return {};
    return JSON.parse(crudo) as Record<string, string>;
  } catch {
    return {};
  }
}

function persist(ajustes: Record<string, string>): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ajustes));
  } catch {
    // Modo privado del navegador o cuota llena. Los ajustes se quedan en
    // memoria para esta sesion, que es mejor que romper la app al guardar.
  }
}

function bindToString(value: unknown): string {
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Tipo auxiliar para quien necesite leer el almacen sin el cliente. */
export type MemorySettings = Partial<IAppSettings>;