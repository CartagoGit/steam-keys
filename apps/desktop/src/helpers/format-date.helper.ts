import { AppLocale, DATE_HEADER_PATTERN, LOCALE_BCP47 } from '@/contracts';

/**
 * Fechas, en un solo sitio.
 *
 * Todos los formateadores reciben el idioma. Antes no lohacian, y eso producia
 * dos fallos a la vez: `formatLongDate` llevaba `es-ES` fijo, y
 * `formatRelativeDate` devolvia `hace 3 meses` en castellano con la app puesta
 * en ingles.
 *
 * Para las fechas relativas se usa `Intl.RelativeTimeFormat` en vez de
 * traducir a mano. Hace las dos cosas bien: pone las palabras en el idioma
 * correcto **y** concuerda el plural, que es justo lo que sale mal al hacerlo
 * con un `singular`/`plural` a proposito.
 */

/** Lo que se muestra cuando no hay fecha, o la fecha no se entiende. */
const SIN_FECHA = '—';

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

/**
 * Convierte a `Date`, o `null` si no hay fecha o no se puede leer.
 *
 * Acepta **numero o texto** porque las fechas llegan de dos sitios distintos y
 * los dos estan en el tipo: de la base de datos como `YYYY-MM-DD HH:MM:SS`, y
 * de `IBackup.createdAtMs`, que es un epoch en milisegundos porque la lista de
 * copias ordena por el. Aceptar solo texto obligaba a convertir en el punto de
 * uso, y fue justo ahi donde `formatRelativeDate` empezo a no compilar.
 */
function aFecha(valor: string | number | null | undefined): Date | null {
  // 0 es epoch. `!valor` se lo comeria y devolveria «sin fecha» sin avisar.
  if (valor === null || valor === undefined || valor === '') return null;

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Tipo de lo que se le puede pasar a los formateadores. */
type Fecha = string | number | null | undefined;

/** Fecha corta: `22/01/2025` en castellano, `22/01/2025` en ingles. */
export function formatShortDate(
  valor: Fecha,
  locale: AppLocale,
): string {
  const fecha = aFecha(valor);
  if (!fecha) return SIN_FECHA;

  return new Intl.DateTimeFormat(LOCALE_BCP47[locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fecha);
}

/** Fecha con hora: `22/01/2025 18:30`, en el idioma de la app. */
export function formatDateTime(ms: number, locale: AppLocale): string {
  const fecha = new Date(ms);
  if (Number.isNaN(fecha.getTime())) return SIN_FECHA;

  return new Intl.DateTimeFormat(LOCALE_BCP47[locale], {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}

/** Cuanto lleva: `hace 3 meses`, `3 months ago`, `il y a 3 mois`. */
export function formatRelativeDate(
  valor: Fecha,
  locale: AppLocale,
  ahora: Date = new Date(),
): string {
  const fecha = aFecha(valor);
  if (!fecha) return SIN_FECHA;

  const relativo = new Intl.RelativeTimeFormat(LOCALE_BCP47[locale], {
    numeric: 'auto',
  });

  const dias = Math.round((ahora.getTime() - fecha.getTime()) / 86_400_000);

  if (Math.abs(dias) < 1) return relativo.format(0, 'day');
  if (Math.abs(dias) < 30) return relativo.format(-dias, 'day');
  if (Math.abs(dias) < 365) return relativo.format(-Math.round(dias / 30), 'month');

  return relativo.format(-Math.round(dias / 365), 'year');
}

/** Marca de tiempo actual en formato `YYYY-MM-DD HH:MM:SS`, el que usa SQLite. */
export function nowSqliteTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Sello del nombre de una copia: `20260122-183045`.
 *
 * Va en **hora local** a proposito. El nombre se ve al lado del fichero, en la
 * misma carpeta, y quien lo compara con el reloj del sistema espera la hora de
 * aqui, no la de UTC. Por eso no se usa `toISOString()`, que daria la de UTC y
 * dejaria las copias descolocadas varias horas.
 */
export function formatFileStamp(fecha: Date = new Date()): string {
  return (
    `${fecha.getFullYear()}${pad(fecha.getMonth() + 1)}${pad(fecha.getDate())}` +
    `-${pad(fecha.getHours())}${pad(fecha.getMinutes())}${pad(fecha.getSeconds())}`
  );
}