import { invoke } from '@tauri-apps/api/core';
import SqliteDatabase from '@tauri-apps/plugin-sql';

import { GAME_KEY_COLUMNS } from '@/helpers/map-row.helper';
import type { IDatabaseClient } from '@/contracts/interfaces/database.interface';
import type { IGameKeyRow } from '@/contracts/interfaces/import-summary.interface';

/**
 * Trae las copias de seguridad de la version anterior, que eran ficheros.
 *
 * Hasta hace poco las copias vivian en una carpeta `backups/` al lado del
 * ejecutable, cada una un `.db` completo. Ahora son filas de la tabla `backups`
 * de la propia base de datos, y con eso el programa pasa de mover tres ficheros
 * a mover dos.
 *
 * Quien actualice puede tener copias de las de antes. No se borran ni se tocan:
 * se **leen**, se sacan sus filas y se guardan en la tabla. Los ficheros se
 * quedan donde estaban, y si algo sale mal se puede volver a intentarlo. Borrar
 * ficheros del usuario es justo lo que esta app no hace nunca.
 */

/** Clave de ajustes que marca la migracion como hecha. */
const CLAVE_MIGRADA = 'backupsMigratedToDatabase';

/**
 * Lee las filas de una copia antigua, que es un `.db` aparte.
 *
 * No se puede leer desde Rust porque el plugin de SQL no expone su motor ahi, y
 * reimplementar un lector de SQLite seria absurdo. Lo que se hace es lo mismo
 * que hacia la restauracion antes: Rust deposita el fichero en un temporal y
 * devuelve su ruta, el plugin la abre con su motor, se leen las filas y se
 * guardan.
 *
 * El temporal se borra pase lo que pase. Y nunca se copia encima de la base de
 * datos viva, que tiene la conexion abierta y se quedaria con una referencia
 * obsoleta.
 */
async function leerFilas(nombre: string): Promise<readonly IGameKeyRow[]> {
  const conexion = await invoke<string>('stage_legacy_backup', { name: nombre });

  try {
    const copia = await SqliteDatabase.load(conexion);

    try {
      return await copia.select<IGameKeyRow[]>(
        `SELECT ${GAME_KEY_COLUMNS} FROM game_keys`,
      );
    } finally {
      // Se cierra siempre: dejar conexiones abiertas bloquea el fichero, y el
      // temporal no se podria borrar.
      await copia.close().catch(() => undefined);
    }
  } finally {
    await invoke('discard_staged_backup').catch(() => undefined);
  }
}

/**
 * Trae las copias antiguas a la base de datos.
 *
 * Devuelve cuantas se han importado. Si no hay nada que traer devuelve 0 y no
 * toca nada.
 *
 * `INSERT OR IGNORE` por nombre: si ya habia una copia con ese nombre, no se
 * pisa. Es lo que hace que se pueda volver a lanzar sin miedo.
 */
export async function migrateLegacyBackups(db: IDatabaseClient): Promise<number> {
  let nombres: string[];

  try {
    nombres = await invoke<string[]>('legacy_backups');
  } catch {
    // Sin comando, o sin carpeta: no hay nada que traer. No es un error.
    return 0;
  }

  if (nombres.length === 0) return 0;

  let importadas = 0;

  for (const nombre of nombres) {
    try {
      const filas = await leerFilas(nombre);

      if (filas.length === 0) continue;

      await db.execute(
        `INSERT OR IGNORE INTO backups (nombre, reason, creado_ms, contenido)
         VALUES ($1, $2, $3, $4)`,
        [
          nombre,
          'traida-de-archivos',
          Date.now(),
          JSON.stringify({ rowCount: filas.length, rows: filas }),
        ],
      );

      importadas += 1;
    } catch {
      // Una copia que no se puede leer no debe impedir las demas. Se sigue con
      // la siguiente, y la carpeta se queda intacta para otro dia.
    }
  }

  await marcarMigrada(db);

  return importadas;
}

/** Deja constancia de que la migracion se hizo, para no repetirla. */
async function marcarMigrada(db: IDatabaseClient): Promise<void> {
  await db.execute(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [CLAVE_MIGRADA, '1'],
  );
}

/** `true` si la migracion ya se hizo, para no repetirla en cada arranque. */
export async function legacyBackupsMigrated(db: IDatabaseClient): Promise<boolean> {
  try {
    const filas = await db.select<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = $1',
      [CLAVE_MIGRADA],
    );

    return filas[0]?.value === '1';
  } catch {
    // Si ni siquiera se puede leer la tabla, se considera que no se ha hecho:
    // migrar de mas no rompe nada, migrar de menos deja copias sin traer.
    return false;
  }
}