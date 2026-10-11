/**
 * Auditoría de secretos: comprueba que ninguna clave real se ha colado en el
 * repositorio, ni en el índice ni en el historial.
 *
 *   bun run audit
 *   bun run audit -- --solo-indice
 *
 * Lee las claves del TXT original y las busca en todos los ficheros
 * versionados y en todas las versiones de todos los commits. Falla si
 * encuentra alguna, e indica exactamente qué ficheros y qué commits.
 *
 * No imprime nunca una clave: solo cuenta coincidencias y nombra ficheros.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { extractKeyToken } from '@/helpers/parse-legacy-txt.helper';

const ROOT = join(import.meta.dir, '..', '..');
const ORIGINAL = join(ROOT, 'original', 'steam-keys.txt');

/** Formato de un fichero binario: no se puede buscar texto dentro. */
const BINARIO = /\.(png|ico|icns|jpg|jpeg|gif|webp|woff2?)$/i;

interface IClave {
  valor: string;
  linea: number;
}

// -------------------------------------------------------------------- git ---

function git(args: readonly string[]): { ok: boolean; salida: string } {
  const resultado = Bun.spawnSync(['git', ...args], { cwd: ROOT });

  return {
    ok: resultado.exitCode === 0,
    salida: new TextDecoder().decode(resultado.stdout),
  };
}

function aLineas(salida: string): readonly string[] {
  return salida
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0);
}

function ficherosVersionados(): readonly string[] {
  const resultado = git(['ls-files']);
  if (!resultado.ok) {
    throw new Error('`git ls-files` fallo: ¿estas dentro de un repositorio?');
  }

  return aLineas(resultado.salida);
}

function todosLosCommits(): readonly string[] {
  const resultado = git(['rev-list', '--all']);
  return resultado.ok ? aLineas(resultado.salida) : [];
}

function ficherosDeCommit(commit: string): readonly string[] {
  const resultado = git(['ls-tree', '-r', '--name-only', commit]);
  return resultado.ok ? aLineas(resultado.salida) : [];
}

/** Contenido de un fichero, ya sea en el indice o en un commit. */
function contenidoDe(referencia: string): string {
  const resultado = git(['show', referencia]);
  return resultado.ok ? resultado.salida : '';
}

// ----------------------------------------------------------------- claves ---

function clavesReales(): readonly IClave[] {
  if (!existsSync(ORIGINAL)) return [];

  const claves: IClave[] = [];

  readFileSync(ORIGINAL, 'utf8')
    .split(/\r?\n/)
    .forEach((linea, indice) => {
      const token = extractKeyToken(linea);
      if (token) claves.push({ valor: token.value.toUpperCase(), linea: indice + 1 });
    });

  return claves;
}

/** Lineas del TXT original que coinciden con el contenido dado. */
function coincidencias(claves: readonly IClave[], contenido: string): readonly number[] {
  const superior = contenido.toUpperCase();

  return claves
    .filter((clave) => superior.includes(clave.valor))
    .map((clave) => clave.linea);
}

/** Recorta una lista para que el mensaje siga siendo legible. */
function muestra(lista: readonly number[]): string {
  const cola = lista.slice(0, 6).join(', ');
  return lista.length > 6 ? `${cola}…` : cola;
}

// ------------------------------------------------------------------- main ---

const claves = clavesReales();

console.log('=====================================================');
console.log(' Auditoria de claves');
console.log('=====================================================');
console.log('Claves reales en original/ :', claves.length);

if (claves.length === 0) {
  console.log('No hay TXT original: nada que auditar.');
  process.exit(0);
}

const soloIndice = process.argv.slice(2).includes('--solo-indice');
const commits = todosLosCommits();
const ficheros = ficherosVersionados();

const enIndice = new Map<string, readonly number[]>();
const enHistorial = new Map<string, readonly number[]>();
let analizados = 0;

for (const ruta of ficheros) {
  if (BINARIO.test(ruta)) continue;

  const contenido = contenidoDe(`:${ruta}`);
  if (contenido.length === 0) continue;

  analizados += 1;

  const encontradas = coincidencias(claves, contenido);
  if (encontradas.length > 0) enIndice.set(ruta, encontradas);
}

console.log('Ficheros versionados       :', ficheros.length);
console.log('Ficheros de texto leidos   :', analizados);
console.log('Commits analizados         :', soloIndice ? '(omitido)' : commits.length);
console.log('');

if (!soloIndice) {
  for (const commit of commits) {
    for (const ruta of ficherosDeCommit(commit)) {
      if (BINARIO.test(ruta)) continue;

      const contenido = contenidoDe(`${commit}:${ruta}`);
      if (contenido.length === 0) continue;

      const encontradas = coincidencias(claves, contenido);
      if (encontradas.length === 0) continue;

      enHistorial.set(`${commit.slice(0, 8)}:${ruta}`, encontradas);
    }
  }
}

if (enIndice.size === 0 && enHistorial.size === 0) {
  console.log('OK: ninguna clave real esta en el indice ni en el historial.');
  process.exit(0);
}

console.error(`FUGA: ${enIndice.size} fichero(s) en el indice, ${enHistorial.size} en el historial.`);
console.error('');

if (enIndice.size > 0) {
  console.error('En el indice (aun sin subir):');
  for (const [ruta, lista] of enIndice) {
    console.error(`  ${ruta}  (lineas del TXT: ${muestra(lista)})`);
  }
  console.error('  -> git rm --cached <fichero>');
  console.error('');
}

if (enHistorial.size > 0) {
  console.error('En el historial (ya subido en algun momento):');
  for (const [etiqueta, lista] of enHistorial) {
    console.error(`  ${etiqueta}  (lineas del TXT: ${muestra(lista)})`);
  }
  console.error('');
  console.error('Para limpiarlo:');
  console.error('  1. Sustituye esas claves por sinteticas en el codigo.');
  console.error('  2. Genera las reglas y reescribe el historial:');
  console.error('       bun tools/scripts/generate-key-replacements.script.ts > tabla.txt');
  console.error('       git filter-repo --replace-text tabla.txt --force');
  console.error('  3. Sube el historial reescrito:');
  console.error('       git push --force --mirror origin');
  console.error('');
  console.error('Ojo: filter-repo revierte los cambios sin commitear.');
}

process.exit(1);