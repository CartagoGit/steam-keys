import type { ReactNode } from 'react';
import type { IconName } from '@/contracts';

export type { IconName };

export interface IIconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const PATHS: Record<IconName, ReactNode> = {
  gamepad: (
    <>
      <path d="M6 11h4M8 9v4" />
      <circle cx="15" cy="10" r=".6" fill="currentColor" />
      <circle cx="18" cy="13" r=".6" fill="currentColor" />
      <path d="M17.3 5H6.7A4.7 4.7 0 0 0 2 9.7v4.6A4.7 4.7 0 0 0 6.7 19c1.6 0 2.4-.8 3.3-1.7.7-.7 1.3-1.3 2-1.3s1.3.6 2 1.3c.9.9 1.7 1.7 3.3 1.7a4.7 4.7 0 0 0 4.7-4.7V9.7A4.7 4.7 0 0 0 17.3 5Z" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.8 12.2 8.2-8.2M17 6l2.5 2.5M14 9l2 2" />
    </>
  ),
  gift: (
    <>
      <path d="M20 12v9H4v-9" />
      <path d="M22 7.5H2V12h20V7.5Z" />
      <path d="M12 21V7.5M12 7.5H7.75a2.25 2.25 0 1 1 0-4.5C11 3 12 7.5 12 7.5Zm0 0h4.25a2.25 2.25 0 1 0 0-4.5C13 3 12 7.5 12 7.5Z" />
    </>
  ),
  hand: (
    <>
      <path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 10.5V3.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M17 10.5V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.6a6 6 0 0 1-4.8-2.4L4 13.2a1.6 1.6 0 0 1 2.3-2.2L11 15" />
    </>
  ),
  shield: <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Zm-3-10 2.2 2.2L15.5 10" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  /* Ancho para "no cambia": la misma idea que `check`, pero sin flecha. */
  minus: <path d="M5 12h14" />,
  /* Capas apiladas, para lo que se aplica a varias filas a la vez. */
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 22 20H2L12 3.5Z" />
      <path d="M12 10v4M12 17.2v.1" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.5M12 17.2v.1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.9-3.9" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M3.5 6h17M9 6V4.5h6V6M6 6l1 14h10l1-14" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
      <path d="m14 6 4 4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A10.8 10.8 0 0 1 12 6c6.4 0 10 6 10 6a17.6 17.6 0 0 1-3.6 4.3M6.4 6.9A17.4 17.4 0 0 0 2 12s3.6 6 10 6a10.6 10.6 0 0 0 3.8-.7" />
      <path d="M9.9 10a2.8 2.8 0 0 0 4 4" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.6 2.6L16 9.5" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7.5 8.5 12 4l4.5 4.5M12 4v12" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7.5 11.5 12 16l4.5-4.5M12 16V4" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />,
  /**
   * Ordenar: tres rayas de largo decreciente y una flecha que baja.
   *
   * El set no tenia nada para esto, y no vale pedir prestado otro: `filter`
   * son tres rayas con una flecha **horizontal** —ordenar y filtrar no son
   * lo mismo— y `chevron-down` solo dice «esto se abre».
   *
   * Las rayas van en el mismo trazo y con la misma esquina que el resto del
   * set (`1.8` por defecto, `round`): un icono dibujado con otro grosor se ve
   * pegado al de al lado aunque las formas sean las mismas.
   */
  sort: (
    <>
      <path d="M3 6h11" />
      <path d="M3 12h8" />
      <path d="M3 18h5" />
      <path d="M18 5v12" />
      <path d="m14 13 4 4 4-4" />
    </>
  ),
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  package: (
    <>
      <path d="M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5v-9Z" />
      <path d="m3.5 7.5 8.5 4.6 8.5-4.6M12 12.1V21" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  tag: (
    <>
      <path d="M12.6 3H20a1 1 0 0 1 1 1v7.4a2 2 0 0 1-.6 1.4l-7.6 7.6a2 2 0 0 1-2.8 0L3.4 14a2 2 0 0 1 0-2.8l8.8-8.1a2 2 0 0 1 1.4-.6Z" />
      <circle cx="16.5" cy="7.5" r="1.3" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 4v5h-5" />
    </>
  ),
  undo: (
    <>
      <path d="M3 7v6h6" />
      <path d="M3.5 13a9 9 0 1 0 2.6-6.4L3 9" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
    </>
  ),
  palette: (
    <>
      <path d="M12 21a9 9 0 1 1 9-9c0 1.7-1.3 3-3 3h-1.5a2 2 0 0 0-1.4 3.4A2 2 0 0 1 12 21Z" />
      <circle cx="7.5" cy="12.5" r="1" fill="currentColor" />
      <circle cx="9.5" cy="8" r="1" fill="currentColor" />
      <circle cx="14.5" cy="7.5" r="1" fill="currentColor" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </>
  ),
  /**
   * GitHub y LinkedIn, dibujadas como sus marcas.
   *
   * No es adorno: un enlace a GitHub con un icono de candado no dice a donde
   * va, y en el pie —que es donde se acumulan las cosas de servicio— hace
   * falta reconocerlo de un vistazo.
   *
   * Van **rellenas** y no en trazo, al reves que el resto del set, y por un
   * motivo concreto: estas dos marcas no tienen version de trazo que se
   * parezca a nada. Dibujadas con el grosor de 1,8 del set salen finas y
   * cosas raras, y se reconocen peor que el dibujo llano.
   */
  github: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
    />
  ),
  linkedin: (
    <path
      fill="currentColor"
      stroke="none"
      d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.76-2.05C21.4 8.65 22 11 22 14.1V21h-4v-6.1c0-1.46-.03-3.34-2.03-3.34-2.04 0-2.35 1.59-2.35 3.23V21h-4V9Z"
    />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.8v.1" />
    </>
  ),
  lock: (
    <>
      {/* Cerrado: el arco cierra sobre el cuerpo y el candado se ve entero. */}
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  'lock-open': (
    <>
      {/* Abierto: el arco se abre hacia un lado, que es lo que dice «no hace falta todos». */}
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" />
    </>
  ),
};

/**
 * Set de iconos en SVG, embebido en el bundle.
 *
 * Se evita una dependencia externa de iconos para que la app no haga
 * peticiones de red ni para compilar: todo va dentro del ejecutable.
 */
export function Icon({ name, size = 16, className = '', strokeWidth = 1.8 }: IIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}