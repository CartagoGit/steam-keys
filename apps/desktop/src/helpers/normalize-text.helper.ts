import {
  GIFT_MARKER_PATTERN,
  TITLE_NOISE_PATTERN,
} from '@/contracts/constants/legacy-format.constants';

/** Colapsa espacios, tabs y saltos de linea a un unico espacio. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Limpia un titulo de juego: quita tabs, colapsa espacios y elimina el ruido
 * que el TXT accumulo con los años (`Steam Key:`, guiones sueltos, ...).
 */
export function normalizeTitle(value: string): string {
  return collapseWhitespace(
    value
      .replace(/[\t ]+/g, ' ')
      .replace(TITLE_NOISE_PATTERN, '')
      .replace(/[\s\-–—_:.]+$/g, ''),
  );
}

/** Quita el guion inicial que marca "ya regalada". No toca guiones internos. */
export function stripGiftMarker(value: string): string {
  return value.replace(GIFT_MARKER_PATTERN, '');
}

/** Quita separadores finales o iniciales (` - `, ` _ `, tabs, espacios). */
export function stripSeparators(value: string): string {
  return value
    .replace(/[\s ]*[-–—_][\s ]*$/g, '')
    .replace(/^[\s ]*[-–—_][\s ]*/g, '')
    .trim();
}

/** Normaliza una clave para guardarla: sin espacios y en mayusculas. */
export function normalizeKey(value: string): string {
  return collapseWhitespace(value).toUpperCase();
}

/**
 * Forma de comparacion de claves, insensible a guiones y mayusculas.
 * Sirve para detectar duplicados: `AAAA-BBB-CCC` y `aaaabbbccc` son la misma.
 */
export function keyFingerprint(value: string): string {
  return normalizeKey(value).replace(/[^A-Z0-9]/g, '');
}

/** Convierte una lista de tags en el texto plano que se guarda en la BD. */
export function serializeTags(tags: readonly string[] | undefined | null): string {
  if (!tags || tags.length === 0) return '';

  const clean = tags
    .map((tag) => collapseWhitespace(tag).toLowerCase())
    .filter((tag) => tag.length > 0);

  return [...new Set(clean)].join(',');
}

/** Deserializa el texto de tags guardado en la BD. */
export function parseTags(value: string | null | undefined): readonly string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}