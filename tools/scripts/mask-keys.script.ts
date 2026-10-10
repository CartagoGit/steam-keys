/**
 * Enmascara todas las claves de un TXT.
 *
 * Genera una copia "segura" del listado que se puede compartir, commitear o
 * pegar en un chat sin filtrar ninguna clave.
 *
 *   bun run mask                     -> build/steam-keys-masked.txt
 *   bun run mask -- salida.txt       -> salida.txt
 *   bun run mask -- original/x.txt y.txt
 *
 * Las lineas que no contienen clave se copian tal cual.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { maskKey } from '../../apps/desktop/src/helpers/mask-key.helper';

const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith('-'));

const DEFAULT_INPUT = join(import.meta.dir, '..', '..', 'original', 'steam-keys.txt');
const input = positional[0] ?? DEFAULT_INPUT;
const output = positional[1] ?? join(import.meta.dir, '..', '..', 'build', 'steam-keys-masked.txt');

if (!existsSync(input)) {
  console.error(`No existe el fichero de entrada: ${input}`);
  process.exit(1);
}

/** Formatos de clave detectados en el TXT original. */
const KEY_PATTERNS = [
  /\b[A-Z0-9]{4,6}(?:-[A-Z0-9]{4,6}){1,3}\b/gi, // Steam y Battle.net
  /(?<=[?&]key=)[A-Za-z0-9]{8,}/gi, // codigo dentro de una URL de Humble
  /\b[A-Za-z0-9]{16,24}\b/g, // giveaway alfanumerico de otras tiendas
];

const raw = await Bun.file(input).text();
const lines = raw.split(/\r?\n/);

let masked = 0;

const outputLines = lines.map((line) => {
  let result = line;

  for (const pattern of KEY_PATTERNS) {
    result = result.replace(pattern, (match) => {
      masked += 1;
      return maskKey(match, 2);
    });
  }

  return result;
});

mkdirSync(dirname(output), { recursive: true });
await Bun.write(output, outputLines.join('\n'));

// Comprobacion de seguridad: la salida no debe contener ninguna clave real.
const reals = lines
  .flatMap((line) => {
    const found: string[] = [];
    for (const pattern of KEY_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) found.push(match[0].toUpperCase());
    }
    return found;
  })
  .filter((value) => value.length >= 5);

const leaked = reals.filter((value) =>
  outputLines.some((line) => line.toUpperCase().includes(value)),
);

console.log(`Entrada  : ${input}`);
console.log(`Salida   : ${output}`);
console.log(`Lineas   : ${lines.length}`);
console.log(`Enmascaradas: ${masked}`);

if (leaked.length > 0) {
  console.error(`\nFUGA: ${leaked.length} claves sobreviven al enmascarado. Revisa los patrones.`);
  process.exit(1);
}

console.log('Comprobado: ninguna clave aparece en la salida.');