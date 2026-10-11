import { SCHEMA_STATEMENTS, type IAppSettings, type IDatabaseClient } from '@/contracts';

const STORAGE_KEY = 'steam-keys:settings';

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

  return {
    async execute(sql: string, bind: readonly unknown[] = []) {
      const limpio = sql.replace(/\s+/g, ' ').trim();

      if (/^INSERT INTO app_settings/i.test(limpio)) {
        const [key, value] = bind;
        ajustes[String(key)] = bindToString(value);
        persist(ajustes);
        return 1;
      }

      return 0;
    },

    async select<T>(sql: string, bind: readonly unknown[] = []): Promise<T[]> {
      const limpio = sql.replace(/\s+/g, ' ').trim();

      if (/^SELECT key, value FROM app_settings/i.test(limpio)) {
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

/** Borra los ajustes guardados. Solo para tests. */
export function clearMemorySettings(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que hacer: si no se puede escribir, tampoco se puede borrar.
  }
}

/** Tipo auxiliar para quien necesite leer el almacen sin el cliente. */
export type MemorySettings = Partial<IAppSettings>;