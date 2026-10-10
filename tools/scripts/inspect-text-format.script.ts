/**
 * Inspect the messy regions of the legacy TXT so the parser can be faithful.
 * Every key is masked before it reaches stdout — the raw values never leave this process.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(import.meta.dir, '..', '..', 'original', 'steam-keys.txt');
const lines = readFileSync(FILE, 'utf8').split(/\r?\n/);

const KEY_RE = /\b[0-9A-Z]{4,6}-[0-9A-Z]{4,6}-[0-9A-Z]{4,6}(?:-[0-9A-Z]{4,6})?\b/i;
const URL_KEY_RE = /([?&]key=)([A-Za-z0-9]{8,})/gi;

function mask(text: string): string {
  return text
    .replace(URL_KEY_RE, (_m, p: string) => `${p}<URLKEY>`)
    .replace(KEY_RE, '<KEY>');
}

const RANGES: Array<[string, number, number]> = [
  ['A) cabecera + separadores', 1, 40],
  ['B) separadores "..." y sesiones', 170, 180],
  ['C) URLs de Humble Bundle', 278, 350],
  ['D) bloques DLC con llaves', 535, 600],
  ['E) cola del archivo', 640, 672],
];

for (const [label, from, to] of RANGES) {
  console.log(`\n===== ${label} (${from}-${to}) =====`);
  for (let n = from; n <= Math.min(to, lines.length); n += 1) {
    const raw = lines[n - 1] ?? '';
    console.log(String(n).padStart(4), JSON.stringify(mask(raw)));
  }
}

console.log('\n===== formas de separador nombre→key =====');
const shapes = new Map<string, number>();
lines.forEach((raw) => {
  const t = raw.trim();
  const m = t.match(KEY_RE);
  if (!m || m.index === 0) return;
  const before = t.slice(Math.max(0, m.index - 4), m.index);
  const shape = JSON.stringify(before);
  shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
});
console.log([...shapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25));

console.log('\n===== líneas sin key que NO son decorativas =====');
lines.forEach((raw, i) => {
  const t = raw.trim();
  if (!t) return;
  if (KEY_RE.test(t) || /&key=/i.test(t)) return;
  if (/^[.=_*#-]{3,}$/.test(t)) return;
  if (/^(\.+|-{3,})/.test(t)) return;
  console.log(String(i + 1).padStart(4), JSON.stringify(mask(t)));
});