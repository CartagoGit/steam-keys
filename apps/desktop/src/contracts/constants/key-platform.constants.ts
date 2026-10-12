import { KeyPlatform, KEY_PLATFORM_VALUES } from '../enums/key-platform.enum';
import type { IconName } from '../interfaces/icon-name.interface';
import type { IMetaOption } from '../interfaces/meta-option.interface';
import type { TranslationKey, TranslationTable } from './i18n.constants';

export interface IPlatformMeta {
  /**
   * Nombre de la plataforma, o **clave de traduccion** si hay que traducirlo.
   *
   * Casi todas son nombres propios que no se traducen ("Steam", "Blade &
   * Soul"), pero "Sin determinar" si lo es y estaba escrito aqui en
   * castellano: salia "Sin determinar" en medio de una lista en portugues.
   * Por eso el campo admite las dos cosas, igual que hacia
   * `statusMeta()` con los estados.
   */
  label: string | TranslationKey;
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
    label: 'platform.unknown',
    short: '?',
    tone: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
    icon: 'help',
    inSteam: false,
  },
});
/**
 * Nombre de la plataforma ya traducido, o su clave si no hay que traducirla.
 *
 * Los nombres propios se devuelven tal cual porque no tienen traduccion: si no
 * fueran un caso especial habria que meter los siete en el diccionario, y el
 * casteellano de "Steam" en el diccionario castellano seria absurdo.
 */
export function platformLabel(platform: KeyPlatform, tabla: TranslationTable): string {
  const { label } = KEY_PLATFORM_META[platform];

  // `in tabla` no estrecha el tipo, asi que se comprueba con `undefined`: una
  // clave presente siempre tiene texto, y una ausente devuelve undefined.
  return tabla[label] ?? label;
}

/**
 * Las plataformas como opciones de desplegable, ya traducidas.
 *
 * Igual que `statusOptions`, y por el mismo motivo: sale de `KEY_PLATFORM_META`,
 * que es el mismo objeto del que saca su color el chip de plataforma que hay en
 * la tabla. Cambiar el color de Steam en un sitio lo cambia en los dos.
 */
export function platformOptions(tabla: TranslationTable): readonly IMetaOption[] {
  return KEY_PLATFORM_VALUES.map((platform) => {
    const meta = KEY_PLATFORM_META[platform];

    return {
      value: platform,
      label: platformLabel(platform, tabla),
      short: meta.short,
      icon: meta.icon,
      tone: meta.tone,
    };
  });
}
