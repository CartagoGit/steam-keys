import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { IDatabaseClient, IGameKeyRow } from '@/contracts';

/**
 * Tests de la traida de las copias antiguas.
 *
 * Lo que se comprueba aqui es el contrato con el que se habla con Rust y con el
 * plugin de SQL, no la base de datos: que se lean todas las copias, que una que
 * falle no pare a las demas, y —sobre todo— que la copia preparada se cierre
 * **diciendo cual es**.
 *
 * Esto ultimo no es un detalle. En `tauri-plugin-sql`, `close()` sin argumento
 * cierra *todos* los pools abiertos, incluida la base de datos principal. Como
 * la migracion escribe en la principal mientras lee la preparada, cerrarla sin
 * nombre se llevaba por delante la conexion que estaba a punto de usar y todo
 * lo que venia despues fallaba. El fallo era invisible —los dos `catch` se lo
 * comian— y la migracion se quedaba a medias para siempre.
 */

/** Lo que el codigo pidio a Rust y al plugin, en orden. */
interface IRegistro {
  invocados: string[];
  cierres: (string | undefined)[];
  filasPorConexion: Map<string, IGameKeyRow[]>;
  /** Conexiones cuya carga revienta, para simular un fichero ilegible. */
  rotas: Set<string>;
  staging: Map<string, string>;
}

const registro: IRegistro = {
  invocados: [],
  cierres: [],
  filasPorConexion: new Map(),
  rotas: new Set(),
  staging: new Map(),
};

function reiniciar(): void {
  registro.invocados = [];
  registro.cierres = [];
  registro.filasPorConexion.clear();
  registro.rotas.clear();
  registro.staging.clear();
}

function fila(keyValue: string, title: string): IGameKeyRow {
  return {
    id: 1,
    title,
    key_value: keyValue,
    platform: 'steam',
    status: 'available',
    source: 'manual',
    gifted_to: null,
    parent_title: null,
    note: null,
    tags: '',
    added_on: null,
    last_used_at: null,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00',
  } as IGameKeyRow;
}

mock.module('@tauri-apps/api/core', () => ({
  invoke: async (comando: string, args?: { name?: string }) => {
    registro.invocados.push(comando);

    if (comando === 'legacy_backups') return [...registro.staging.keys()];

    if (comando === 'stage_legacy_backup') {
      const ruta = registro.staging.get(args?.name ?? '');

      if (ruta === undefined) throw new Error('no existe');

      return ruta;
    }

    if (comando === 'discard_staged_backup') return undefined;

    throw new Error(`comando inesperado: ${comando}`);
  },
}));

mock.module('@tauri-apps/plugin-sql', () => ({
  default: class FakeSqliteDatabase {
    static async load(ruta: string): Promise<FakeSqliteDatabase> {
      if (registro.rotas.has(ruta)) throw new Error('fichero ilegible');

      return new FakeSqliteDatabase(ruta);
    }

    constructor(private readonly ruta: string) {}

    async select(): Promise<IGameKeyRow[]> {
      return registro.filasPorConexion.get(this.ruta) ?? [];
    }

    // El `db` se anota tal cual llega: con `undefined` se ve enseguida que se
    // esta llamando al `close()` que se lleva por delante todos los pools.
    async close(db?: string): Promise<boolean> {
      registro.cierres.push(db);
      return true;
    }
  },
}));

/** Base de datos en memoria que apunta a una tabla `backups` de verdad. */
function clienteFalso(): IDatabaseClient & { backups: Map<string, string> } {
  const backups = new Map<string, string>();
  const ajustes = new Map<string, string>();

  return {
    backups,
    async execute(sql: string, bind: readonly unknown[] = []) {
      if (sql.includes('INSERT OR IGNORE INTO backups')) {
        backups.set(String(bind[0]), String(bind[3]));
        return 1;
      }

      if (sql.includes('INSERT INTO app_settings')) {
        ajustes.set(String(bind[0]), String(bind[1]));
        return 1;
      }

      return 0;
    },
    async select<T>(sql: string, bind: readonly unknown[] = []) {
      if (sql.includes('FROM app_settings')) {
        const valor = ajustes.get(String(bind[0]));

        return (valor === undefined ? [] : [{ value: valor }]) as T[];
      }

      if (sql.includes('FROM backups')) {
        return [...backups.keys()].map((nombre) => ({ nombre })) as T[];
      }

      return [] as T[];
    },
    async migrate() {},
    async close() {},
  };
}

const { legacyBackupsMigrated, migrateLegacyBackups } = await import(
  './legacy-backups.service'
);

describe('traer las copias antiguas', () => {
  beforeEach(reiniciar);

  test('cada copia antigua acaba en la tabla, con sus filas dentro', async () => {
    registro.staging.set('copia-1.db', 'sqlite:/tmp/copia-1.db');
    registro.filasPorConexion.set('sqlite:/tmp/copia-1.db', [
      fila('AAAA-1111', 'Half Life'),
      fila('BBBB-2222', 'Portal'),
    ]);

    const db = clienteFalso();

    expect(await migrateLegacyBackups(db)).toBe(1);
    expect(db.backups.size).toBe(1);

    const guardada = db.backups.get('copia-1.db') ?? '';
    const contenido = JSON.parse(guardada) as { rowCount: number; rows: IGameKeyRow[] };

    expect(contenido.rowCount).toBe(2);
    expect(contenido.rows.map((fila) => fila.key_value)).toEqual(['AAAA-1111', 'BBBB-2222']);
  });

  test('la copia preparada se cierra diciendo cual es, no cerrando todo', async () => {
    registro.staging.set('copia-1.db', 'sqlite:/tmp/copia-1.db');
    registro.filasPorConexion.set('sqlite:/tmp/copia-1.db', [fila('AAAA-1111', 'Half Life')]);

    await migrateLegacyBackups(clienteFalso());

    expect(registro.cierres).toEqual(['sqlite:/tmp/copia-1.db']);
    expect(registro.cierres.some((db) => db === undefined)).toBe(false);
  });

  test('una copia ilegible no impide traer las demas', async () => {
    registro.staging.set('rota.db', 'sqlite:/tmp/rota.db');
    registro.rotas.add('sqlite:/tmp/rota.db');
    registro.staging.set('buena.db', 'sqlite:/tmp/buena.db');
    registro.filasPorConexion.set('sqlite:/tmp/buena.db', [fila('CCCC-3333', 'Portal 2')]);

    const db = clienteFalso();

    expect(await migrateLegacyBackups(db)).toBe(1);
    expect([...db.backups.keys()]).toEqual(['buena.db']);
  });

  test('si alguna falla no se marca como hecha, para poder reintentarlo', async () => {
    registro.staging.set('rota.db', 'sqlite:/tmp/rota.db');
    registro.rotas.add('sqlite:/tmp/rota.db');

    const db = clienteFalso();

    await migrateLegacyBackups(db);

    expect(await legacyBackupsMigrated(db)).toBe(false);
  });

  test('sin copias antiguas no se toca nada', async () => {
    const db = clienteFalso();

    expect(await migrateLegacyBackups(db)).toBe(0);
    expect(await legacyBackupsMigrated(db)).toBe(false);
    expect(db.backups.size).toBe(0);
    expect(registro.invocados).toEqual(['legacy_backups']);
  });

  test('hecha de verdad, no se repite al siguiente arranque', async () => {
    registro.staging.set('copia-1.db', 'sqlite:/tmp/copia-1.db');
    registro.filasPorConexion.set('sqlite:/tmp/copia-1.db', [fila('AAAA-1111', 'Half Life')]);

    const db = clienteFalso();

    await migrateLegacyBackups(db);

    expect(await legacyBackupsMigrated(db)).toBe(true);
  });

  test('las que ya estan dentro no se vuelven a abrir', async () => {
    registro.staging.set('copia-1.db', 'sqlite:/tmp/copia-1.db');
    registro.filasPorConexion.set('sqlite:/tmp/copia-1.db', [fila('AAAA-1111', 'Half Life')]);

    const db = clienteFalso();

    // Primera pasada: entra.
    expect(await migrateLegacyBackups(db)).toBe(1);

    // Segunda pasada, como si alguien hubiera borrado la marca a mano: la fila
    // sigue en la tabla, asi que el fichero no se vuelve a abrir.
    const dbSinMarcar = clienteFalso();
    dbSinMarcar.backups.set('copia-1.db', '{}');
    registro.cierres = [];

    expect(await migrateLegacyBackups(dbSinMarcar)).toBe(0);
    expect(registro.cierres).toEqual([]);
  });

  test('nunca borra las copias antiguas del usuario', async () => {
    registro.staging.set('copia-1.db', 'sqlite:/tmp/copia-1.db');
    registro.filasPorConexion.set('sqlite:/tmp/copia-1.db', [fila('AAAA-1111', 'Half Life')]);

    await migrateLegacyBackups(clienteFalso());

    expect(registro.invocados).toContain('discard_staged_backup');
    // Lo unico que se descarta es el temporal: en la carpeta solo se lee.
    expect(registro.invocados.filter((comando) => comando === 'legacy_backups')).toHaveLength(1);
  });
});