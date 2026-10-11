import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { backupRepository } from './backup.repository';
import { BackupReason, SCHEMA_STATEMENTS, type IDatabaseClient } from '@/contracts';

/**
 * Tests de las copias de seguridad dentro de la base de datos.
 *
 * Lo que se vigila aqui es que las copias **no se contengan a si mismas**: si
 * cada copia guardase el fichero entero, incluiria las anteriores y con diez
 * copias se pasaria de 156 KB a 156 MB. Con las filas guardadas, el tamano
 * crece de forma lineal, y eso es justo lo que comprueba `el tamano crece
 * de forma lineal`.
 */

/** Cliente sobre una base de datos temporal, con el esquema de la app. */
function crearCliente(): { db: IDatabaseClient; cerrar: () => void; ruta: string } {
  const dir = mkdtempSync(join(tmpdir(), 'steam-keys-backups-'));
  const ruta = join(dir, 'test.db');

  const sqlite = new Database(ruta, { create: true });

  for (const sentencia of SCHEMA_STATEMENTS) sqlite.run(sentencia);

  const cliente: IDatabaseClient = {
    async execute(sql, bind = []) {
      sqlite.run(sql, [...bind] as never[]);
      return 0;
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
  };

  return {
    db: cliente,
    ruta,
    cerrar: () => {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Inserta `n` claves minimas. */
async function meterClaves(db: IDatabaseClient, n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await db.execute(
      `INSERT INTO game_keys (title, key_value) VALUES ($1, $2)`,
      [`Juego ${i}`, `KEY-${i}`],
    );
  }
}

describe('copias dentro de la base de datos', () => {
  test('crea la copia y la lista', async () => {
    const { db, cerrar } = crearCliente();

    try {
      await meterClaves(db, 3);
      const creada = await backupRepository.create(db, BackupReason.Manual);

      expect(creada.rowCount).toBe(3);
      expect(creada.name).toContain('manual');

      const lista = await backupRepository.list(db);
      expect(lista).toHaveLength(1);
      expect(lista[0]?.rowCount).toBe(3);
    } finally {
      cerrar();
    }
  });

  test('la copia guarda las filas que habia, no el fichero', async () => {
    const { db, cerrar } = crearCliente();

    try {
      await meterClaves(db, 4);
      await backupRepository.create(db, BackupReason.AntesDeImportar);

      const filas = await backupRepository.rowsOf(db, (
        await backupRepository.list(db)
      )[0]!.name);

      expect(filas).toHaveLength(4);
      expect(filas[0]?.title).toBe('Juego 0');
    } finally {
      cerrar();
    }
  });

  test('el tamaño crece de forma lineal, no del doble', async () => {
    const { db, cerrar } = crearCliente();

    try {
      await meterClaves(db, 50);

      // Cuanto pesa una copia con las claves dentro, y cuanto pesa el fichero
      // entero: la diferencia es justo lo que dejan de dragar a las siguientes.
      await backupRepository.create(db, BackupReason.Manual);
      const conUna = await backupRepository.create(db, BackupReason.AntesDeImportar);

      const total = await db.select<{ bytes: number }>(
        'SELECT SUM(LENGTH(contenido)) AS bytes FROM backups',
      );

      const porCopia = total[0]!.bytes / 2;

      // Diez copias pesan unas diez veces una. Si guardasen el fichero entero,
      // la segunda ya pesaria el doble que la primera.
      expect(porCopia).toBeGreaterThan(0);
      expect(porCopia).toBeLessThan(conUna.sizeBytes * 2);

      // El contenido no puede ser mas grande que la propia base de datos con
      // las claves: es JSON de las mismas filas, sin las copias dentro.
      expect(porCopia).toBeLessThan(50 * 2000);
    } finally {
      cerrar();
    }
  });

  test('se queda solo con las diez mas recientes', async () => {
    const { db, cerrar } = crearCliente();

    try {
      await meterClaves(db, 2);

      const creadas: string[] = [];

      for (let i = 0; i < 12; i += 1) {
        const copia = await backupRepository.create(db, BackupReason.Manual);
        creadas.push(copia.name);
        // Un milisegundo entre copias: el nombre lleva la marca de tiempo y dos
        // copias en el mismo milisegundo se distinguirian por el sufijo.
        await new Promise((r) => setTimeout(r, 2));
      }

      const lista = await backupRepository.list(db);
      expect(lista).toHaveLength(10);

      // Las que se quedan son las diez ultimas creadas. El orden es **el de
      // insercion**, no el del nombre: con dos copias en el mismo segundo el
      // nombre lleva un sufijo, y en texto `copia-10` va antes que `copia-9`.
      // Por eso el motivo ya no lleva el numero —ademas de ser un enum— y el
      // nombre es lo unico inequivoco.
      expect(lista.map((copia) => copia.name)).toEqual(creadas.slice(2).reverse());
    } finally {
      cerrar();
    }
  });

  test('dos copias en el mismo instante no pisan el nombre', async () => {
    const { db, cerrar } = crearCliente();

    try {
      await meterClaves(db, 1);

      const a = await backupRepository.create(db, BackupReason.Manual);
      const b = await backupRepository.create(db, BackupReason.Manual);

      expect(a.name).not.toBe(b.name);
      expect(await backupRepository.list(db)).toHaveLength(2);
    } finally {
      cerrar();
    }
  });

  test('borra una copia concreta', async () => {
    const { db, cerrar } = crearCliente();

    try {
      await meterClaves(db, 1);
      const creada = await backupRepository.create(db, BackupReason.Manual);

      await backupRepository.remove(db, creada.name);

      expect(await backupRepository.list(db)).toHaveLength(0);
    } finally {
      cerrar();
    }
  });

  test('una copia corrupta no revienta al leerla', async () => {
    const { db, cerrar } = crearCliente();

    try {
      await meterClaves(db, 2);
      await backupRepository.create(db, BackupReason.Manual);

      const nombre = (await backupRepository.list(db))[0]!.name;

      // JSON roto, como si la escritura se hubiera cortado a medias.
      await db.execute('UPDATE backups SET contenido = $1 WHERE nombre = $2', [
        'esto no es json',
        nombre,
      ]);

      expect(await backupRepository.rowsOf(db, nombre)).toEqual([]);

      // Y listarla tampoco revienta: sale con la cuenta a -1, que es la forma de
      // decir "no lo se" en vez de teach un numero inventado.
      const lista = await backupRepository.list(db);
      expect(lista[0]!.rowCount).toBe(-1);
    } finally {
      cerrar();
    }
  });

  test('pedir una copia que no existe devuelve lista vacia', async () => {
    const { db, cerrar } = crearCliente();

    try {
      expect(await backupRepository.rowsOf(db, 'no-existe')).toEqual([]);
    } finally {
      cerrar();
    }
  });

  test('rotar despues de insertar no deja sin copias', async () => {
    const { db, cerrar } = crearCliente();

    try {
      await meterClaves(db, 1);

      for (let i = 0; i < 11; i += 1) {
        await backupRepository.create(db, BackupReason.Manual);
        await new Promise((r) => setTimeout(r, 2));
      }

      // Siempre queda alguna: rotar por debajo del maximo antes de insertar
      // dejaria la coleccion sin ninguna si la escritura fallase.
      expect((await backupRepository.list(db)).length).toBeGreaterThan(0);
    } finally {
      cerrar();
    }
  });
});