/**
 * Exporta la base de datos a un TXT con el formato original.
 *
 *   bun run export -- steam-keys.txt
 *
 * Por defecto escribe en `build/steam-keys-export.txt`, que esta ignorado por
 * git. El fichero contiene claves reales: tratalo como el TXT original.
 */
import { existsSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';

import { exportKeysToLegacyTxt } from '@/helpers/export-legacy-txt.helper';
import { mapRowToGameKey } from '@/helpers/map-row.helper';
import { GAME_KEY_COLUMNS, TABLE_GAME_KEYS, type IGameKey, type IGameKeyRow } from '@/contracts';
import { databasePath } from './support/db-path.helper';

const DB_PATH = databasePath();
const args = process.argv.slice(2);

if (!existsSync(DB_PATH)) {
  console.error(`No existe la base de datos: ${DB_PATH}`);
  console.error('Ejecuta primero "bun run import -- --force".');
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

// La lista de columnas y el paso de fila a clave son los de la app, no una copia
// de aqui. Este script estaba escribiendo su propio `SELECT` y su propio mapeo
// campo a campo, y por eso exportar podia perder lo que la app si guardaba: una
// columna nueva se anadia al repositorio y aqui se seguia escribiendo el mismo
// `SELECT` de antes, sin avisar.
const rows = db
  .query<IGameKeyRow, []>(
    `SELECT ${GAME_KEY_COLUMNS} FROM ${TABLE_GAME_KEYS}
      ORDER BY title COLLATE NOCASE ASC`,
  )
  .all();

const keys = rows.map(mapRowToGameKey);

const target = args[0] ?? join(import.meta.dir, '..', '..', 'build', 'steam-keys-export.txt');

mkdirSync(join(target, '..'), { recursive: true });
await Bun.write(target, exportKeysToLegacyTxt(keys));

db.close();

console.log(`Exportadas ${keys.length} claves a:`);
console.log(`  ${target}`);

export type { IGameKey };