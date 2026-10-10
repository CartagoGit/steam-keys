import { APP_NAME } from '@/contracts/constants/app.constants';
import { formatShortDate } from '@/helpers/format-date.helper';
import { parseTags, serializeTags } from '@/helpers/normalize-text.helper';
import type { IGameKey } from '@/contracts/interfaces/game-key.interface';

/**
 * Vuelca la coleccion al formato del TXT original.
 *
 * El objetivo es el round-trip: lo que exporta la app debe poder volver a
 * importarse con `parseLegacyTxt` sin perder informacion.
 */
export function exportKeysToLegacyTxt(keys: readonly IGameKey[]): string {
  const lines: string[] = [];

  lines.push(`${APP_NAME.toUpperCase()} — exportacion`);
  lines.push(`Generado el ${new Date().toLocaleDateString('es-ES')}`);
  lines.push(`Total: ${keys.length} claves`);
  lines.push('');

  const byStatus = new Map<string, IGameKey[]>();
  for (const key of keys) {
    const bucket = byStatus.get(key.status);
    if (bucket) bucket.push(key);
    else byStatus.set(key.status, [key]);
  }

  for (const [status, group] of byStatus) {
    lines.push(`${'-'.repeat(70)}`);
    lines.push(`## ${status} (${group.length})`);

    for (const key of [...group].sort((a, b) => a.title.localeCompare(b.title, 'es'))) {
      lines.push(formatKeyLine(key));
    }

    lines.push('');
  }

  return lines.join('\n');
}

/** Una entrada en el formato de una sola linea del TXT original. */
export function formatKeyLine(key: IGameKey): string {
  const parts: string[] = [];

  // El guion inicial es la marca de "regalada" del formato original.
  if (key.status === 'gifted') parts.push('-');

  parts.push(key.title);
  parts.push(`\tSteam Key: ${key.keyValue}`);

  if (key.parentTitle) parts.push(`(${key.parentTitle})`);
  if (key.giftedTo) parts.push(`- ${key.giftedTo}`);
  if (key.addedOn) parts.push(`# ${formatShortDate(key.addedOn)}`);
  if (key.note) parts.push(`[${key.note}]`);

  const tags = parseTags(serializeTags(key.tags));
  if (tags.length > 0) parts.push(`{${tags.join(',')}}`);

  return parts.join(' ');
}