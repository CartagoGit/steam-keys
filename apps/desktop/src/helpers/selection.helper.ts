import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { KEY_STATUS_META } from '@/contracts/constants/key-status.constants';
import { normalizeTag } from '@/contracts/constants/tag.constants';
import type { IGameKey } from '@/contracts/interfaces/game-key.interface';

/**
 * Como de utilizable es una clave para la accion que se le pide.
 *
 * La distincion importa porque no todas las acciones valen para todo: no se
 * puede regalar algo que ya regalaste, ni canjear dos veces la misma clave, ni
 * dar por caducada una clave que ya caduco.
 */
export type SelectAction = 'export' | 'gift' | 'expire' | 'tags';

/** Por que una accion no se puede aplicar a una clave. */
export interface IBlockReason {
  action: SelectAction;
  /** Las claves que lo impiden, para poder nombrarlas en el aviso. */
  ids: readonly number[];
  /** Texto listo para el tooltip. */
  message: string;
}

/** Una clave, con los permisos ya resueltos para las acciones de la barra. */
export interface ISelectionFacts {
  total: number;
  /** Claves que se pueden regalar (exportar o marcar regaladas). */
  giftable: number;
  /** Claves sobre las que tiene sentido marcar caducadas. */
  expirable: number;
  /** Que acciones se pueden aplicar a la seleccion entera. */
  canExport: boolean;
  canGift: boolean;
  canExpire: boolean;
  canTag: boolean;
  /** Motivos de bloqueo, para los tooltips. Vacio si todo esta bien. */
  blocked: readonly IBlockReason[];
}

/**
 * Estados a los que tiene sentido cambiar una clave con la barra.
 *
 * Una clave ya regalada o canjeada no se puede "volver a disponible": la
 * verdad es que ya no la tienes, y marcarla como disponible seria mentira.
 */
export function isGiftable(entry: IGameKey): boolean {
  return entry.status === KeyStatus.Available;
}

/**
 * Una clave caducada solo se puede marcar como caducada si no lo estaba ya.
 *
 * Se pueden marcar como caducadas las disponibles, las regaladas y las
 * canjeadas: las tres pueden caducar despues de regalarse o de canjearse.
 */
export function isExpirable(entry: IGameKey): boolean {
  return entry.status !== KeyStatus.Expired;
}

/** Que acciones quedan bloqueadas para una seleccion concreta. */
export function analyzeSelection(
  selected: readonly IGameKey[],
  onlyAvailable: boolean,
): ISelectionFacts {
  const total = selected.length;
  const giftable = selected.filter(isGiftable).length;
  const expirable = selected.filter(isExpirable).length;

  const blocked: IBlockReason[] = [];

  const noRegalables = selected.filter((key) => !isGiftable(key));
  const noExpirables = selected.filter((key) => !isExpirable(key));

  // El interruptor "solo disponibles" es lo que hace validas las acciones de
  // regalar. Sin el, la seleccion puede ser cualquier cosa y entonces no se
  // sabe si es seguro exportar.
  const soloDisponibles = onlyAvailable && giftable === total;

  if (total === 0) {
    return {
      total: 0,
      giftable: 0,
      expirable: 0,
      canExport: false,
      canGift: false,
      canExpire: false,
      canTag: false,
      blocked: [],
    };
  }

  if (!soloDisponibles) {
    const motivo = noRegalables.length > 0 ? messageMixed(noRegalables) : messageToggle();

    blocked.push({ action: 'export', ids: noRegalables.map((key) => key.id), message: motivo });
    blocked.push({ action: 'gift', ids: noRegalables.map((key) => key.id), message: motivo });
  }

  if (expirable === 0) {
    blocked.push({
      action: 'expire',
      ids: noExpirables.map((key) => key.id),
      message: 'Todas las claves seleccionadas ya estaban caducadas.',
    });
  }

  return {
    total,
    giftable,
    expirable,
    canExport: soloDisponibles,
    canGift: soloDisponibles,
    canExpire: expirable > 0,
    canTag: true,
    blocked,
  };
}

/** El tooltip que explica por que no se puede exportar o regalar. */
function messageToggle(): string {
  return 'Activa «Solo disponibles» para poder regalar la seleccion.';
}

function messageMixed(noRegalables: readonly IGameKey[]): string {
  const estados = [...new Set(noRegalables.map((key) => KEY_STATUS_META[key.status].label))];

  if (estados.length === 1) {
    // El plural va con la etiqueta del estado: "3 claves regaladas" y no
    // "3 claves Regalada", que es lo que suena mal al leerlo. Las etiquetas
    // llegan en mayuscula porque son las de las pastillas, y aqui van en
    // minuscula porque van metidas en medio de la frase.
    const etiqueta = (estados[0] ?? '').toLowerCase();
    const plural = etiqueta.endsWith('a') ? `${etiqueta}s` : etiqueta;

    return `Hay ${noRegalables.length} claves ${plural} en la seleccion. Solo se pueden regalar las disponibles.`;
  }

  return `La seleccion mezcla estados (${estados.join(', ')}). Activa «Solo disponibles» para dejar fuera el resto.`;
}

/**
 * Cuantas claves de un titulo hay, para agrupar en la lista.
 *
 * Un mismo juego puede tener varias keys en la coleccion —una regalada, otra
 * canjeada, otra disponible— y son claves distintas, no filas repetidas: cada
 * una tiene su propio estado y su propio destinatario.
 */
export interface IGroupInfo {
  title: string;
  total: number;
  byStatus: Readonly<Record<string, number>>;
  /** Cuantas de este titulo estan disponibles. */
  available: number;
}

/** Clave con la que se agrupan los titulos, comparable entre si. */
export function claveGrupo(title: string): string {
  return normalizeTag(title)
    // `&` y `and` son la misma cosa escrita de dos maneras, y en los titulos
    // viejos alternan: "Knights of Pen and Paper" y "Pen & Paper" son el mismo
    // juego y deben caer en el mismo grupo.
    .replace(/\band\b/g, '&')
    // `+ 1` y `+1` tampoco son dos juegos distintos.
    .replace(/\s*([+])\s*/g, ' $1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Cuenta las claves por titulo, sin distinguir mayusculas ni acentos. */
export function groupByTitle(keys: readonly IGameKey[]): ReadonlyMap<string, IGroupInfo> {
  const mapa = new Map<string, IGroupInfo>();

  for (const key of keys) {
    const clave = claveGrupo(key.title);
    const actual = mapa.get(clave);

    if (!actual) {
      mapa.set(clave, {
        title: key.title,
        total: 1,
        byStatus: { [key.status]: 1 },
        available: isGiftable(key) ? 1 : 0,
      });
      continue;
    }

    const byStatus = { ...actual.byStatus };
    byStatus[key.status] = (byStatus[key.status] ?? 0) + 1;

    mapa.set(clave, {
      title: actual.title,
      total: actual.total + 1,
      byStatus,
      available: actual.available + (isGiftable(key) ? 1 : 0),
    });
  }

  return mapa;
}

/** Numero de claves que comparten titulo con esta. 1 si esta sola. */
export function siblingsOf(
  entry: IGameKey,
  todas: readonly IGameKey[],
): number {
  const clave = claveGrupo(entry.title);

  return todas.filter((key) => claveGrupo(key.title) === clave).length;
}