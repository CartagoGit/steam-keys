import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BunSqliteClient } from './bun-sqlite.client';
import { TABLE_TAGS } from '@/contracts';

/**
 * Tests del cliente de SQLite del puente.
 *
 * Lo que se comprueba aqui es una sola cosa, y es la que rompio sin que nadie
 * se enterara: **lo que devuelve `execute`**.
 *
 * `bun:sqlite` no devuelve un numero, devuelve `{ lastInsertRowid, changes }`.
 * El cliente lo declaraba como numero con un `as unknown as number`, que no
 * convierte nada: solo le dice al compilador que no mire. El repositorio
 * recibia un objeto donde esperaba un conteo, y en JavaScript un objeto
 * comparado con `> 0` se convierte a `"[object Object]"`, que es `NaN`.
 *
 * El sintoma era el mas dificil de leer que cabe en una app: `INSERT OR
 * IGNORE` devolvia `false` **siempre**, asi que crear una etiqueta anunciaba
 * «ya existe» y la creaba igualmente —el aviso y el resultado decian lo
 * contrario—, y `syncTagsFromKeys` sumaba un objeto, con lo que el contador de
 * filas nuevas salia en texto y el reinicio de la interfaz no se disparaba.
 *
 * Todo eso sin un error de tipos y sin un fallo visible: las escrituras ocurrian
 * de verdad, que es lo que lo hace pasar.
 */

/** Cliente sobre una base temporal, con el esquema ya desplegado. */
function cliente(): { db: BunSqliteClient; cerrar: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'steam-keys-puente-'));
  const db = new BunSqliteClient(join(dir, 'puente.db'));

  return {
    db,
    cerrar: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe('lo que devuelve execute', () => {
  test('es el numero de filas afectadas, no un objeto', async () => {
    const { db, cerrar } = cliente();

    try {
      const cambios = await db.execute(
        `INSERT OR IGNORE INTO ${TABLE_TAGS} (nombre, color) VALUES ($1, $2)`,
        ['dlc', ''],
      );

      // La asercion que importa no es el valor, es el **tipo**: un
      // `{changes: 1}` con truthy pasaria un `toBe(1)` mal escrito, pero haria
      // fallar cualquier `> 0`, que es como lo lee el repositorio.
      expect(typeof cambios).toBe('number');
      expect(cambios).toBe(1);
    } finally {
      cerrar();
    }
  });

  test('un INSERT OR IGNORE que no inserta da cero, y cero se puede comparar', async () => {
    const { db, cerrar } = cliente();

    try {
      await db.execute(
        `INSERT OR IGNORE INTO ${TABLE_TAGS} (nombre, color) VALUES ($1, $2)`,
        ['dlc', ''],
      );

      const repetida = await db.execute(
        `INSERT OR IGNORE INTO ${TABLE_TAGS} (nombre, color) VALUES ($1, $2)`,
        ['dlc', ''],
      );

      /*
       * Este es el caso que rompia la app: la etiqueta ya existia, asi que el
       * aviso de «ya existe» es lo correcto —pero solo si `execute` devuelve
       * algo comparable. Con el objeto de antes, `cambios > 0` era `NaN > 0`,
       * o sea `false`, y el aviso salia **también** al crear de verdad.
       */
      expect(repetida).toBe(0);
      expect(repetida > 0).toBe(false);
    } finally {
      cerrar();
    }
  });

  test('un UPDATE cuenta las filas que ha tocado', async () => {
    const { db, cerrar } = cliente();

    try {
      await db.execute(
        `INSERT INTO ${TABLE_TAGS} (nombre, color) VALUES ($1, $2)`,
        ['contexto', ''],
      );

      const tocadas = await db.execute(
        `UPDATE ${TABLE_TAGS} SET color = $1 WHERE nombre = $2`,
        ['#112233', 'contexto'],
      );

      expect(tocadas).toBe(1);
    } finally {
      cerrar();
    }
  });

  test('un UPDATE que no encuentra filas da cero', async () => {
    const { db, cerrar } = cliente();

    try {
      const tocadas = await db.execute(
        `UPDATE ${TABLE_TAGS} SET color = $1 WHERE nombre = $2`,
        ['#112233', 'nada'],
      );

      /*
       * `renameTag` compara contra cero para decidir si tiene que crear la
       * etiqueta nueva. Con un objeto, `=== 0` era siempre falso y esa rama
       * nunca se tomaba.
       */
      expect(tocadas).toBe(0);
    } finally {
      cerrar();
    }
  });
});