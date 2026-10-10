/**
 * Muestra donde vive la base de datos y cuantas claves tiene.
 *
 *   bun run db:path
 */
import { existsSync, statSync } from 'node:fs';

import { databasePath, appConfigDir } from './support/db-path.helper';

const dbPath = databasePath();

console.log('Directorio de la app :', appConfigDir());
console.log('Base de datos        :', dbPath);

if (!existsSync(dbPath)) {
  console.log('Estado               : todavia no existe (importa el TXT para crearla)');
  process.exit(0);
}

const sizeKb = Math.round(statSync(dbPath).size / 1024);

console.log('Tamano               :', `${sizeKb} KB`);

const { Database } = await import('bun:sqlite');
const db = new Database(dbPath, { readonly: true });

const total = db.query<{ total: number }, []>('SELECT COUNT(*) AS total FROM game_keys').get();

console.log('Claves almacenadas   :', total?.total ?? 0);

db.close();