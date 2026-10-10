/**
 * Borra la base de datos local de la app.
 *
 *   bun run db:reset -- --force
 *
 * Sin `--force` solo muestra lo que haria. La copia del TXT original no se
 * toca nunca: vive en `original/` y es la unica fuente de verdad.
 */
import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';

import { databasePath } from './support/db-path.helper';

const force = process.argv.slice(2).includes('--force');
const dbPath = databasePath();

if (!existsSync(dbPath)) {
  console.log('No hay ninguna base de datos que borrar.');
  console.log('Ruta esperada:', dbPath);
  process.exit(0);
}

console.log('Base de datos a borrar:', dbPath);

if (!force) {
  console.log('');
  console.log('Ejecuta "bun run db:reset -- --force" para confirmarlo.');
  process.exit(0);
}

await unlink(dbPath);

console.log('Borrada. La app creara una vacia la proxima vez que se abra.');