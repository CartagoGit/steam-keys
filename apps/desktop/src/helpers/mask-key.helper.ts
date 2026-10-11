import { MASK_VISIBLE_CHARS } from '@/contracts';

/**
 * Enmascara una clave dejando visibles solo los primeros y ultimos caracteres.
 * Es la forma por defecto de pintar una clave en la interfaz: se reconoce de
 * un vistazo sin poder copiarla sin mas.
 */
export function maskKey(value: string, visible: number = MASK_VISIBLE_CHARS): string {
  const chars = [...value.trim()];

  if (chars.length === 0) return '';
  if (chars.length <= visible * 2) return '•'.repeat(chars.length);

  const head = chars.slice(0, visible).join('');
  const tail = chars.slice(-visible).join('');
  const hidden = '•'.repeat(Math.min(chars.length - visible * 2, 12));

  return `${head}${hidden}${tail}`;
}

/**
 * Enmascara un fragmento de texto que contenga una clave, respetando su
 * longitud. Se usa en los mensajes de error y en la consola.
 */
export function redact(value: string): string {
  return value.replace(
    /\b[A-Za-z0-9]{4,}(?:[-_][A-Za-z0-9]{2,}){1,4}\b/g,
    (match) => maskKey(match, 2),
  );
}