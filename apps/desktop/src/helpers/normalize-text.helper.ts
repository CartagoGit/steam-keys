import { ANNOTATION_SEPARATOR, PARENT_ANNOTATION_PREFIX, PLATFORM_ANNOTATION_PREFIX, STATUS_MARKERS, TITLE_NOISE_PATTERN } from '@/contracts';

/** Marcadores de estado al inicio de linea: `- ! ~ ?`, en racha o no. */
const LEADING_STATUS_MARKER = new RegExp(
  `^[\\s]*[${Object.keys(STATUS_MARKERS)
    .map((char) => `\\${char}`)
    .join('')}]+[\\s]*`,
);

/** Colapsa espacios, tabs y saltos de linea a un unico espacio. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Limpia un titulo de juego: quita tabs, colapsa espacios y elimina el ruido
 * que el TXT accumulo con los años (`Steam Key:`, guiones sueltos, ...).
 *
 * El marcador inicial se retira siempre: sea el guion original de "regalada" o
 * los que anade el exportador, nunca forma parte del nombre.
 */
export function normalizeTitle(value: string): string {
  return collapseWhitespace(
    value
      .replace(/[\t ]+/g, ' ')
      .replace(TITLE_NOISE_PATTERN, '')
      .replace(LEADING_STATUS_MARKER, '')
      .replace(/[\s\-–—_:.]+$/g, ''),
  );
}

/** Texto tras extraer las anotaciones entre corchetes y llaves. */
export interface IAnnotatedText {
  title: string;
  note: string | null;
  parentTitle: string | null;
  /** Plataforma declarada en la anotacion, si la lleva. */
  platform: string | null;
  tags: readonly string[];
}

/**
 * Separa las anotaciones que escribe el exportador: `[nota]`,
 * `[parent: X]`, `[plataforma: Y]` y `{etiquetas}`.
 *
 * Sin esto, el TXT exportado no se podria volver a importar: una linea con la
 * nota "4 Sesion de regalos" dentro se confundiria con un encabezado.
 */
export function extractAnnotations(value: string): IAnnotatedText {
  const tags: string[] = [];
  const notes: string[] = [];
  let parentTitle: string | null = null;
  let platform: string | null = null;

  let rest = value.replace(/\{([^}]*)\}/g, (_match, inner: string) => {
    tags.push(
      ...inner
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    );
    return ' ';
  });

  rest = rest.replace(/\[([^\]]*)\]/g, (_match, inner: string) => {
    // El exportador puede encadenar varias anotaciones separadas por ` · `,
    // asi que hay queMirar cada trocito por separado.
    for (const chunk of inner.split(ANNOTATION_SEPARATOR)) {
      const note = chunk.trim();
      if (note.length === 0) continue;

      const lower = note.toLowerCase();

      if (lower.startsWith(PARENT_ANNOTATION_PREFIX)) {
        parentTitle = note.slice(PARENT_ANNOTATION_PREFIX.length).trim() || null;
        continue;
      }

      if (lower.startsWith(PLATFORM_ANNOTATION_PREFIX)) {
        platform = note.slice(PLATFORM_ANNOTATION_PREFIX.length).trim() || null;
        continue;
      }

      notes.push(note);
    }

    return ' ';
  });

  return {
    title: collapseWhitespace(rest),
    note: notes.length > 0 ? notes.join(` ${ANNOTATION_SEPARATOR} `) : null,
    parentTitle,
    platform,
    tags,
  };
}

/** Quita separadores finales o iniciales (` - `, ` _ `, tabs, espacios). */
export function stripSeparators(value: string): string {
  return value
    .replace(/[\s ]*[-–—_][\s ]*$/g, '')
    .replace(/^[\s ]*[-–—_]+[\s ]*/g, '')
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