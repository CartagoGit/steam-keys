/**
 * Importa el TXT original a la base de datos SQLite de la app.
 *
 *   bun run import           # simula y pregunta antes de escribir
 *   bun run import -- --dry-run
 *   bun run import -- --force
 *
 * Cierra la app antes de importar: SQLite bloquea el fichero mientras la
 * aplicacion lo tiene abierto.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';

import { parseLegacyTxt } from '@/helpers/parse-legacy-txt.helper';
import { maskKey } from '@/helpers/mask-key.helper';
import {
  keyFingerprint,
  normalizeKey,
  serializeTags,
} from '@/helpers/normalize-text.helper';
import {
  GAME_KEY_WRITE_COLUMNS,
  SCHEMA_STATEMENTS,
  TABLE_GAME_KEYS,
} from '@/contracts/constants/db-schema.constants';
import { KeySource } from '@/contracts/enums/key-source.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { databasePath } from './support/db-path.helper';

const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');
const dryRun = args.includes('--dry-run') || (!force && !args.includes('--yes'));

const TXT_PATH = join(import.meta.dir, '..', '..', 'original', 'steam-keys.txt');
const DB_PATH = databasePath();

/** Ruta de entrada indicada por el usuario, o el TXT original por defecto. */
const sourcePath = args.find((arg) => !arg.startsWith('-')) ?? TXT_PATH;

/** Lee el TXT de entrada. */
async function readSource(): Promise<string> {
  if (!existsSync(sourcePath)) {
    throw new Error(`No existe el fichero de entrada: ${sourcePath}`);
  }

  return Bun.file(sourcePath).text();
}

/** Abre (o crea) la base de datos con el esquema de la app. */
function openDatabase(): Database {
  mkdirSync(join(DB_PATH, '..'), { recursive: true });

  const db = new Database(DB_PATH, { create: true });
  for (const statement of SCHEMA_STATEMENTS) db.run(statement);

  return db;
}

const raw = await readSource();
const db = openDatabase();

const existingRows = db.query<{ key_value: string }, []>(`SELECT key_value FROM ${TABLE_GAME_KEYS}`).all();
const existing = new Set(existingRows.map((row) => keyFingerprint(row.key_value)));

// Se parsea **sin** filtrar por lo que hay en la base y se reparte aqui. Antes
// se le pasaba `existingKeys` y el recuento salia contradictorio: con la base
// llena el script anunciava "Claves detectadas: 0" y a continuacion "duplicadas
// TXT: 472", que parece un fichero vacio con 472 lineas sin parsear. El motivo
// es que `entries` ya venia sin las que estaban en la base, y `duplicates`
// mezclaba dos cosas distintas —repetidas dentro del TXT y ya guardadas— sin
// decir cual era cual. Repartiendo aqui las dos se cuentan bien y se ve de
// verdad cuanto hay nuevo.
const parsed = parseLegacyTxt(raw);

// ---------------------------------------------------------------- simulacion --
const toInsert = parsed.entries.filter((entry) => !existing.has(keyFingerprint(entry.keyValue)));
const alreadyInDb = parsed.entries.length - toInsert.length;

console.log('=====================================================');
console.log(' Importacion de claves');
console.log('=====================================================');
console.log('Origen   :', sourcePath);
console.log('Base BD  :', DB_PATH);
console.log('');

console.log('Claves en el TXT     :', parsed.stats.parsedLines);
console.log('  a insertar       :', toInsert.length);
console.log('  ya en la base    :', alreadyInDb);
console.log('  repetidas TXT    :', parsed.stats.duplicates);
console.log('Lineas sin clave    :', parsed.stats.skippedLines);
console.log('Incidencias         :', parsed.issues.length);
console.log('');

const byPlatform = new Map<string, number>();
for (const entry of toInsert) {
  byPlatform.set(entry.platform, (byPlatform.get(entry.platform) ?? 0) + 1);
}
console.log('Por plataforma:');
for (const [platform, count] of [...byPlatform.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${platform.padEnd(20)} ${String(count).padStart(4)}`);
}
console.log('');

if (toInsert.length === 0) {
  console.log('No hay nada nuevo que importar.');
  db.close();
  process.exit(0);
}

console.log('Muestra (claves enmascaradas):');
for (const entry of toInsert.slice(0, 8)) {
  console.log(
    `  ${entry.title.slice(0, 44).padEnd(44)} ${maskKey(entry.keyValue, 2)}`,
  );
}
console.log('');

if (dryRun) {
  console.log('--- SIMULACION (no se ha escrito nada) ---');
  console.log('Ejecuta "bun run import -- --force" para escribir de verdad.');
  db.close();
  process.exit(0);
}

// ------------------------------------------------------------------- escritura --
// Las columnas salen de la lista del esquema, no de una copia escrita aqui. Es
// la misma lista que usa el `INSERT` de la app: si el esquema gana una columna
// y este script se queda con la suya, importa la fila con el valor por defecto y
// no dice nada. Los nombres van con `$` delante porque `bun:sqlite` los trata
// como parametros con nombre, que es lo que evita tener que numerarlos.
const insert = db.prepare(`
  INSERT OR IGNORE INTO ${TABLE_GAME_KEYS}
    (${GAME_KEY_WRITE_COLUMNS.join(', ')})
  VALUES
    ($title, $keyValue, $platform, $status, $source, $giftedTo, $parentTitle,
     $note, $tags, $addedOn, NULL, datetime('now'), datetime('now'))
`);

let inserted = 0;

db.transaction(() => {
  for (const entry of toInsert) {
    const result = insert.run({
      $title: entry.title,
      $keyValue: normalizeKey(entry.keyValue),
      $platform: entry.platform,
      $status: entry.status,
      $source: KeySource.LegacyTxt,
      $giftedTo: entry.giftedTo,
      $parentTitle: entry.parentTitle,
      $note: entry.note,
      $tags: serializeTags(entry.tags),
      $addedOn: entry.addedOn,
    });

    inserted += Number(result.changes);
  }
})();

const total = db.query<{ total: number }, []>(`SELECT COUNT(*) AS total FROM ${TABLE_GAME_KEYS}`).get();

console.log('=====================================================');
console.log(` Insertadas ${inserted} claves. Total en la base: ${total?.total ?? 0}`);
console.log('=====================================================');

db.close();

export { KeyStatus };