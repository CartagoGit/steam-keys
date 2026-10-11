import { formatFileStamp } from '@/helpers/format-date.helper';
import { MAX_BACKUPS, GAME_KEY_COLUMNS, TABLE_BACKUPS, TABLE_GAME_KEYS, type BackupReason, type IBackup, type IDatabaseClient, type IGameKeyRow } from '@/contracts';

import { readBackupReason } from '@/helpers/settings.helper';
/**
 * Copias de seguridad guardadas dentro de la propia base de datos.
 *
 * Antes eran ficheros sueltos en una carpeta `backups/` y todo el trabajo lo
 * hacia Rust con `create_backup`, `list_backups` y `stage_backup`. Ahora son
 * filas de la tabla `backups`, asi que casi todo esto es SQL y lo puede hacer
 * el mismo `IDatabaseClient` que ya existe, sin un solo comando nuevo de Rust.
 *
 * Lo que se guarda son **las filas** de `game_keys`, no el fichero entero. Es
 * lo unico que hace que esto no se dispare de tamano: si cada copia guardase el
 * `.db` completo, incluiria las copias anteriores y con diez copias se pasaria
 * de 156 KB a 156 MB.
 */

const SELECCION = 'nombre, reason, creado_ms, contenido';

/** Borra una copia por su nombre. La rotacion y el borrado manual, lo mismo. */
const BORRAR_POR_NOMBRE = `DELETE FROM ${TABLE_BACKUPS} WHERE nombre = $1`;

/** Una fila de la tabla `backups`, tal y como la devuelve SQL. */
interface IBackupRow {
  nombre: string;
  reason: string;
  creado_ms: number;
  contenido: string;
}

/** Lo que se guarda de cada clave en una copia. */
interface ISnapshot {
  /** Cuantas claves hay. Va aqui para no recorrer el JSON en cada listado. */
  rowCount: number;
  rows: IGameKeyRow[];
}

/**
 * Marca de tiempo compacta para el nombre de la copia.
 *
 * El nombre lleva la fecha al principio para que se ordene a ojo, pero el orden
 * de verdad del que se fia la rotacion es el de insercion: ver `rotate`.
 */
function etiqueta(ms: number): string {
  return formatFileStamp(new Date(ms));
}

/** Deja solo letras, digitos y guiones, para que el nombre sea un id seguro. */
function sanitize(reason: BackupReason): string {
  return reason
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

/**
 * Nombre unico de una copia.
 *
 * Dos copias en el mismo segundo no pueden compartir nombre. Se prueba con un
 * sufijo en vez de esperar un segundo, porque esperar seria dejar el backup en
 * el aire justo cuando el usuario esta haciendo otra cosa.
 */
async function nombreLibre(db: IDatabaseClient, base: string): Promise<string> {
  let sufijo = 1;

  for (;;) {
    const candidato = sufijo === 1 ? base : `${base}-${sufijo}`;

    const existente = await db.select<{ nombre: string }>(
      `SELECT nombre FROM ${TABLE_BACKUPS} WHERE nombre = $1`,
      [candidato],
    );

    if (existente.length === 0) return candidato;

    sufijo += 1;
  }
}

/** Lee todas las claves que hay ahora mismo. */
async function snapshot(db: IDatabaseClient): Promise<readonly IGameKeyRow[]> {
  return db.select<IGameKeyRow>(`SELECT ${GAME_KEY_COLUMNS} FROM ${TABLE_GAME_KEYS}`);
}

/**
 * Numero de claves de una copia, sin deserializarla entera.
 *
 * Va en el propio JSON para no recorrerlo cada vez que se pinta la lista. Si el
 * JSON esta roto o es de otra version, se cae a `-1`: quien lo pinte sabe que
 * no lo sabe, en vez de ensenar un numero inventado.
 */
function leerConteo(contenido: string): number {
  try {
    const datos = JSON.parse(contenido) as Partial<ISnapshot>;

    if (typeof datos.rowCount === 'number') return datos.rowCount;
    if (Array.isArray(datos.rows)) return datos.rows.length;
  } catch {
    // JSON roto: mejor un "-1" que reventar el panel entero.
  }

  return -1;
}

/**
 * Copias de seguridad dentro de la base de datos.
 *
 * Todo pasa por `IDatabaseClient`, que es el mismo contrato que usan las claves.
 * Por eso funciona igual en la app de escritorio y en el puente de desarrollo,
 * sin ningun comando de Rust de por medio.
 */
export const backupRepository = {
  /**
   * Crea una copia y se queda solo con las `MAX_BACKUPS` mas recientes.
   *
   * Rotar va **despues** de insertar y no antes a proposito: si se borrase antes
   * y la escritura fallase, se habria perdido una copia sin tener ninguna nueva
   * en su lugar.
   */
  async create(db: IDatabaseClient, reason: BackupReason): Promise<IBackup> {
    const filas = await snapshot(db);
    const ahora = Date.now();

    const base = `steam-keys-${etiqueta(ahora)}-${sanitize(reason)}`;
    const nombre = await nombreLibre(db, base);

    const contenido = JSON.stringify({ rowCount: filas.length, rows: filas });

    await db.execute(
      `INSERT INTO ${TABLE_BACKUPS} (nombre, reason, creado_ms, contenido)
       VALUES ($1, $2, $3, $4)`,
      [nombre, reason, ahora, contenido],
    );

    await this.rotate(db);

    return {
      name: nombre,
      reason,
      createdAtMs: ahora,
      rowCount: filas.length,
      sizeBytes: contenido.length,
    };
  },

  /** Copias de la mas reciente a la mas antigua. */
  async list(db: IDatabaseClient): Promise<readonly IBackup[]> {
    const filas = await db.select<IBackupRow>(
      `SELECT ${SELECCION} FROM ${TABLE_BACKUPS} ORDER BY rowid DESC`,
    );

    return filas.map((fila) => ({
      name: fila.nombre,
      // La fila viene de SQL, donde `reason` es texto; el contrato pide el enum.
      // `readBackupReason` valida y cae a `manual` si la copia la creo una
      // version que usaba otro motivo.
      reason: readBackupReason(fila.reason),
      createdAtMs: fila.creado_ms,
      rowCount: leerConteo(fila.contenido),
      sizeBytes: fila.contenido.length,
    }));
  },

  /** Borra una copia concreta. */
  async remove(db: IDatabaseClient, name: string): Promise<void> {
    await db.execute(BORRAR_POR_NOMBRE, [name]);
  },

  /**
   * Filas de una copia, listas para `mergeKeysFromBackup`.
   *
   * Una copia corrupta devuelve una lista vacia en vez de reventar. Restaurar
   * una copia ilegible no hara nada, que es mejor que perder la coleccion
   * entera por no poder leer un historico.
   */
  async rowsOf(db: IDatabaseClient, name: string): Promise<readonly IGameKeyRow[]> {
    const filas = await db.select<Pick<IBackupRow, 'contenido'>>(
      `SELECT contenido FROM ${TABLE_BACKUPS} WHERE nombre = $1`,
      [name],
    );

    const crudo = filas[0]?.contenido;

    if (crudo === undefined) return [];

    try {
      const datos = JSON.parse(crudo) as Partial<ISnapshot>;

      return Array.isArray(datos?.rows) ? datos.rows : [];
    } catch {
      return [];
    }
  },

  /**
   * Deja solo las `MAX_BACKUPS` mas recientes.
   *
   * El orden es por `rowid`, que es el orden real de insercion, y **no** por
   * nombre ni por `creado_ms`. Por nombre no vale porque dos copias del mismo
   * segundo se distinguen con un sufijo, y en texto `copia-10` va antes que
   * `copia-9`: la rotacion borraria la copia equivocada. Por `creado_ms` tampoco,
   * porque dos copias pueden caer en el mismo milisegundo.
   *
   * @param limite Cuantas conservar. `MAX_BACKUPS` es lo que se queda la app;
   *   lo demas lo pasa quien rota a mano, que es el `backup:prune` de la
   *   terminal. El orden de borrado es el mismo en los dos casos.
   */
  async rotate(db: IDatabaseClient, limite: number = MAX_BACKUPS): Promise<void> {
    const sobrantes = await db.select<{ nombre: string }>(
      `SELECT nombre FROM ${TABLE_BACKUPS} ORDER BY rowid DESC LIMIT -1 OFFSET $1`,
      [limite],
    );

    for (const sobra of sobrantes) {
      await db.execute(BORRAR_POR_NOMBRE, [sobra.nombre]);
    }
  },
};

