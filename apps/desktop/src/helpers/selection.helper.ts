import { KeyStatus } from '@/contracts/enums/key-status.enum';
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
 * Quita de la seleccion lo que ya no se esta viendo.
 *
 * El problema que resuelve: se seleccionan veinte claves, se cambia un filtro y
 * la lista ya no las enseña, pero **siguen seleccionadas**. La barra de
 * acciones sigue diciendo «20 seleccionadas» y un «Exportar» se lleva veinte
 * claves de las cuales solo se ven cuatro. Y peor: no hay forma de saber
 * cuales son, porque las que no estan en pantalla no tienen fila donde mirar su
 * casilla y desmarcarla.
 *
 * La regla es una sola: **lo que se marca es lo que se ve**. Si una clave deja
 * de estar en la lista, deja de estar marcada. Asi el recuento de la barra
 * siempre describe algo que la persona puede comprobar en pantalla.
 *
 * Devuelve **el mismo conjunto** cuando no hay nada que quitar, y eso no es un
 * detalle: React compara por referencia, y construir un `Set` nuevo con el
 * mismo contenido haria que el efecto que llama a esta funcion se volviera a
 * disparar, que devolveria otro `Set` nuevo, y asi hasta el infinito.
 */
export function podarSeleccion(
  seleccion: ReadonlySet<number>,
  visibles: readonly IGameKey[],
): ReadonlySet<number> {
  const enPantalla = new Set<number>();
  for (const key of visibles) enPantalla.add(key.id);

  const siguiente = new Set<number>();
  let cambia = false;

  for (const id of seleccion) {
    if (enPantalla.has(id)) siguiente.add(id);
    else cambia = true;
  }

  return cambia ? siguiente : seleccion;
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

/**
 * Que acciones quedan bloqueadas para una seleccion concreta.
 *
 * `scopeVisible` dice si lo que se esta viendo son solo claves disponibles, y
 * es lo que hace validas las acciones de regalar **sin interruptor**.
 *
 * Antes el parametro era un interruptor propio de la barra de seleccion, y
 * entonces el filtro de la barra de filtros no hacia falta para el alcance:
 * eran dos controles para lo mismo, y el equivocado se pulsaba sin ningun
 * efecto visible. Ahora el alcance sale del filtro, que es donde ya se mira
 * para saber que se esta viendo.
 */
export function analyzeSelection(
  selected: readonly IGameKey[],
  scopeVisible: boolean,
): ISelectionFacts {
  const total = selected.length;
  const giftable = selected.filter(isGiftable).length;
  const expirable = selected.filter(isExpirable).length;

  const blocked: IBlockReason[] = [];

  const noRegalables = selected.filter((key) => !isGiftable(key));
  const noExpirables = selected.filter((key) => !isExpirable(key));

  // Con el filtro en «Solo disponibles» lo que se ve ya es todo regalable, y
  // la seleccion no puede contener ninguna que no lo sea. Con el filtro en
  // «Todos», la seleccion puede ser de cualquier estado y entonces regalar no
  // es valido para el conjunto.
  const soloDisponibles = scopeVisible && giftable === total;

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
    // El mensaje no repite el recuento: la cabecera de la barra de seleccion
    // ya dice cuantas hay de cada. Aqui va lo que **falta por hacer**, que es
    // lo unico que no se deduce leyendo la cabecera.
    //
    // El numero va en plural solo si corresponde. "esas 1" se lee mal y el
    // usuario lo nota, porque es justo el texto que va debajo del boton.
    const motivo =
      noRegalables.length === 1
        ? 'Cambia el filtro a «Solo disponibles» para dejar fuera esa 1'
        : noRegalables.length > 1
          ? `Cambia el filtro a «Solo disponibles» para dejar fuera esas ${noRegalables.length}`
          : 'Cambia el filtro a «Solo disponibles» para poder actuar sobre la seleccion';

    blocked.push({ action: 'export', ids: noRegalables.map((key) => key.id), message: motivo });
    blocked.push({ action: 'gift', ids: noRegalables.map((key) => key.id), message: motivo });
  }

  if (expirable === 0) {
    blocked.push({
      action: 'expire',
      ids: noExpirables.map((key) => key.id),
      message: 'Ya estaban todas caducadas',
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