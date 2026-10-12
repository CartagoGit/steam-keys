import { KeyStatus, KEY_STATUS_VALUES } from '../enums/key-status.enum';
import type { IconName } from '../interfaces/icon-name.interface';
import type { IMetaOption } from '../interfaces/meta-option.interface';
import type { TranslationTable } from './i18n.constants';

/**
 * Los colores van con los colores **semanticos** (`bg-ok`, `text-warn`…) y no
 * con tonos fijos de la rampa de Tailwind.
 *
 * Con `bg-emerald-500/15 text-emerald-300` la pastilla se ve bien en los temas
 * oscuros y se lava en los claros: un verde claro sobre un crema no se lee.
 * Cada tema declara sus propios tonos de estado en `styles/index.css`, asi que
 * aqui solo se dice que papel juega cada estado y el color lo pone el tema.
 *
 * Lo unico que **no** vive aqui son las etiquetas: ver `statusMeta`.
 */
export interface IStatusMeta {
  /** Clave de traduccion de la etiqueta. */
  labelKey: string;
  /** Clave de traduccion de la explicacion corta. */
  hintKey: string;
  tone: string;
  icon: IconName;
}

/** El estado ya resuelto en el idioma que hay en pantalla. */
export interface IStatusMetaResuelta {
  label: string;
  hint: string;
  tone: string;
  icon: IconName;
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
    labelKey: 'status.available',
    hintKey: 'status.hint.available',
    tone: 'bg-ok/15 text-ok ring-ok/30',
    icon: 'gift',
  },
  [KeyStatus.Gifted]: {
    labelKey: 'status.gifted',
    hintKey: 'status.hint.gifted',
    tone: 'bg-hover text-t3 ring-line',
    icon: 'hand',
  },
  [KeyStatus.Redeemed]: {
    labelKey: 'status.redeemed',
    hintKey: 'status.hint.redeemed',
    tone: 'bg-info/15 text-info ring-info/30',
    icon: 'check',
  },
  [KeyStatus.Expired]: {
    labelKey: 'status.expired',
    hintKey: 'status.hint.expired',
    tone: 'bg-danger/15 text-danger ring-danger/30',
    icon: 'alert',
  },
  [KeyStatus.Unknown]: {
    labelKey: 'status.unknown',
    hintKey: 'status.hint.unknown',
    tone: 'bg-warn/15 text-warn ring-warn/30',
    icon: 'help',
  },
});

/**
 * Los mismos metadatos, pero ya traducidos.
 *
 * Antes las etiquetas estaban escritas aqui en espanol y ningun componente las
 * traducía, asi que la pastilla de estado de cada fila —la cosa que mas se lee
 * de la app— salia siempre en espanol, incluso en la version inglesa. Las
 * claves viven en el diccionario y por aqui solo se resuelven.
 */
export function statusMeta(
  status: KeyStatus,
  t: TranslationTable,
): IStatusMetaResuelta {
  const meta = KEY_STATUS_META[status];

  return {
    label: t[meta.labelKey] ?? meta.labelKey,
    hint: t[meta.hintKey] ?? meta.hintKey,
    tone: meta.tone,
    icon: meta.icon,
  };
}

/**
 * Los estados como opciones de desplegable, ya traducidas.
 *
 * No es una lista paralela a `KEY_STATUS_META`: sale de ahi, con el mismo
 * `statusMeta` que pinta la pastilla de cada fila. Es lo que permite que el
 * desplegable del editor se vea igual que la tabla —mismo color, mismo icono—
 * sin que haya que acordarse de mantener las dos cosas en paralelo.
 *
 * Antes el editor usaba un `<select>` nativo, que solo admite texto: el estado
 * se elegia leyendo cinco palabras en fila y sin ningun color que indicara cual
 * era cual.
 */
export function statusOptions(t: TranslationTable): readonly IMetaOption[] {
  return KEY_STATUS_VALUES.map((status) => {
    const meta = statusMeta(status, t);

    return { value: status, label: meta.label, icon: meta.icon, tone: meta.tone };
  });
}
