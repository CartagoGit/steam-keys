import { KeyPlatform } from '../enums/key-platform.enum';
import type { IconName } from '../interfaces/icon-name.interface';

export interface IPlatformMeta {
  label: string;
  /** Nombre corto para chips y badges. */
  short: string;
  /** Colores del badge. */
  tone: string;
  icon: IconName;
  /** `true` cuando la clave se canjea dentro de Steam. */
  inSteam: boolean;
}

export const KEY_PLATFORM_META: Readonly<Record<KeyPlatform, IPlatformMeta>> = Object.freeze({
  [KeyPlatform.Steam]: {
    label: 'Steam',
    short: 'Steam',
    tone: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
    icon: 'gamepad',
    inSteam: true,
  },
  [KeyPlatform.BattleNet]: {
    label: 'Battle.net',
    short: 'B.net',
    tone: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
    icon: 'shield',
    inSteam: false,
  },
  [KeyPlatform.GuildWars2]: {
    label: 'Guild Wars 2',
    short: 'GW2',
    tone: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    icon: 'shield',
    inSteam: false,
  },
  [KeyPlatform.Neverwinter]: {
    label: 'Neverwinter',
    short: 'NWN',
    tone: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    icon: 'shield',
    inSteam: false,
  },
  [KeyPlatform.BladeAndSoul]: {
    label: 'Blade & Soul',
    short: 'B&S',
    tone: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
    icon: 'shield',
    inSteam: false,
  },
  [KeyPlatform.ElderScrollsOnline]: {
    label: 'ESO',
    short: 'ESO',
    tone: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
    icon: 'shield',
    inSteam: false,
  },
  [KeyPlatform.Unknown]: {
    label: 'Sin determinar',
    short: '?',
    tone: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
    icon: 'help',
    inSteam: false,
  },
});