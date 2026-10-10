/**
 * Auditoría de secretos: comprueba que ninguna clave real se puede colar en
 * el repositorio.
 *
 *   bun run audit
 *
 * Lee las claves del TXT original, las busca en todos los ficheros versionados
 * (via `git ls-files`) y en el staging area, y falla si encuentra alguna.
 *
 * No imprime nunca una clave: solo cuenta coincidencias y dice qué ficheros
 * están-its. Si el script falla, el fichero ya está en el índice y hay que
 * limpiarlo antes de hacer push.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { extractKeyToken } from '../../apps/desktop/src/helpers/parse-legacy-txt.helper';

const ROOT = join(import.meta.dir, '..', '..');
const ORIGINAL = join(ROOT, 'original', 'steam-keys.txt');

interface IClave {
  valor: string;
  linea: number;
}

function clavesReales(): readonly IClave[] {
  if (!existsSync(ORIGINAL)) return [];

  const raw = readFileSync(ORIGINAL, 'utf8');
  const claves: IClave[] = [];

  raw.split(/\r?\n/).forEach((linea, indice) => {
    const token = extractKeyToken(linea);
    if (token) claves.push({ valor: token.value.toUpperCase(), linea: indice + 1 });
  });

  return claves;
}

function ficherosVersionados(): readonly string[] {
  const salida = Bun.spawnSync(['git', 'ls-files'], { cwd: ROOT });
  if (salida.exitCode !== 0) {
    throw new Error('`git ls-files` falló: ¿estás dentro de un repositorio?');
  }

  return new TextDecoder()
    .decode(salida.stdout)
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0);
}

function contentsDeGit(ruta: string): string {
  const salida = Bun.spawnSync(['git', 'show', `:${ruta}`], { cwd: ROOT });
  if (salida.exitCode !== 0) return '';

  return new TextDecoder().decode(salida.stdout);
}

const claves = clavesReales();

console.log('=====================================================');
console.log(' Auditoría de claves');
console.log('=====================================================');
console.log('Claves reales en original/ :', claves.length);

if (claves.length === 0) {
  console.log('No hay TXT original: nada que auditar.');
  process.exit(0);
}

const ficheros = ficherosVersionados();
console.log('Ficheros versionados       :', ficheros.length);
console.log('');

const offended = new Map<string, string[]>();
let contenidoTotal = 0;

for (const ruta of ficheros) {
  // Los binarios (iconos) no se pueden leer como texto.
  if (/\.(png|ico|icns|jpg|jpeg|gif|webp|woff2?)$/i.test(ruta)) continue;

  const contenido = contentsDeGit(ruta);
  if (contenido.length === 0) continue;

  contenidoTotal += 1;
  const superior = contenido.toUpperCase();

  const encontradas = claves
    .filter((clave) => superior.includes(clave.valor))
    .map((clave) => clave.linea);

  if (encontradas.length > 0) offended.set(ruta, encontradas);
}

console.log('Ficheros de texto analizados:', contenidoTotal);

if (offended.size === 0) {
  console.log('');
  console.log('OK: ninguna clave real está versionada.');
  process.exit(0);
}

console.log('');
console.error(`FUGA: hay claves reales en ${offended.size} fichero(s) versionado(s):`);

for (const [ruta, lineas] of offended) {
  console.error(`  ${ruta}  (líneas del TXT: ${lineas.slice(0, 6).join(', ')}…)`);
}

console.error('');
console.error('Para limpiar el índice:');
console.error('  git rm --cached <fichero>');
console.error('Y añade el patrón correspondiente al .gitignore.');
console.error('Si ya está subido, revisa el historial: git filter-repo.');

process.exit(1);