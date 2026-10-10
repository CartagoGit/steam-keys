import { KeyStatus } from '../enums/key-status.enum';
import type { IconName } from '../interfaces/icon-name.interface';

export interface IStatusMeta {
  label: string;
  tone: string;
  icon: IconName;
  /** Descripcion corta para el tooltip. */
  hint: string;
}

export const KEY_STATUS_META: Readonly<Record<KeyStatus, IStatusMeta>> = Object.freeze({
  [KeyStatus.Available]: {
    label: 'Disponible',
    tone: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    icon: 'gift',
    hint: 'La tengo yo, todavia regalable.',
  },
  [KeyStatus.Gifted]: {
    label: 'Regalada',
    tone: 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30',
    icon: 'hand',
    hint: 'Ya se la he dado a alguien.',
  },
  [KeyStatus.Redeemed]: {
    label: 'Canjeada',
    tone: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
    icon: 'check',
    hint: 'Activada por mi.',
  },
  [KeyStatus.Expired]: {
    label: 'Caducada',
    tone: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
    icon: 'alert',
    hint: 'La fecha limite de activacion ya paso.',
  },
  [KeyStatus.Unknown]: {
    label: 'Por revisar',
    tone: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    icon: 'help',
    hint: 'No consta cuando caduca o si se puede comprobar.',
  },
});