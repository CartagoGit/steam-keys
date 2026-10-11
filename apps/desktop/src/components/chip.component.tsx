import { Icon } from './icon.component';
import type { IconName } from '@/contracts/interfaces/icon-name.interface';
import type { ReactNode } from 'react';

export interface IChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  /** Numero que se enseña detras. Si no se pasa, no se enseña ninguno. */
  count?: number;
  icon?: IconName;
  /** Classes del punto de color, para los estados. */
  dot?: string;
  title?: string;
}

/**
 * Una pastilla de filtro.
 *
 * Los de plataforma llevan icono y numero, los de estado llevan un punto de
 * color. No es arbitrario: el icono dice **de donde** es la clave y el punto
 * dice **en que estado** esta, que es como se distingue una cosa de la otra
 * sin leer nada.
 */
export function Chip({
  label,
  active,
  onClick,
  count,
  icon,
  dot,
  title,
}: IChipProps) {
  const vacio = count === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium whitespace-nowrap transition',
        'ring-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        vacio ? 'cursor-not-allowed opacity-35' : '',
        active
          ? 'bg-info/20 text-info-strong ring-info/50'
          : 'text-t3 ring-line hover:bg-hover-2 hover:text-t1',
      ].join(' ')}
      disabled={vacio}
    >
      {icon ? <Icon name={icon} size={11} /> : null}
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> : null}
      {label}
      {count === undefined ? null : (
        <span className={active ? 'text-info' : 'text-t4'}>{count}</span>
      )}
    </button>
  );
}

export interface IChipGroupProps {
  label: string;
  children: ReactNode;
  /**
   * Con que color se distingue este grupo. Los de plataforma y los de estado
   * tienen uno distinto para que se separen de un vistazo.
   */
  tone: 'sky' | 'emerald';
  disabled?: boolean;
  disabledTitle?: string;
}

const TONOS: Record<string, string> = {
  sky: 'text-info',
  emerald: 'text-ok',
};

/**
 * Un grupo de pastillas con su titulo.
 *
 * El recuadro va dentro del grupo y no solo en el titulo: es lo que separa de
 * un vistazo "estos filtran por plataforma" de "estos filtran por estado".
 */
export function ChipGroup({
  label,
  children,
  tone,
  disabled = false,
  disabledTitle,
}: IChipGroupProps) {
  return (
    <div
      className={['flex items-center gap-1.5', disabled ? 'opacity-45' : ''].join(' ')}
      title={disabled ? disabledTitle : undefined}
    >
      <span
        className={[
          'text-[10px] font-medium tracking-wide uppercase',
          TONOS[tone] ?? 'text-t4',
        ].join(' ')}
      >
        {label}
      </span>

      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-hover p-1 ring-1 ring-line">
        {children}
      </div>
    </div>
  );
}