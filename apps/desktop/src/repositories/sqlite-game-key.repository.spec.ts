import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SqliteGameKeyRepository } from './sqlite-game-key.repository';
import { KeyPlatform, KeySource, KeyStatus, SCHEMA_STATEMENTS, type IDatabaseClient } from '@/contracts';

/**
 * Tests del repositorio de claves contra un SQLite de verdad.
 *
 * Aqui no se comprueba que el codigo llame a la sentencia que quiere, sino
 * lo que queda escrito en la base de datos. Es la unica forma de cazar los
 * errores de `bind`: una sentencia puede tener la forma perfecta y aun asi
 * guardar el valor equivocado si los indices no cuadran, y eso no se ve leyendo
 * el SQL.
 */

/** Repositorio sobre una base de datos temporal, con el esquema de la app. */
function crearRepositorio(): {
  repo: SqliteGameKeyRepository;
  db: IDatabaseClient;
  leer: (sql: string) => unknown[];
  limpiar: () => void;
} {
  const dir = mkdtempSync(join(tmpdir(), 'steam-keys-repo-'));
  const sqlite = new Database(join(dir, 'test.db'), { create: true });

  for (const sentencia of SCHEMA_STATEMENTS) sqlite.run(sentencia);

  const db: IDatabaseClient = {
    async execute(sql, bind = []) {
      const resultado = sqlite.run(sql, [...bind] as never[]);

      return Number(resultado.changes);
    },
    async select<T>(sql: string, bind: readonly unknown[] = []) {
      return sqlite.query(sql).all(...(bind as never[])) as T[];
    },
    async migrate() {
      for (const sentencia of SCHEMA_STATEMENTS) sqlite.run(sentencia);
    },
    async close() {
      sqlite.close();
    },
    async transaccion<T>(fn: () => Promise<T>): Promise<T> {
      sqlite.run('BEGIN');
      try {
        const valor = await fn();
        sqlite.run('COMMIT');
        return valor;
      } catch (error) {
        sqlite.run('ROLLBACK');
        throw error;
      }
    },
  };

  return {
    repo: new SqliteGameKeyRepository(db),
    db,
    leer: (sql) => sqlite.query(sql).all(),
    limpiar: () => {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Una marca de tiempo de SQLite tiene forma `AAAA-MM-DD HH:MM:SS`. */
const ES_SELLO = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

describe('cambiar el estado de varias claves a la vez', () => {
  test('updated_at recibe una fecha, no el estado', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.importRows([
        fila('AAAA-1111-AAAA'),
        fila('BBBB-2222-BBBB'),
        fila('CCCC-3333-CCCC'),
      ]);

      await repo.setStatusMany(
        [1, 2, 3],
        KeyStatus.Gifted,
      );

      const filas = leer(
        'SELECT status, updated_at FROM game_keys ORDER BY id',
      ) as { status: string; updated_at: string }[];

      expect(filas.length).toBe(3);

      for (const fila of filas) {
        expect(fila.status).toBe(KeyStatus.Gifted);

        // Este es el fallo que se cuela: si `updated_at` comparte el bind con
        // `status`, la columna acaba guardando `gifted` y la clave queda con
        // una fecha de modificacion que no existe.
        expect(fila.updated_at).toMatch(ES_SELLO);
      }
    } finally {
      limpiar();
    }
  });

  test('deja fuera las claves que no estan en la lista', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.importRows([
        fila('AAAA-1111-AAAA'),
        fila('BBBB-2222-BBBB'),
        fila('CCCC-3333-CCCC'),
      ]);

      await repo.setStatusMany([1, 3], KeyStatus.Redeemed);

      const estados = leer('SELECT id, status FROM game_keys ORDER BY id') as {
        id: number;
        status: string;
      }[];

      expect(estados.map((fila) => fila.status)).toEqual([
        KeyStatus.Redeemed,
        KeyStatus.Available,
        KeyStatus.Redeemed,
      ]);
    } finally {
      limpiar();
    }
  });

  test('una lista vacia no toca nada', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.importRows([fila('AAAA-1111-AAAA')]);
      const antes = leer('SELECT updated_at FROM game_keys') as { updated_at: string }[];

      await repo.setStatusMany([], KeyStatus.Gifted);

      const despues = leer('SELECT updated_at FROM game_keys') as { updated_at: string }[];

      expect(despues).toEqual(antes);
    } finally {
      limpiar();
    }
  });
});

describe('regalar varias claves a la vez', () => {
  // Aqui no hay tests de `giftMany` a proposito, y el motivo merece explicarse
  // porque es justo la trampa que hace escribir un test que miente.
  //
  // `giftMany` arma un `CASE` con un destinatario por clave. Para eso la
  // sentencia necesita marcadores `$1`, `$2`... numerados, que es lo que habla
  // el motor de verdad: sqlx, en Rust.
  //
  // Pero `bun:sqlite` **cuenta esos marcadores mal**. Con seis marcadores
  // numerados distintos y siete valores responde `expected 6 values, received
  // 7`; y cuando el numero si coincide, enlaza los valores al reves y actualiza
  // cero filas sin decir nada. Se comprobo aislando el SQL.
  //
  // Un test aqui, entonces, no comprobaria el codigo: comprobaria que
  // `bun:sqlite` se equivoca. Pasaria con el bug puesto y fallaria con el
  // codigo bien, que es peor que no tener ninguno.
  //
  // Lo que si es comprobable son los indices, y se comprueba mas abajo en
  // `sql.helper.spec.ts`: esa es la parte que falla en silencio de verdad, y la
  // que motivo los errores de `setStatusMany` y `setTagsMany`.
});

describe('el estado y la plataforma por defecto', () => {
  test('una clave nueva nace con la plataforma declarada en el enum', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      const creada = await repo.insert({ title: 'Half Life', keyValue: 'aaaa-1111-aaaa' });

      const filas = leer('SELECT platform, status FROM game_keys') as {
        platform: string;
        status: string;
      }[];

      expect(creada.platform).toBe(KeyPlatform.Steam);
      expect(filas[0]?.platform).toBe(KeyPlatform.Steam);
      expect(filas[0]?.status).toBe(KeyStatus.Available);
    } finally {
      limpiar();
    }
  });

  test('el sello de actualizacion es una fecha, no el estado', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.importRows([fila('AAAA-1111-AAAA')]);
      await repo.setStatus(1, KeyStatus.Redeemed);

      const filas = leer('SELECT updated_at FROM game_keys') as { updated_at: string }[];

      expect(filas[0]?.updated_at).toMatch(ES_SELLO);
    } finally {
      limpiar();
    }
  });

  test('cambiar las etiquetas a la vez tampoco rompe el sello', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.importRows([fila('AAAA-1111-AAAA'), fila('BBBB-2222-BBBB')]);
      await repo.setTagsMany([1, 2], ['regalo', 'verano']);

      const filas = leer('SELECT tags, updated_at FROM game_keys ORDER BY id') as {
        tags: string;
        updated_at: string;
      }[];

      expect(filas.map((fila) => fila.tags)).toEqual(['regalo,verano', 'regalo,verano']);
      expect(filas[0]?.updated_at).toMatch(ES_SELLO);
    } finally {
      limpiar();
    }
  });
});

describe('dar de alta una clave', () => {
  test('cada valor cae en su columna', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.insert({
        ...fila('DDDD-4444-DDDD'),
        title: 'Half-Life 2',
        note: 'para el amigo',
        tags: ['regalo', 'verano'],
        giftedTo: 'Marta',
      });

      const guardada = leer(
        'SELECT * FROM game_keys',
      ) as Record<string, unknown>[];

      expect(guardada.length).toBe(1);

      const filaGuardada = guardada[0]!;

      // Cada columna con su valor, uno a uno. El fallo que esto caza es el
      // desplazamiento: si la lista de columnas y la de valores no tienen la
      // misma longitud, SQLite acepta la sentencia y escribe cada dato en la
      // columna de al lado sin decir nada.
      expect(filaGuardada.title).toBe('Half-Life 2');
      expect(filaGuardada.key_value).toBe('DDDD-4444-DDDD');
      expect(filaGuardada.platform).toBe(KeyPlatform.Steam);
      expect(filaGuardada.status).toBe(KeyStatus.Available);
      expect(filaGuardada.source).toBe(KeySource.Manual);
      expect(filaGuardada.gifted_to).toBe('Marta');
      expect(filaGuardada.note).toBe('para el amigo');
      expect(filaGuardada.tags).toBe('regalo,verano');

      // Esta la escriben las tres rutas de alta con `null`: la columna acepta
      // nulo y una clave nueva no tiene fecha de ultimo uso. Antes las dos
      // primeras no laaban en la sentencia, asi que dependia de que el valor
      // por defecto de la tabla fuera el correcto.
      expect(filaGuardada.last_used_at).toBeNull();
      expect(filaGuardada.added_on).toBeNull();

      expect(String(filaGuardada.created_at)).toMatch(ES_SELLO);
      expect(String(filaGuardada.updated_at)).toMatch(ES_SELLO);
    } finally {
      limpiar();
    }
  });

  test('la clave se guarda normalizada, con espacios y en mayusculas', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
        // `fila()` es una `IImportRow`, que lleva las etiquetas ya en texto. El
        // alta es una `IGameKeyInput`, y ahi son una lista.
        await repo.insert({ ...fila('  eeee-5555-eeee '), tags: [] });

      expect(
        (leer('SELECT key_value FROM game_keys')[0] as { key_value: string }).key_value,
      ).toBe('EEEE-5555-EEEE');
    } finally {
      limpiar();
    }
  });
});

describe('el catalogo de etiquetas vive en la base de datos', () => {
  test('las etiquetas que ya usan las claves entran solas en el catalogo', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['contexto', 'dlc'] });
      await repo.insert({ ...fila('BBBB-2222-BBBB'), tags: ['contexto'] });

      // Nadie ha pedido todavia el catalogo: las claves ya estaban ahi.
      expect(await repo.syncTagsFromKeys(await repo.listAll())).toBe(2);
      expect(leer('SELECT nombre FROM tags ORDER BY nombre')).toEqual([
        { nombre: 'contexto' },
        { nombre: 'dlc' },
      ]);
    } finally {
      limpiar();
    }
  });

  test('sincronizar dos veces no duplica nada', async () => {
    const { repo, limpiar } = crearRepositorio();

    try {
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['contexto'] });

      expect(await repo.syncTagsFromKeys(await repo.listAll())).toBe(1);
      expect(await repo.syncTagsFromKeys(await repo.listAll())).toBe(0);
    } finally {
      limpiar();
    }
  });

  test('una etiqueta nueva se puede anadir aunque no la use ninguna clave', async () => {
    const { repo, limpiar } = crearRepositorio();

    try {
      await repo.createTag('promo invierno');

      // `color` viene siempre, aunque este: una etiqueta sin tono elegido se
      // guarda con la cadena vacia, no con `null`, y el tipo lo dice —si
      // faltara, el sitio que la lee tendria que inventarse el valor.
      expect(await repo.listTags()).toEqual([
        { nombre: 'promo invierno', color: '' },
      ]);
    } finally {
      limpiar();
    }
  });

  test('anadir dos veces la misma etiqueta no la duplica', async () => {
    const { repo, limpiar } = crearRepositorio();

    try {
      await repo.createTag('dlc');
      await repo.createTag('dlc');

      expect(await repo.listTags()).toEqual([{ nombre: 'dlc', color: '' }]);
    } finally {
      limpiar();
    }
  });

  test('quitar una etiqueta la borra del catalogo y de las claves que la llevan', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['contexto', 'dlc'] });
      await repo.insert({ ...fila('BBBB-2222-BBBB'), tags: ['contexto'] });
      await repo.insert({ ...fila('CCCC-3333-CCCC'), tags: ['dlc'] });

      // El catalogo se llena al leerlo, no al insertar: por eso la app sincroniza
      // antes de enseñar la lista.
      await repo.syncTagsFromKeys(await repo.listAll());

      expect(await repo.deleteTag('dlc')).toBe(2);

      const claves = leer('SELECT tags FROM game_keys ORDER BY key_value') as {
        tags: string;
      }[];

      expect(claves.map((c) => c.tags)).toEqual(['contexto', 'contexto', '']);
      expect(leer('SELECT nombre FROM tags')).toEqual([{ nombre: 'contexto' }]);
    } finally {
      limpiar();
    }
  });

  test('quitar una etiqueta no toca las que se le parecen', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      // El `LIKE` con comas es lo que separa esto de un `LIKE` normal: sin
      // los delimitadores, quitar «dlc» tambien se llevaria «dlc-extra».
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['dlc', 'dlc-extra'] });

      expect(await repo.deleteTag('dlc')).toBe(1);
      expect(leer('SELECT tags FROM game_keys')[0]).toEqual({ tags: 'dlc-extra' });
    } finally {
      limpiar();
    }
  });

  test('quitar una etiqueta que no existe no cambia nada', async () => {
    const { repo, limpiar } = crearRepositorio();

    try {
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['contexto'] });

      expect(await repo.deleteTag('nada')).toBe(0);
    } finally {
      limpiar();
    }
  });
});

describe('renombrar una etiqueta propaga a toda la coleccion', () => {
  test('el nombre nuevo se escribe en las claves que la llevaban', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['humble', 'dlc'] });
      await repo.insert({ ...fila('BBBB-2222-BBBB'), tags: ['humble'] });

      await repo.syncTagsFromKeys(await repo.listAll());

      expect(await repo.renameTag('humble', 'humble bundle')).toBe(2);

      const claves = leer('SELECT tags FROM game_keys ORDER BY key_value') as {
        tags: string;
      }[];

      expect(claves.map((c) => c.tags)).toEqual(['dlc,humble bundle', 'humble bundle']);

      // El renombrado mueve una etiqueta, no las demas: «dlc» sigue en el
      // catalogo con el nombre que tenia y con las mismas claves usandola.
      expect(leer('SELECT nombre FROM tags ORDER BY nombre')).toEqual([
        { nombre: 'dlc' },
        { nombre: 'humble bundle' },
      ]);
    } finally {
      limpiar();
    }
  });

  test('renombrar no se lleva las etiquetas que se le parecen', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      // Los delimitadores son lo unico que separa esto de un replace a pelo:
      // sin ellos, «dlc» arrastraria «dlc-extra» y las dos claves que hay
      // acabarian con el mismo texto.
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['dlc', 'dlc-extra'] });
      await repo.insert({ ...fila('BBBB-2222-BBBB'), tags: ['dlc'] });

      expect(await repo.renameTag('dlc', 'descuento')).toBe(2);
      expect(leer('SELECT tags FROM game_keys ORDER BY key_value')).toEqual([
        { tags: 'dlc-extra,descuento' },
        { tags: 'descuento' },
      ]);
    } finally {
      limpiar();
    }
  });

  test('la etiqueta vieja desaparece del catalogo', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['contexto'] });
      await repo.syncTagsFromKeys(await repo.listAll());

      await repo.renameTag('contexto', 'a contexto');

      expect(leer('SELECT nombre FROM tags')).toEqual([{ nombre: 'a contexto' }]);
    } finally {
      limpiar();
    }
  });

  test('renombrar a un nombre que ya existe fusiona en vez de duplicar', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['dlc'] });
      await repo.insert({ ...fila('BBBB-2222-BBBB'), tags: ['extra'] });

      // Es lo que pasa al escribir «Humble» un dia y «humble» otro: dos
      // nombres para lo mismo. Fusionados quedan una sola etiqueta y las dos
      // claves con ella.
      expect(await repo.renameTag('extra', 'dlc')).toBe(1);
      expect(leer('SELECT nombre FROM tags ORDER BY nombre')).toEqual([
        { nombre: 'dlc' },
      ]);
      expect(leer('SELECT tags FROM game_keys ORDER BY key_value')).toEqual([
        { tags: 'dlc' },
        { tags: 'dlc' },
      ]);
    } finally {
      limpiar();
    }
  });

  test('una clave que llevaba las dos no se queda con el nombre repetido', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['dlc', 'extra'] });

      expect(await repo.renameTag('extra', 'dlc')).toBe(1);
      expect(leer('SELECT tags FROM game_keys')).toEqual([{ tags: 'dlc' }]);
    } finally {
      limpiar();
    }
  });

  test('una etiqueta que no existe no cambia nada', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['contexto'] });

      expect(await repo.renameTag('nada', 'otra cosa')).toBe(0);
      expect(leer('SELECT tags FROM game_keys')).toEqual([{ tags: 'contexto' }]);
    } finally {
      limpiar();
    }
  });

  test('quitar una etiqueta no toca las claves con la misma combinacion', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      // Las dos claves tienen exactamente el mismo texto en la columna. Un
      // borrado que filtrara por el texto —y no por id— reescribiria las dos,
      // y la que no llevaba «humble» perderia una etiqueta que no era suya.
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['humble', 'dlc'] });
      await repo.insert({ ...fila('BBBB-2222-BBBB'), tags: ['humble', 'dlc'] });
      await repo.insert({ ...fila('CCCC-3333-CCCC'), tags: ['dlc'] });

      expect(await repo.deleteTag('humble')).toBe(2);
      expect(leer('SELECT tags FROM game_keys ORDER BY key_value')).toEqual([
        { tags: 'dlc' },
        { tags: 'dlc' },
        { tags: 'dlc' },
      ]);
    } finally {
      limpiar();
    }
  });
});

/** Fila de importacion minima, con el estado ya disponible. */
function fila(keyValue: string) {
  return {
    title: 'Juego de prueba',
    keyValue,
    platform: KeyPlatform.Steam,
    status: KeyStatus.Available,
    source: KeySource.Manual,
    giftedTo: null,
    parentTitle: null,
    note: null,
    tags: '',
    addedOn: null,
  };
}
/**
 * El nombre del catalogo es el **normalizado**, y de eso depende que los botones
 * hagan algo.
 *
 * Quien borra, quien renombra y quien cambia el color pasan siempre el nombre
 * por `normalizeTag`, que lo deja en minusculas. El catalogo, en cambio, se
 * llenaba con el nombre tal cual estaba escrito en la columna de texto de la
 * clave. Con una clave etiquetada «Cumplidos,2025» el catalogo guardaba
 * `Cumplidos` y no `cumplidos`, asi que:
 *
 * - el boton de borrar no borraba la fila del catalogo —`=` no distingue— pero
 *   si quitaba la etiqueta de las claves, porque `LIKE` si distingue sin caja;
 * - el renombrado no renombraba nada, creaba la etiqueta nueva y dejaba la
 *   vieja suelta para siempre;
 * - y el color no se guardaba nunca.
 *
 * Todo eso sin un error: las consultas se ejecutaban y afectaban a cero filas.
 */
describe('el nombre del catalogo es el normalizado', () => {
  test('una etiqueta escrita con mayusculas se guarda en minusculas', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['Cumplidos', '2025'] });
      await repo.syncTagsFromKeys(await repo.listAll());

      expect(leer('SELECT nombre FROM tags ORDER BY nombre')).toEqual([
        { nombre: '2025' },
        { nombre: 'cumplidos' },
      ]);
    } finally {
      limpiar();
    }
  });

  test('el color se guarda aunque el nombre venga con mayusculas', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      // Se escribe a mano en la base, como una coleccion que ya tendria.
      await repo.createTag('Cumplidos');
      await repo.setTagColor('cumplidos', 'danger');

      expect(leer('SELECT nombre, color FROM tags')).toEqual([
        { nombre: 'Cumplidos', color: 'danger' },
      ]);
    } finally {
      limpiar();
    }
  });

  test('sincronizar pliega la fila con mayusculas y conserva su color', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['Cumplidos'] });
      await repo.createTag('Cumplidos');
      await repo.setTagColor('cumplidos', 'warn');

      await repo.syncTagsFromKeys(await repo.listAll());

      // Una sola fila, en minusculas y **con el color que ya tenia**.
      expect(leer('SELECT nombre, color FROM tags')).toEqual([
        { nombre: 'cumplidos', color: 'warn' },
      ]);
    } finally {
      limpiar();
    }
  });

  test('si estan las dos, se queda la del nombre normalizado', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.insert({ ...fila('AAAA-1111-AAAA'), tags: ['Cumplidos'] });
      await repo.createTag('Cumplidos');
      await repo.createTag('cumplidos');

      await repo.syncTagsFromKeys(await repo.listAll());

      expect(leer('SELECT nombre FROM tags')).toEqual([{ nombre: 'cumplidos' }]);
    } finally {
      limpiar();
    }
  });

  test('borrar y renombrar encuentran la fila con mayusculas', async () => {
    const { repo, leer, limpiar } = crearRepositorio();

    try {
      await repo.createTag('Cumplidos');

      expect(await repo.renameTag('cumplidos', 'cumplido')).toBe(0);
      expect(leer('SELECT nombre FROM tags')).toEqual([{ nombre: 'cumplido' }]);

      expect(await repo.deleteTag('cumplido')).toBe(0);
      expect(leer('SELECT nombre FROM tags')).toEqual([]);
    } finally {
      limpiar();
    }
  });
});

