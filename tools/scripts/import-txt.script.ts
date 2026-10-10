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

import { parseLegacyTxt } from '../../apps/desktop/src/helpers/parse-legacy-txt.helper';
import { maskKey } from '../../apps/desktop/src/helpers/mask-key.helper';
import { normalizeKey, serializeTags } from '../../apps/desktop/src/helpers/normalize-text.helper';
import { SCHEMA_STATEMENTS } from '../../apps/desktop/src/contracts/constants/db-schema.constants';
import { KeySource } from '../../apps/desktop/src/contracts/enums/key-source.enum';
import { KeyStatus } from '../../apps/desktop/src/contracts/enums/key-status.enum';
import { databasePath } from './support/db-path.helper';

const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');
const dryRun = args.includes('--dry-run') || (!force && !args.includes('--yes'));

const TXT_PATH = join(import.meta.dir, '..', '..', 'original', 'steam-keys.txt');
const DB_PATH = databasePath();

/** Ruta de entrada indicada por el usuario, o el TXT original por defecto. */
const sourcePath = args.find((arg) => !arg.startsWith('-')) ?? TXT_PATH;

/** Lee el TXT de entrada. */
function readSource(): string {
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

const existingRows = db.query<{ key_value: string }, []>('SELECT key_value FROM game_keys').all();
const existing = new Set(existingRows.map((row) => fingerprint(row.key_value)));

const parsed = parseLegacyTxt(raw, { existingKeys: [...existing] });

console.log('=====================================================');
console.log(' Importacion de claves');
console.log('=====================================================');
console.log('Origen   :', sourcePath);
console.log('Base BD  :', DB_PATH);
console.log('');

// ---------------------------------------------------------------- simulacion --
const toInsert = parsed.entries.filter((entry) => !existing.has(fingerprint(entry.keyValue)));
const alreadyInDb = parsed.entries.length - toInsert.length;

console.log('Claves detectadas   :', parsed.entries.length);
console.log('  a insertar       :', toInsert.length);
console.log('  ya en la base    :', alreadyInDb);
console.log('  duplicadas TXT   :', parsed.stats.duplicates);
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
const insert = db.prepare(`
  INSERT OR IGNORE INTO game_keys
    (title, key_value, platform, status, source, gifted_to, parent_title,
     note, tags, added_on, created_at, updated_at)
  VALUES
    ($title, $keyValue, $platform, $status, $source, $giftedTo, $parentTitle,
     $note, $tags, $addedOn, datetime('now'), datetime('now'))
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

const total = db.query<{ total: number }, []>('SELECT COUNT(*) AS total FROM game_keys').get();

console.log('=====================================================');
console.log(` Insertadas ${inserted} claves. Total en la base: ${total?.total ?? 0}`);
console.log('=====================================================');

db.close();

function fingerprint(value: string): string {
  return normalizeKey(value).replace(/[^A-Z0-9]/g, '');
}

export { KeyStatus };