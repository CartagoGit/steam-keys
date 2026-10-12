import { invoke } from '@tauri-apps/api/core';
import SqliteDatabase from '@tauri-apps/plugin-sql';

import { getDatabaseClient } from '@/repositories/repository.factory';
import {
  BackupReason,
  GAME_KEY_COLUMNS,
  TABLE_APP_SETTINGS,
  TABLE_BACKUPS,
  TABLE_GAME_KEYS,
  type IDatabaseClient,
  type IGameKeyRow,
} from '@/contracts';

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
        `SELECT ${GAME_KEY_COLUMNS} FROM ${TABLE_GAME_KEYS}`,
      );
    } finally {
      // Se cierra siempre: dejar conexiones abiertas bloquea el fichero, y el
      // temporal no se podria borrar. Y se cierra **diciendo cual es**: sin
      // argumento, `tauri-plugin-sql` cierra todos los pools, incluida la base
      // de datos principal que esta migracion esta usando para escribir.
      await copia.close(conexion).catch(() => undefined);
    }
  } finally {
    await invoke('discard_staged_backup').catch(() => undefined);
  }
}

/**
 * Trae las copias antiguas si no se han traído ya.
 *
 * Es lo que llama el arranque. La de mas abajo, que recibe la base por
 * parametro, se queda para quien ya la tenga a mano; esta resuelve por su
 * cuenta, y asi un componente no tiene que importar `repositories/` para
 * asking por ella —los componentes ven `contracts + helpers + services`,
 * y como se llega a la base es cosa de los servicios—.
 */
export async function migrateLegacyBackupsSiHaceFalta(): Promise<void> {
  const db = await getDatabaseClient();

  // El propio servicio marca «ya no hace falta hacerlo». Si ya esta marcado,
  // no se toca nada: es la senal de que esto ya corrio en un arranque
  // anterior.
  if (await legacyBackupsMigrated(db)) return;

  await migrateLegacyBackups(db);
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

  // Si una ejecucion anterior se quedo a mitad, dejo un temporal sin borrar al
  // lado del ejecutable. Se limpia antes de empezar, que aqui no hay nada que
  // perder todavia.
  await invoke('discard_staged_backup').catch(() => undefined);

  // Las que ya estan dentro no se vuelven a abrir. No es solo una otimizacion:
  // si alguna dejo de leerse en una pasada anterior, sin esto la app releeria
  // en cada arranque todas las copias antiguas para siempre, y son ficheros
  // enteros de base de datos.
  const yaDentro = await leerNombres(db);
  const pendientes = nombres.filter((nombre) => !yaDentro.has(nombre));

  let importadas = 0;
  let fallos = 0;

  for (const nombre of pendientes) {
    try {
      const filas = await leerFilas(nombre);

      if (filas.length === 0) continue;

      await db.execute(
        `INSERT OR IGNORE INTO ${TABLE_BACKUPS} (nombre, reason, creado_ms, contenido)
         VALUES ($1, $2, $3, $4)`,
        [
          nombre,
          BackupReason.TraidaDeArchivos,
          Date.now(),
          JSON.stringify({ rowCount: filas.length, rows: filas }),
        ],
      );

      importadas += 1;
    } catch {
      // Una copia que no se puede leer no debe impedir las demas. Se sigue con
      // la siguiente y la carpeta se queda intacta. No se anota el motivo: no
      // hay donde mirarlo, y escribir claves de diagnostico en los ajustes del
      // usuario solo deja basura. Como el nombre no llega a la tabla, el
      // siguiente arranque lo intentara otra vez por si el fichero estaba a
      // medias.
      fallos += 1;
    }
  }

  // Solo se marca como hecha si **todas** han entrado. Marcarlo con algunas
  // fallidas seria la peor opcion: no volverian a intentarse nunca y esas
  // copias se quedarian fuera para siempre sin que nadie se entere. Con
  // `INSERT OR IGNORE` volver a intentarlo es inofensivo.
  if (fallos === 0) {
    await marcarMigrada(db);
  }

  return importadas;
}

/** Nombres de las copias que ya estan en la base de datos. */
async function leerNombres(db: IDatabaseClient): Promise<Set<string>> {
  try {
    const filas = await db.select<{ nombre: string }>(`SELECT nombre FROM ${TABLE_BACKUPS}`);

    return new Set(filas.map((fila) => fila.nombre));
  } catch {
    // Sin tabla `backups` todavia —aun no se ha creado el esquema—: no hay nada
    // que dar por traido y se importa todo.
    return new Set();
  }
}

/** Deja constancia de que la migracion se hizo, para no repetirla. */
async function marcarMigrada(db: IDatabaseClient): Promise<void> {
  await db.execute(
    `INSERT INTO ${TABLE_APP_SETTINGS} (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [CLAVE_MIGRADA, '1'],
  );
}

/** `true` si la migracion ya se hizo, para no repetirla en cada arranque. */
export async function legacyBackupsMigrated(db: IDatabaseClient): Promise<boolean> {
  try {
    const filas = await db.select<{ value: string }>(
      `SELECT value FROM ${TABLE_APP_SETTINGS} WHERE key = $1`,
      [CLAVE_MIGRADA],
    );

    return filas[0]?.value === '1';
  } catch {
    // Si ni siquiera se puede leer la tabla, se considera que no se ha hecho:
    // migrar de mas no rompe nada, migrar de menos deja copias sin traer.
    return false;
  }
}