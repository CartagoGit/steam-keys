import {
  ANNOTATION_SEPARATOR,
  APP_NAME,
  DEFAULT_LOCALE,
  KeyPlatform,
  KeyStatus,
  LOCALE_BCP47,
  PARENT_ANNOTATION_PREFIX,
  PLATFORM_ANNOTATION_PREFIX,
  markerForStatus,
  type AppLocale,
  type IGameKey,
} from '@/contracts';
import { parseTags, serializeTags } from '@/helpers/normalize-text.helper';
import { formatShortDate } from '@/helpers/format-date.helper';
import { t } from '@/helpers/i18n.helper';

/**
 * Escribe el estado en el TXT con `markerForStatus()`, la inversa de
 * `STATUS_MARKERS`; si un estado no tiene marcador se escribe sin prefijo.
 */

/**
 * Vuelca la coleccion al formato del TXT original.
 *
 * El objetivo es el round-trip: lo que exporta la app debe poder volver a
 * importarse con `parseLegacyTxt` sin perder informacion.
 */
export function exportKeysToLegacyTxt(
  keys: readonly IGameKey[],
  locale: AppLocale = DEFAULT_LOCALE,
): string {
  const lines: string[] = [];

  // La cabecera es lo unico de este fichero que se lee con ojos humanos: lo
  // demas lo consume `parseLegacyTxt`. Por eso va traducida y con la fecha del
  // idioma de quien exporta. La fecha iba fija en `es-ES`, asi que un usuario
  // en ingles recibia una cabecera en castellano con el orden dia/mes/ano.
  //
  // Los `## <estado>` de abajo **no** se traducen a proposito: son parte del
  // formato que el parser reconoce, y ponerlos en el idioma de la app romperia
  // el round-trip que este fichero promete.
  lines.push(`${APP_NAME.toUpperCase()} — ${t('export.title')}`);
  lines.push(t('export.generated', [formatShortDate(new Date().toISOString(), locale)]));
  lines.push(t('export.total', [keys.length]));
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

    for (const key of [...group].sort((a, b) => a.title.localeCompare(b.title, LOCALE_BCP47[locale]))) {
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
  const marker = markerForStatus(key.status) ?? (key.status === KeyStatus.Gifted ? '-' : '');
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