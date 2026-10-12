/**
 * Copias de seguridad de la base de datos, desde la terminal.
 *
 *   bun run backup:list
 *   bun run backup:now -- antes-de-importar
 *   bun run backup:prune -- 5
 *   bun run backup:restore -- steam-keys-20261010-153427-manual
 *   bun run backup:restore -- <nombre> sobrescribir
 *
 * Las copias son **filas de la tabla `backups`** de la propia base de datos, no
 * ficheros. Antes eran ficheros `.db` en una carpeta `backups/` al lado del
 * ejecutable y este script los gestionaba copiando ficheros. Con el cambio, esa
 * carpeta ya no es de la app: `bun run backup:now` dejaba un `.db` ahi que la
 * aplicacion, al arrancar, se llevaba por el camino de las copias antiguas —la
 * unica carpeta `backups/` que sigue viva es la de las de antes, y ahi no debe
 * escribir nada— y `backup:prune` podia borrar un fichero que la app nunca
 * habia leido.
 *
 * Asi que todo lo de aqui pasa por `backupRepository` y `backupService`, los
 * mismos que usa la interfaz. Una sola verdad: la terminal y la app ven las
 * mismas copias, y la rotacion borra en el mismo orden.
 *
 * Cierra la app antes de escribir: SQLite bloquea el fichero mientras la
 * aplicacion lo tiene abierto.
 */
import { existsSync } from 'node:fs';
import { Database } from 'bun:sqlite';

import { backupRepository } from '@/repositories/backup.repository';
import { backupService } from '@/services/backup.service';
import { readBackupReason } from '@/helpers/settings.helper';
import { formatBytes } from '@/helpers/format-bytes.helper';
import { formatDateTime } from '@/helpers/format-date.helper';
import {
  BACKUP_REASON_VALUES,
  BackupReason,
  DEFAULT_LOCALE,
  MAX_BACKUPS,
  RestoreMode,
  SCHEMA_STATEMENTS,
  type IDatabaseClient,
} from '@/contracts';
import { databasePath } from './support/db-path.helper';

const args = process.argv.slice(2);
const comando = args[0] ?? 'list';

const DB_PATH = databasePath();

if (!existsSync(DB_PATH)) {
  console.error(`No existe la base de datos: ${DB_PATH}`);
  console.error('Ejecuta primero "bun run import -- --force".');
  process.exit(1);
}

/**
 * El motor, sobre el contrato que espera el codigo de la app.
 *
 * Se adapta SQLite de Bun a `IDatabaseClient` en vez de abrir el fichero con
 * `tauri-plugin-sql`, que no existe fuera de la ventana. El repositorio que se
 * llama desde aqui no sabe nada de esto.
 */
function abrir(): { db: IDatabaseClient; cerrar: () => void } {
  // Sin `{ create: false }`: en Bun esa opcion solo vale para `:memory:` y
  // ponerla en un fichero da `SQLITE_MISUSE`. Como el fichero se ha
  // comprobado antes, abrirlo es crearlo o no, aqui no hay nada que crear.
  const sqlite = new Database(DB_PATH);

  // El esquema se aplica igual: `CREATE TABLE IF NOT EXISTS` no toca lo que hay
  // y asi el comando funciona sobre una base creada por una version anterior.
  for (const sentencia of SCHEMA_STATEMENTS) sqlite.run(sentencia);

  return {
    db: {
      async execute(sql, bind = []) {
        return Number(sqlite.run(sql, [...bind] as never[]).changes);
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
      // `bun:sqlite` habla el mismo dialecto, asi que la transaccion es la de
      // siempre. Se implementa aqui y no se importa porque este script corre
      // fuera de Vite: no puede depender del cliente de la app.
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
    },
    cerrar: () => sqlite.close(),
  };
}

/**
 * Motivo pedido en la terminal.
 *
 * Pasa por `readBackupReason`, el mismo lector que usan los ajustes y el
 * repositorio, para que un motivo desconocido caiga igual que en la app en vez
 * de guardarse escrito a mano. Pero aqui no se deja pasar: un motivo mal escrito
 * se guardaria como `manual` sin avisar, y quien lo escribio creeria que la
 * copia es de otro tipo.
 */
function motivoDe(argumento: string | undefined): BackupReason {
  if (argumento === undefined) return BackupReason.Manual;

  const motivo = readBackupReason(argumento);

  if (!BACKUP_REASON_VALUES.includes(motivo) || motivo !== argumento) {
    console.error(`Motivo desconocido: ${argumento}`);
    console.error('Valores:', BACKUP_REASON_VALUES.join(', '));
    process.exit(1);
  }

  return motivo;
}

async function listar(): Promise<void> {
  const { db, cerrar } = abrir();

  try {
    const copias = await backupRepository.list(db);

    console.log('Base de datos :', DB_PATH);
    console.log(`Copias (${copias.length}/${MAX_BACKUPS}):`);
    console.log('');

    if (copias.length === 0) {
      console.log('No hay copias de seguridad.');
      return;
    }

    for (const copia of copias) {
      console.log(
        `  ${copia.name.padEnd(46)} ${String(copia.rowCount).padStart(5)} claves  ` +
          `${formatBytes(copia.sizeBytes).padStart(9)}  ${formatDateTime(copia.createdAtMs, DEFAULT_LOCALE)}`,
      );
    }
  } finally {
    cerrar();
  }
}

async function crear(motivo: BackupReason): Promise<void> {
  const { db, cerrar } = abrir();

  try {
    const copia = await backupRepository.create(db, motivo);

    console.log('Copia creada :', copia.name);
    console.log('Motivo       :', copia.reason);
    console.log('Claves       :', copia.rowCount);
    console.log('Tamano       :', formatBytes(copia.sizeBytes));
  } finally {
    cerrar();
  }
}

async function rotar(limite: number): Promise<void> {
  const { db, cerrar } = abrir();

  try {
    const antes = (await backupRepository.list(db)).length;

    await backupRepository.rotate(db, limite);

    const despues = (await backupRepository.list(db)).length;

    console.log(`Copias: ${antes} -> ${despues}. Se conservan ${limite}.`);
  } finally {
    cerrar();
  }
}

async function restaurar(nombre: string, modo: RestoreMode): Promise<void> {
  const { db, cerrar } = abrir();

  try {
    const copia = (await backupRepository.list(db)).find((c) => c.name === nombre);

    if (copia === undefined) {
      console.error(`No hay ninguna copia llamada "${nombre}".`);
      console.error('Usa "bun run backup:list" para ver los nombres.');
      process.exit(1);
    }

    const resumen = await backupService.restore(db, nombre, modo);

    console.log(`Copia restaurada: ${nombre} (${modo})`);
    console.log('Insertadas      :', resumen.inserted);
    console.log('Actualizadas    :', resumen.updated);
    console.log('Sin cambios     :', resumen.skipped);
  } finally {
    cerrar();
  }
}

switch (comando) {
  case 'list':
    await listar();
    break;

  case 'now':
    await crear(motivoDe(args[1]));
    break;

  case 'prune': {
    const limite = Number(args[1] ?? MAX_BACKUPS);

    if (!Number.isInteger(limite) || limite < 1) {
      console.error('El limite debe ser un numero entero mayor que cero.');
      process.exit(1);
    }

    await rotar(limite);
    break;
  }

  case 'restore': {
    if (!args[1]) {
      console.error('Falta el nombre de la copia. Usa "bun run backup:list".');
      process.exit(1);
    }

    // El segundo argumento decide si la restauracion actualiza lo que ya hay o
    // solo anade lo que falta. Por defecto solo anade: es lo seguro, y es lo
    // que hace el boton de la interfaz.
    const modo =
      args[2] === 'sobrescribir' ? RestoreMode.Sobrescribir : RestoreMode.Fusionar;

    await restaurar(args[1], modo);
    break;
  }

  default:
    console.error(`Comando desconocido: ${comando}`);
    console.error('Disponibles: list, now, prune, restore');
    process.exit(1);
}
