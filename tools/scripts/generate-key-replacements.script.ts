/**
 * Genera la tabla de sustituciones para `git filter-repo --replace-text`.
 *
 *   bun tools/scripts/generate-key-replacements.script.ts > /tmp/tabla.txt
 *
 * Recorre el historial, localiza las claves reales que se colaron en el código
 * y escribe las reglas que las sustituyen por marcadores sintéticos. Se
 * incluyen la forma original y la variante en mayúsculas, porque la auditoría
 * compara en mayúsculas y el filtro es sensible a mayúsculas.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { extractKeyToken } from '@/helpers/parse-legacy-txt.helper';

const ROOT = join(import.meta.dir, '..', '..');
const ORIGINAL = join(ROOT, 'original', 'steam-keys.txt');

const contenido = await Bun.file(ORIGINAL).text();

/** Cada clave real, tal y como aparece en el TXT. */
const reales = new Set<string>();
for (const linea of contenido.split(/\r?\n/)) {
  const token = extractKeyToken(linea);
  if (token) reales.add(token.value);
}

/** Los valores que aparecen realmente en el historial. */
function contenidoDe(especificacion: string): string {
  const salida = Bun.spawnSync(['git', 'show', especificacion], { cwd: ROOT });
  return salida.exitCode === 0 ? new TextDecoder().decode(salida.stdout) : '';
}

function commits(): readonly string[] {
  const salida = Bun.spawnSync(['git', 'rev-list', '--all'], { cwd: ROOT });
  if (salida.exitCode !== 0) return [];

  return new TextDecoder()
    .decode(salida.stdout)
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0);
}

function ficherosDe(commit: string): readonly string[] {
  const salida = Bun.spawnSync(['git', 'ls-tree', '-r', '--name-only', commit], {
    cwd: ROOT,
  });
  if (salida.exitCode !== 0) return [];

  return new TextDecoder()
    .decode(salida.stdout)
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0);
}

const filtradas = new Set<string>();

for (const commit of commits()) {
  for (const ruta of ficherosDe(commit)) {
    if (/\.(png|ico|icns|jpg|jpeg|gif|webp|woff2?)$/i.test(ruta)) continue;

    const texto = contenidoDe(`${commit}:${ruta}`);
    if (!texto) continue;

    for (const clave of reales) {
      if (texto.includes(clave)) filtradas.add(clave);
    }
  }
}

const reglas: string[] = [];
let indice = 1;

for (const clave of [...filtradas].sort()) {
  const sustituto = `CLAVE-FILTRADA-${indice}`;

  reglas.push(`literal:${clave}==>${sustituto}`);

  // También la variante en mayúsculas, por si quedó escrita así.
  const mayusculas = clave.toUpperCase();
  if (mayusculas !== clave) reglas.push(`literal:${mayusculas}==>${sustituto}`);

  indice += 1;
}

writeFileSync(1, `${reglas.join('\n')}\n`);

console.error(`Reglas generadas: ${reglas.length} (claves filtradas: ${filtradas.size})`);