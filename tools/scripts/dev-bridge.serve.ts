/**
 * Puente entre el servidor de desarrollo de Vite y la base de datos real.
 *
 * El problema que resuelve: dentro de Tauri la app abre SQLite con el plugin
 * nativo, pero cuando trabajas la interfaz en el navegador (`bun run dev`) no
 * hay plugin, asi que la app caia en un repositorio en memoria y se veia una
 * coleccion vacia en lugar de tus 403 claves reales.
 *
 * En vez de reimplementar el repositorio, este script **ejecuta SQL de verdad**
 * contra el mismo fichero SQLite que usa la app, y el cliente de HTTP se
 * limita a enviarle sentencias. Asi el unico codigo que escribe en la base de
 * datos sigue siendo `SqliteGameKeyRepository`.
 *
 * Uso interno, invocado por el middleware de Vite:
 *
 *   bun dev-bridge.serve.ts exec <json>   -> ejecuta una sentencia de escritura
 *   bun dev-bridge.serve.ts select <json> -> ejecuta una consulta
 *
 * Solo hay dos operaciones a proposito. Una tercera, de volcado masivo, se
 * descarto porque devolvia la tabla entera con las claves en claro: aqui no
 * existe ninguna forma de pedir "dame todo" sin pasar por una consulta, y las
 * consultas son las que escribe `SqliteGameKeyRepository`.
 *
 * Nunca se invoca desde la aplicacion: solo desde el servidor de desarrollo,
 * y solo en `bun run dev`. En el build de produccion no existe.
 */
import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { devDatabasePath } from './support/db-path.helper';
import { SCHEMA_STATEMENTS } from '@/contracts/constants/db-schema.constants';

/** Una sentencia que hay que ejecutar contra la base de datos. */
interface IPeticion {
  sql: string;
  binds?: unknown[];
}

/** Respuesta unificada, para que el middleware pueda reenviarla tal cual. */
interface IRespuesta {
  ok: boolean;
  rows?: unknown[];
  rowsAffected?: number;
  error?: string;
}

/** Lee el cuerpo de una peticion desde la entrada estandar. */
async function leerEntrada(): Promise<string> {
  if (process.stdin.isTTY) return '';

  const trozos: Buffer[] = [];

  for await (const trozo of Bun.stdin.stream()) {
    trozos.push(Buffer.from(trozo));
  }

  return Buffer.concat(trozos).toString('utf8');
}

/**
 * Ruta de la base de datos que usa el puente.
 *
 * `STEAM_KEYS_DB_PATH` permite apuntar a otra base de datos, y es lo que usan
 * los tests para no tocar la real.
 *
 * Sin esa variable **no** se usa `databasePath()`, que es la de la app de
 * escritorio. Antes si, y eso hacia que abrir la interfaz en el navegador
 * escribiera sobre la coleccion de verdad: un reset o una importacion a medias
 * desde el navegador se comian las claves, y de `dist/` no hay copia en git.
 * Ahora el navegador trabaja sobre `.dev/steam-keys-dev.db`, una base de datos
 * aparte con el mismo esquema.
 */
function rutaBaseDeDatos(): string {
  return devDatabasePath();
}

/** Abre la base de datos en solo lectura. */
function abrirLectura(): Database {
  const ruta = rutaBaseDeDatos();

  if (!existsSync(ruta)) {
    throw new Error(
      `No existe la base de datos de desarrollo: ${ruta}. ` +
        'Se crea sola en cuanto se escribe algo; si quieres verla con tus ' +
        'claves, arranca con STEAM_KEYS_DB_PATH=dist/steam-keys.db.',
    );
  }

  return new Database(ruta, { readonly: true });
}

/** Abre la base de datos en escritura, creando el esquema si hace falta. */
function abrirEscritura(): Database {
  const ruta = rutaBaseDeDatos();
  mkdirSync(dirname(ruta), { recursive: true });

  const db = new Database(ruta, { create: true });

  for (const sentencia of SCHEMA_STATEMENTS) db.run(sentencia);

  return db;
}

/** Parsea la peticion JSON que llega por la entrada estandar. */
function parsearPeticion(cuerpo: string): IPeticion {
  if (cuerpo.trim().length === 0) return { sql: '' };

  const datos = JSON.parse(cuerpo) as IPeticion;

  if (typeof datos.sql !== 'string' || datos.sql.length === 0) {
    throw new Error('La peticion debe incluir una sentencia SQL.');
  }

  return { sql: datos.sql, binds: datos.binds ?? [] };
}

function responder(respuesta: IRespuesta): void {
  process.stdout.write(JSON.stringify(respuesta));
}

async function principal(): Promise<void> {
  const operacion = process.argv[2] ?? '';

  try {
    switch (operacion) {
      // ------------------------------------------------------- ejecutar ---
      case 'exec': {
        const peticion = parsearPeticion(await leerEntrada());
        const db = abrirEscritura();

        try {
          const resultado = db.run(peticion.sql, (peticion.binds ?? []) as never[]);
          responder({ ok: true, rowsAffected: Number(resultado.changes) });
        } finally {
          db.close();
        }
        return;
      }

      // ------------------------------------------------------- consultar ---
      case 'select': {
        const peticion = parsearPeticion(await leerEntrada());
        const db = abrirLectura();

        try {
          const filas = db.query(peticion.sql).all(...(peticion.binds ?? [])) as unknown[];
          responder({ ok: true, rows: filas });
        } finally {
          db.close();
        }
        return;
      }

      default:
        responder({ ok: false, error: `Operacion desconocida: ${operacion}` });
        process.exitCode = 1;
    }
  } catch (error) {
    responder({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

await principal();

/** Reexportado para que el script se pueda importar en tests. */
export { abrirLectura, abrirEscritura, parsearPeticion };

/** Ruta esperada de la base de datos, util para diagnostico. */
export const RUTA_BD = devDatabasePath;

/** Directorio de este script, para localizar el repositorio. */
export const DIR_SCRIPT = dirname(join(import.meta.path));