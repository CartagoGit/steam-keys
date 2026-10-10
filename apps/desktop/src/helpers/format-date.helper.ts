import { DATE_HEADER_PATTERN } from '@/contracts/constants/legacy-format.constants';

/**
 * Convierte la cabecera de fecha del TXT (`# 22-01-25`) a ISO.
 * Los anos de dos digitos se interpreted como 2000-2069, que es el rango
 * real de esta coleccion.
 */
export function parseLegacyDate(header: string): string | null {
  const match = header.trim().match(DATE_HEADER_PATTERN);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(rawYear)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const year = rawYear < 100 ? (rawYear < 70 ? 2000 + rawYear : 1900 + rawYear) : rawYear;

  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Fecha corta en formato espanol: `22/01/2025`. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Fecha larga: `22 de enero de 2025`. */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Texto relativo tipo "hace 3 meses", con reserva si la fecha es invalida. */
export function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const diffDays = Math.round((Date.now() - date.getTime()) / 86_400_000);

  if (diffDays < 1) return 'hoy';
  if (diffDays === 1) return 'ayer';
  if (diffDays < 30) return `hace ${diffDays} días`;
  if (diffDays < 365) return `hace ${Math.round(diffDays / 30)} meses`;

  return `hace ${Math.round(diffDays / 365)} años`;
}

/** Marca de tiempo actual en formato `YYYY-MM-DD HH:MM:SS`, el que usa SQLite. */
export function nowSqliteTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}