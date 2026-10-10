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

import { exportKeysToLegacyTxt } from '../../apps/desktop/src/helpers/export-legacy-txt.helper';
import { parseTags } from '../../apps/desktop/src/helpers/normalize-text.helper';
import { KeyPlatform } from '../../apps/desktop/src/contracts/enums/key-platform.enum';
import { KeySource } from '../../apps/desktop/src/contracts/enums/key-source.enum';
import { KeyStatus } from '../../apps/desktop/src/contracts/enums/key-status.enum';
import { databasePath } from './support/db-path.helper';
import type { IGameKey } from '../../apps/desktop/src/contracts/interfaces/game-key.interface';

const DB_PATH = databasePath();
const args = process.argv.slice(2);

if (!existsSync(DB_PATH)) {
  console.error(`No existe la base de datos: ${DB_PATH}`);
  console.error('Ejecuta primero "bun run import -- --force".');
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

const rows = db
  .query<Record<string, string | null>, []>(
    `SELECT id, title, key_value, platform, status, source, gifted_to,
            parent_title, note, tags, added_on, last_used_at, created_at, updated_at
       FROM game_keys
      ORDER BY title COLLATE NOCASE ASC`,
  )
  .all();

const keys: IGameKey[] = rows.map((row) => ({
  id: Number(row.id),
  title: row.title ?? '',
  keyValue: row.key_value ?? '',
  platform: (row.platform as KeyPlatform) ?? KeyPlatform.Steam,
  status: (row.status as KeyStatus) ?? KeyStatus.Available,
  source: (row.source as KeySource) ?? KeySource.Manual,
  giftedTo: row.gifted_to,
  parentTitle: row.parent_title,
  note: row.note,
  tags: parseTags(row.tags),
  addedOn: row.added_on,
  lastUsedAt: row.last_used_at,
  createdAt: row.created_at ?? '',
  updatedAt: row.updated_at ?? '',
}));

const target = args[0] ?? join(import.meta.dir, '..', '..', 'build', 'steam-keys-export.txt');

mkdirSync(join(target, '..'), { recursive: true });
await Bun.write(target, exportKeysToLegacyTxt(keys));

db.close();

console.log(`Exportadas ${keys.length} claves a:`);
console.log(`  ${target}`);

export type { IGameKey };