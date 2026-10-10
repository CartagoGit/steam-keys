/**
 * Valida el parser contra el TXT real.
 *
 * REGLA INNEGOCIABLE: nada de lo que se imprima puede contener una clave.
 * Cada linea se enmascara antes de salir por stdout, y al final se comprueba
 * que ninguna clave del archivo aparece literalmente en la salida acumulada.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  extractKeyToken,
  parseLegacyTxt,
} from '../../apps/desktop/src/helpers/parse-legacy-txt.helper';
import { KEY_PLATFORM_META } from '../../apps/desktop/src/contracts/constants/key-platform.constants';
import { KEY_STATUS_META } from '../../apps/desktop/src/contracts/constants/key-status.constants';
import {
  INSTRUCTION_PATTERN,
  PLATFORM_HINT_PATTERN,
} from '../../apps/desktop/src/contracts/constants/legacy-format.constants';
import { maskKey } from '../../apps/desktop/src/helpers/mask-key.helper';
import type { IParsedEntry } from '../../apps/desktop/src/contracts/interfaces/parsed-entry.interface';

const TXT_PATH = join(import.meta.dir, '..', '..', 'original', 'steam-keys.txt');

const raw = readFileSync(TXT_PATH, 'utf8');
const lines = raw.split(/\r?\n/);

/** Todas las claves reales del archivo, para usarlas como detector de fugas. */
const realKeys: string[] = [];
for (const line of lines) {
  const token = extractKeyToken(line);
  if (token) realKeys.push(token.value.toUpperCase());
}

/** Cuantas lineas del TXT contienen alguna clave, para medir cobertura. */
const linesWithKey = lines.filter((line) => extractKeyToken(line) !== null).length;

const result = parseLegacyTxt(raw);

const out: string[] = [];
const log = (...parts: unknown[]): void => {
  out.push(parts.join(' '));
  console.log(...parts);
};

/** Enmascara cualquier clave que pudiera quedar en un fragmento de texto. */
const safe = (text: string): string =>
  text.replace(/\b[A-Z0-9]{4,}(?:-[A-Z0-9]{2,}){1,4}\b/gi, (match) => maskKey(match, 2));

log('==================== COBERTURA ====================');
log('lineas del TXT          :', result.stats.totalLines);
log('lineas con clave        :', linesWithKey);
log('entradas generadas     :', result.entries.length);
log('cobertura               :', `${((result.entries.length / linesWithKey) * 100).toFixed(1)}%`);
log('disponibles            :', result.stats.available);
log('regaladas (guion -)    :', result.stats.gifted);
log('duplicados descartados :', result.stats.duplicates);
log('incidencias            :', result.issues.length);

log('\n=============== POR PLATAFORMA ===============');
for (const [platform, count] of Object.entries(result.stats.byPlatform)) {
  const label = KEY_PLATFORM_META[platform as keyof typeof KEY_PLATFORM_META]?.label ?? platform;
  log(`  ${label.padEnd(18)} ${String(count).padStart(4)}`);
}

log('\n=============== POR ESTADO ===============');
const byStatus = new Map<string, number>();
for (const entry of result.entries) {
  byStatus.set(entry.status, (byStatus.get(entry.status) ?? 0) + 1);
}
for (const [status, count] of byStatus) {
  log(
    `  ${(KEY_STATUS_META[status as keyof typeof KEY_STATUS_META]?.label ?? status).padEnd(18)} ${String(count).padStart(4)}`,
  );
}

log('\n=============== INCIDENCIAS POR MOTIVO ===============');
const byReason = new Map<string, number>();
for (const issue of result.issues) {
  byReason.set(issue.reason, (byReason.get(issue.reason) ?? 0) + 1);
}
for (const [reason, count] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
  log(`  ${reason.padEnd(24)} ${String(count).padStart(4)}`);
}

log('\n=============== 20 ENTRADAS (CLAVES ENMASCARADAS) ===============');
const step = Math.max(1, Math.floor(result.entries.length / 20));
result.entries
  .filter((_, index) => index % step === 0)
  .slice(0, 20)
  .forEach((entry: IParsedEntry) => {
    log(
      `  L${String(entry.sourceLine).padStart(4)}`,
      safe(entry.title).slice(0, 44).padEnd(44),
      maskKey(entry.keyValue, 2),
      `[${entry.platform}]`,
    );
  });

log('\n=============== ENTRADAS SIN NOMBRE ===============');
const nameless = result.entries.filter((entry) => entry.title === 'Sin nombre');
log('total:', nameless.length);
nameless.slice(0, 12).forEach((entry) => {
  log(`  L${String(entry.sourceLine).padStart(4)}`, safe(entry.note ?? '').slice(0, 70));
});

log('\n=============== DUPLICADOS (15 primeros) ===============');
result.issues
  .filter((issue) => issue.reason === 'clave_repetida_en_linea')
  .slice(0, 15)
  .forEach((issue) => log(`  L${String(issue.sourceLine).padStart(4)}`, safe(issue.rawLine).slice(0, 70)));

log('\n=============== LINEAS QUE FIJAN PLATAFORMA ===============');
lines.forEach((line, index) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  if (extractKeyToken(trimmed)) return;
  if (INSTRUCTION_PATTERN.test(trimmed)) return;
  if (PLATFORM_HINT_PATTERN.test(trimmed)) {
    log(`  L${index + 1}`, safe(trimmed).slice(0, 70));
  }
});

const joined = out.join('\n').toUpperCase();
const leaked = realKeys.filter((key) => joined.includes(key));

log('\n=============== CONTROL DE FUGAS ===============');
log('claves reales en el TXT      :', realKeys.length);
log('claves filtradas en la salida:', leaked.length);

if (leaked.length > 0) {
  console.error('\nFUGA DETECTADA. No publicar esta salida.');
  process.exit(1);
}

log('OK: ninguna clave aparece en la salida.');