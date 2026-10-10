import { APP_NAME } from '@/contracts/constants/app.constants';
import {
  ANNOTATION_SEPARATOR,
  PARENT_ANNOTATION_PREFIX,
  PLATFORM_ANNOTATION_PREFIX,
  STATUS_MARKERS,
} from '@/contracts/constants/legacy-format.constants';
import { KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { parseTags, serializeTags } from '@/helpers/normalize-text.helper';
import type { IGameKey } from '@/contracts/interfaces/game-key.interface';

/** Inversa de `STATUS_MARKERS`, para escribir el estado en el TXT. */
const STATUS_MARKERS_REVERSE: Readonly<Record<KeyStatus, string>> = Object.freeze(
  Object.entries(STATUS_MARKERS).reduce<Partial<Record<KeyStatus, string>>>(
    (accumulator, [char, status]) => {
      accumulator[status as KeyStatus] = char;
      return accumulator;
    },
    {},
  ) as Record<KeyStatus, string>,
);

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

  // Marcador de estado al inicio de la linea. El `-` es el marcador original
  // de "regalada"; los demas los anade el exportador para no perder estados.
  const marker = STATUS_MARKERS_REVERSE[key.status] ?? (key.status === 'gifted' ? '-' : '');
  if (marker) parts.push(marker);

  parts.push(key.title);
  parts.push(`\tSteam Key: ${key.keyValue}`);

  if (key.giftedTo) parts.push(`- ${key.giftedTo}`);

  const notes: string[] = [];
  if (key.parentTitle && key.parentTitle !== key.title) {
    notes.push(`${PARENT_ANNOTATION_PREFIX} ${key.parentTitle}`);
  }
  // La plataforma solo se escribe cuando no es Steam: para el resto se deduce
  // de la forma de la clave, y duplicarla solo generaria ruido.
  if (key.platform !== KeyPlatform.Steam) {
    notes.push(`${PLATFORM_ANNOTATION_PREFIX} ${key.platform}`);
  }
  if (key.note) notes.push(key.note);

  if (notes.length > 0) parts.push(`[${notes.join(` ${ANNOTATION_SEPARATOR} `)}]`);

  const tags = parseTags(serializeTags(key.tags));
  if (tags.length > 0) parts.push(`{${tags.join(',')}}`);

  return parts.join(' ');
}