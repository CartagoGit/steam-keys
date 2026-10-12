import { describe, expect, test } from 'bun:test';

import { mergeKeysFromBackup, resumirRestauracion } from './merge-keys.helper';
import { KeyPlatform, KeySource, KeyStatus, RestoreMode, type IDatabaseClient, type IGameKeyRow } from '@/contracts';

/**
 * Cliente falso que responde a las dos consultas que usa la fusion.
 *
 * Basta para ejercitar la logica sin levantar Tauri ni SQLite.
 */
class FakeDatabase implements IDatabaseClient {
  /** ids asignados a cada clave ya presente. */
  readonly existentes = new Map<string, number>();
  /** Sentencias ejecutadas, para inspeccionar el resultado. */
  readonly inserts: unknown[][] = [];
  readonly updates: unknown[][] = [];
  /** Cuantas consultas se han hecho. Antes era una por fila. */
  consultas = 0;
  /** Transacciones abiertas y confirmadas, para ver que se respeta el Atomico. */
  abiertas = 0;
  confirmadas = 0;
  deshechas = 0;
  /** Falla en la escritura numero N, para probar que no queda nada a medias. */
  readonly fallarEn: number | undefined;

  private nextId = 1;
  private escrituras = 0;

  constructor(clavesIniciales: readonly string[] = [], fallarEn?: number) {
    for (const clave of clavesIniciales) {
      this.existentes.set(normalizar(clave), this.nextId++);
    }

    this.fallarEn = fallarEn;
  }

  async execute(sql: string, bind: readonly unknown[] = []): Promise<number> {
    if (/^\s*(INSERT|UPDATE)/i.test(sql)) {
      this.escrituras += 1;

      if (this.escrituras === this.fallarEn) {
        throw new Error('disco lleno');
      }
    }

    if (/^\s*INSERT/i.test(sql)) {
      this.inserts.push([...bind]);
      this.existentes.set(normalizar(String(bind[1])), this.nextId++);
      return 1;
    }

    if (/^\s*UPDATE/i.test(sql)) {
      this.updates.push([...bind]);
      return 1;
    }

    return 0;
  }

  async select<T>(sql: string, bind: readonly unknown[] = []): Promise<T[]> {
    if (/FROM game_keys WHERE key_value/i.test(sql)) {
      this.consultas += 1;
      const clave = normalizar(String(bind[0]));
      const id = this.existentes.get(clave);

      return (id === undefined ? [] : [{ id }]) as T[];
    }

    // La lectura de una vez: todas las claves con su id.
    if (/SELECT id, key_value FROM game_keys$/i.test(sql.replace(/\s+/g, ' '))) {
      this.consultas += 1;

      return [...this.existentes.entries()].map(([key_value, id]) => ({
        id,
        key_value,
      })) as T[];
    }

    return [];
  }

  async migrate(): Promise<void> {}

  async close(): Promise<void> {}

  /**
   * Transaccion de mentira pero con la misma forma: si algo falla dentro, se
   * deshace y no queda ninguna escritura. Por eso guarda una foto al abrir y la
   * restaura al cerrar sin exito.
   */
  async transaccion<T>(fn: () => Promise<T>): Promise<T> {
    this.abiertas += 1;
    const foto = new Map(this.existentes);
    const inserts = this.inserts.length;

    try {
      const valor = await fn();

      this.confirmadas += 1;

      return valor;
    } catch (error) {
      this.deshechas += 1;
      this.existentes.clear();

      for (const [clave, id] of foto) this.existentes.set(clave, id);

      this.inserts.length = inserts;

      throw error;
    } finally {
      this.abiertas -= 1;
    }
  }
}

function normalizar(valor: string): string {
  return valor.trim().toUpperCase();
}

/** Fila de una copia de seguridad. Las claves son sinteticas. */
function fila(overrides: Partial<IGameKeyRow> = {}): IGameKeyRow {
  return {
    id: 1,
    title: 'Celeste',
    key_value: 'MQ7RT-29XKL-ZPN84',
    platform: KeyPlatform.Steam,
    status: KeyStatus.Available,
    source: KeySource.LegacyTxt,
    gifted_to: null,
    parent_title: null,
    note: null,
    tags: '',
    added_on: '2025-01-22',
    last_used_at: null,
    created_at: '2025-01-22 00:00:00',
    updated_at: '2025-01-22 00:00:00',
    ...overrides,
  };
}

/** Cuatro filas, de las que dos ya estan en la coleccion. */
const MEZCLA: readonly IGameKeyRow[] = [
  fila({ key_value: 'MQ7RT-29XKL-ZPN84', title: 'Celeste' }),
  fila({ key_value: 'B4KMD-58RQW-LNCT3', title: 'Hollow Knight' }),
  fila({ key_value: 'ZR92N-7JDMK-QPW45', title: 'Grim Dawn' }),
  fila({ key_value: 'TL93F-1HWZJ-9XDMV', title: 'Undertale' }),
];

describe('restaurar una copia sin perder lo actual', () => {
  test('una clave que no existe se inserta', async () => {
    const db = new FakeDatabase();

    const resumen = await mergeKeysFromBackup(db, [fila()], RestoreMode.Fusionar);

    expect(resumen).toEqual({ total: 1, inserted: 1, skipped: 0, updated: 0 });
    expect(db.inserts).toHaveLength(1);
  });

  test('una clave que ya existe no se toca al fusionar', async () => {
    const db = new FakeDatabase(['mq7rt-29xkl-zpn84']);

    const resumen = await mergeKeysFromBackup(db, [fila()], RestoreMode.Fusionar);

    expect(resumen).toEqual({ total: 1, inserted: 0, skipped: 1, updated: 0 });
    expect(db.inserts).toHaveLength(0);
    expect(db.updates).toHaveLength(0);
  });

  test('al sobrescribir, la clave existente vuelve a su estado de la copia', async () => {
    const db = new FakeDatabase(['mq7rt-29xkl-zpn84']);

    const resumen = await mergeKeysFromBackup(
      db,
      [fila({ status: KeyStatus.Gifted })],
      RestoreMode.Sobrescribir,
    );

    expect(resumen).toEqual({ total: 1, inserted: 0, skipped: 0, updated: 1 });
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0]?.[2]).toBe(KeyStatus.Gifted);
  });

  test('fusionar nunca borra: el total no puede bajar', async () => {
    const db = new FakeDatabase(['mq7rt-29xkl-zpn84']);

    await mergeKeysFromBackup(db, [fila()], RestoreMode.Fusionar);

    expect(db.existentes.size).toBe(1);
  });

  test('la comparacion de claves ignora mayusculas y espacios', async () => {
    const db = new FakeDatabase(['  mq7rt-29xkl-zpn84 ']);

    const resumen = await mergeKeysFromBackup(
      db,
      [fila({ key_value: 'MQ7RT-29XKL-ZPN84' })],
      RestoreMode.Fusionar,
    );

    expect(resumen.inserted).toBe(0);
    expect(resumen.skipped).toBe(1);
  });

  test('mezcla de nuevas y existentes', async () => {
    const db = new FakeDatabase(['MQ7RT-29XKL-ZPN84']);

    const resumen = await mergeKeysFromBackup(db, MEZCLA.slice(0, 3), RestoreMode.Sobrescribir);

    expect(resumen).toEqual({ total: 3, inserted: 2, skipped: 0, updated: 1 });
    expect(db.existentes.size).toBe(3);
  });

  test('se conservan los campos del DLC y del destinatario', async () => {
    const db = new FakeDatabase();

    await mergeKeysFromBackup(
      db,
      [
        fila({
          title: 'Cities Skylines Snowfall',
          parent_title: 'Cities Skylines',
          gifted_to: 'Olga',
          note: 'Humble Choice',
          tags: 'dlc,humble',
        }),
      ],
      RestoreMode.Fusionar,
    );

    // Orden del INSERT: title, key, platform, status, source, gifted_to,
    // parent_title, note, tags, added_on, last_used_at, created_at.
    const inserted = db.inserts[0] ?? [];
    expect(inserted[0]).toBe('Cities Skylines Snowfall');
    expect(inserted[5]).toBe('Olga');
    expect(inserted[6]).toBe('Cities Skylines');
    expect(inserted[7]).toBe('Humble Choice');
    expect(inserted[8]).toBe('dlc,humble');
  });

  test('una copia vacia no rompe nada', async () => {
    const db = new FakeDatabase(['MQ7RT-29XKL-ZPN84']);

    const resumen = await mergeKeysFromBackup(db, [], RestoreMode.Fusionar);

    expect(resumen).toEqual({ total: 0, inserted: 0, skipped: 0, updated: 0 });
    expect(db.inserts).toHaveLength(0);
  });
});

/**
 * El resumen es lo que el dialogo enseña **antes** de confirmar.
 *
 * Si el numero no cuadra con lo que hace la restauracion, el dialogo esta
 * mintiendo con una operacion irreversible delante. Por eso se atan las dos
 * funciones con tests de paridad: comparten el mismo reparto y solo se
 * separan en que la segunda escribe.
 */
/**
 * Una restauracion son cientos de escrituras, y SQLite confirma una a una.
 *
 * Sin transaccion, un fallo a mitad —un disco lleno, una copia corrupta—
 * dejaba la coleccion con medio camino hecho y sin forma de saber hasta donde:
 * el dialogo decia «se han anadido 200» y no habia forma de volver atras.
 */
describe('una restauracion es todo o nada', () => {
  test('va dentro de una transaccion', async () => {
    const db = new FakeDatabase();

    await mergeKeysFromBackup(db, MEZCLA, RestoreMode.Fusionar);

    expect(db.abiertas).toBe(0);
    expect(db.confirmadas).toBe(1);
    expect(db.deshechas).toBe(0);
  });

  test('si falla a mitad no queda ninguna escritura', async () => {
    // Falla en la tercera escritura, con la primera ya dentro.
    const db = new FakeDatabase(['MQ7RT-29XKL-ZPN84'], 3);

    await expect(
      mergeKeysFromBackup(db, MEZCLA, RestoreMode.Sobrescribir),
    ).rejects.toThrow('disco lleno');

    expect(db.deshechas).toBe(1);
    expect(db.confirmadas).toBe(0);

    // La coleccion se queda como estaba: ni las nuevas, ni el titulo cambiado
    // de las viejas.
    expect(db.existentes.size).toBe(1);
    expect(db.inserts).toHaveLength(0);
  });

  test('el resumen abre ninguna transaccion: solo mira', async () => {
    const db = new FakeDatabase(['MQ7RT-29XKL-ZPN84']);

    await resumirRestauracion(db, MEZCLA, RestoreMode.Fusionar);

    // Abrir una transaccion para contar es gastar un bloqueo de escritura
    // —y en SQLite, dejar la base bloqueada si algo va mal— sin escribir nada.
    expect(db.abiertas).toBe(0);
    expect(db.confirmadas).toBe(0);
  });
});

describe('el resumen cuenta exactamente lo que hace la restauracion', () => {
  for (const modo of [RestoreMode.Fusionar, RestoreMode.Sobrescribir]) {
    const nombre = modo === RestoreMode.Fusionar ? 'fusionando' : 'sobrescribiendo';

    test(`coincide ${nombre}`, async () => {
      const existentes = ['MQ7RT-29XKL-ZPN84', 'ZR92N-7JDMK-QPW45'];

      const contado = await resumirRestauracion(
        new FakeDatabase(existentes),
        MEZCLA,
        modo,
      );

      const hecho = await mergeKeysFromBackup(
        new FakeDatabase(existentes),
        MEZCLA,
        modo,
      );

      expect(contado).toEqual(hecho);
    });
  }

  test('el resumen no escribe nada', async () => {
    const db = new FakeDatabase(['MQ7RT-29XKL-ZPN84']);

    await resumirRestauracion(db, MEZCLA, RestoreMode.Sobrescribir);

    // Es la diferencia entre «enseñar lo que va a pasar» y «hacerlo»: si el
    // resumen escribiera, abrir el dialogo y cancelarlo habria cambiado algo.
    expect(db.inserts).toHaveLength(0);
    expect(db.updates).toHaveLength(0);
    expect(db.existentes.size).toBe(1);
  });

  test('al fusionar cuenta las nuevas y se salta las que ya hay', async () => {
    const db = new FakeDatabase(['MQ7RT-29XKL-ZPN84', 'ZR92N-7JDMK-QPW45']);

    const resumen = await resumirRestauracion(db, MEZCLA, RestoreMode.Fusionar);

    expect(resumen).toEqual({ total: 4, inserted: 2, skipped: 2, updated: 0 });
  });

  test('al sobrescribir cuenta las nuevas y actualiza las que ya hay', async () => {
    const db = new FakeDatabase(['MQ7RT-29XKL-ZPN84', 'ZR92N-7JDMK-QPW45']);

    const resumen = await resumirRestauracion(db, MEZCLA, RestoreMode.Sobrescribir);

    expect(resumen).toEqual({ total: 4, inserted: 2, skipped: 0, updated: 2 });
  });

  test('las tres cifras suman el total: no queda nada sin contabilizar', async () => {
    // Un reparto al que le falta una cifra no se nota mirando una, pero
    // significa que hay claves que ni se insertan ni se anuncian.
    const db = new FakeDatabase(['MQ7RT-29XKL-ZPN84']);

    for (const modo of [RestoreMode.Fusionar, RestoreMode.Sobrescribir]) {
      const resumen = await resumirRestauracion(db, MEZCLA, modo);

      expect(resumen.inserted + resumen.skipped + resumen.updated).toBe(resumen.total);
    }
  });

  test('la comparacion ignora mayusculas y espacios, como al restaurar', async () => {
    const db = new FakeDatabase(['  mq7rt-29xkl-zpn84  ']);

    const resumen = await resumirRestauracion(db, [fila()], RestoreMode.Fusionar);

    // Si el resumen normalizara distinto que la fusion, el dialogo prometeria
    // «van a entrar 1» y luego la restauracion no entraria ninguna.
    expect(resumen).toEqual({ total: 1, inserted: 0, skipped: 1, updated: 0 });
  });

  test('la decision de «ya existe» se toma una sola vez, no una por fila', async () => {
    const db = new FakeDatabase(['MQ7RT-29XKL-ZPN84', 'ZR92N-7JDMK-QPW45']);

    await resumirRestauracion(db, MEZCLA, RestoreMode.Fusionar);

    // Antes era una consulta por fila: con una copia de cuatrocientas claves
    // eran cuatrocientas idas y vueltas para decidir lo mismo cuatrocientas
    // veces. Una sola, y el resto del tiempo es trabajo de verdad.
    expect(db.consultas).toBe(1);
  });

  test('lo mismo al escribir', async () => {
    const db = new FakeDatabase(['MQ7RT-29XKL-ZPN84']);

    await mergeKeysFromBackup(db, MEZCLA, RestoreMode.Sobrescribir);

    expect(db.consultas).toBe(1);
  });

  test('una copia vacia da un resumen de ceros, no falla', async () => {
    const resumen = await resumirRestauracion(new FakeDatabase(), [], RestoreMode.Fusionar);

    expect(resumen).toEqual({ total: 0, inserted: 0, skipped: 0, updated: 0 });
  });
});