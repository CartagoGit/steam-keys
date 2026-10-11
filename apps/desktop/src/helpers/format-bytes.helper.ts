/**
 * Tamano de fichero en unidades que se leen a ojo.
 *
 * Vive aqui y no en el panel de datos porque lo usan tres contratos
 * distintos —la informacion del almacenamiento, la de la base de datos y cada
 * copia— y mientras estuviera dentro de un componente, el segundo sitio que
 * lo necesecase se lo copiaria.
 */

/** Lo que se muestra cuando no hay nada que medir. */
const SIN_DATO = '—';

/**
 * `159744` → `156 KB`, `156000000` → `156.0 MB`.
 *
 * El salto a MB deja un decimal a proposito: entre 1 MB y 10 MB, redondear al
 * entero deja fuera la parte que mas cambia de un momento a otro, y el numero
 * de claves de una copia de seguridad esta justo en ese rango.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return SIN_DATO;
  if (bytes <= 0) return SIN_DATO;

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}