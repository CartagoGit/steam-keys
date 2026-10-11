import { KeyStatus } from '../enums/key-status.enum';
import type { IconName } from '../interfaces/icon-name.interface';

export interface IStatusMeta {
  label: string;
  tone: string;
  icon: IconName;
  /** Descripcion corta para el tooltip. */
  hint: string;
}

/**
 * Los tonos van con los colores **semanticos** (`bg-ok`, `text-warn`…) y no
 * con tonos fijos de la rampa de Tailwind.
 *
 * Con `bg-emerald-500/15 text-emerald-300` la pastilla se ve bien en los temas
 * oscuros y se lava en los claros: un verde claro sobre un crema no se lee.
 * Cada tema declara sus propios tonos de estado en `styles/index.css`, asi que
 * aqui solo se dice que papel juega cada estado y el color lo pone el tema.
 */
export const KEY_STATUS_META: Readonly<Record<KeyStatus, IStatusMeta>> = Object.freeze({
  [KeyStatus.Available]: {
    label: 'Disponible',
    tone: 'bg-ok/15 text-ok ring-ok/30',
    icon: 'gift',
    hint: 'La tengo yo, todavia regalable.',
  },
  [KeyStatus.Gifted]: {
    label: 'Regalada',
    tone: 'bg-hover text-t3 ring-line',
    icon: 'hand',
    hint: 'Ya se la he dado a alguien.',
  },
  [KeyStatus.Redeemed]: {
    label: 'Canjeada',
    tone: 'bg-info/15 text-info ring-info/30',
    icon: 'check',
    hint: 'Activada por mi.',
  },
  [KeyStatus.Expired]: {
    label: 'Caducada',
    tone: 'bg-danger/15 text-danger ring-danger/30',
    icon: 'alert',
    hint: 'La fecha limite de activacion ya paso.',
  },
  [KeyStatus.Unknown]: {
    label: 'Por revisar',
    tone: 'bg-warn/15 text-warn ring-warn/30',
    icon: 'help',
    hint: 'No consta cuando caduca o si se puede comprobar.',
  },
});