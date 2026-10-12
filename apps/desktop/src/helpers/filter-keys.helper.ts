import { GIFTABLE_STATUSES, KeyKind, KeyPlatform, KeyScope, KeySort, KeyStatus, type IGameKey, type IKeyFilter, type IKeyStats } from '@/contracts';
import { keyFingerprint } from '@/helpers/normalize-text.helper';

/**
 * Filtro por defecto: solo las claves que siguen disponibles.
 *
 * Con cuatrocientas claves de las que mas de la mitad ya se han regalado o
 * canjeado, lo util por defecto es "las que aun tengo en la mano". Ver la
 * coleccion entera se pide explicitamente con "Todos".
 */
export function emptyFilter(): IKeyFilter {
  return {
    search: '',
    scope: KeyScope.Available,
    kind: KeyKind.All,
    platforms: [],
    statuses: [],
  };
}

/**
 * Aplica busqueda, ambito, tipo, plataformas y estados.
 *
 * Los grupos de chips (plataforma y estado) se ignoran cuando su selector
 * principal esta en modo restrictivo: en "solo disponibles", marcar "regalada"
 * no puede tener ningun sentido, asi que el chip se apaga en vez de dejar
 * combinaciones que devuelven siempre la lista vacia. El de tipo no se ignora
 * nunca, porque acota por un eje distinto — DLC o juego — y no por estado.
 */
export function filterKeys(
  keys: readonly IGameKey[],
  filter: IKeyFilter,
): readonly IGameKey[] {
  const needle = normalize(filter.search);
  const platforms = new Set<KeyPlatform>(filter.platforms);
  const giftable = new Set<KeyStatus>(GIFTABLE_STATUSES);

  // El filtro de estado solo cuenta cuando el ambito es "todos"; si ya estamos
  // en "solo disponibles", el estado no se puede acotar mas.
  const statuses =
    filter.scope === KeyScope.All
      ? new Set<KeyStatus>(filter.statuses)
      : new Set<KeyStatus>();

  return keys.filter((key) => {
    if (filter.scope === KeyScope.Available && !giftable.has(key.status)) {
      return false;
    }

    if (filter.kind === KeyKind.Games && key.parentTitle) return false;
    if (filter.kind === KeyKind.Dlc && !key.parentTitle) return false;

    if (platforms.size > 0 && !platforms.has(key.platform)) return false;
    if (statuses.size > 0 && !statuses.has(key.status)) return false;

    if (needle.length === 0) return true;

    const haystack = normalize(
      [
        key.title,
        key.keyValue,
        key.giftedTo ?? '',
        key.note ?? '',
        key.parentTitle ?? '',
        key.tags.join(' '),
      ].join(' '),
    );

    return haystack.includes(needle);
  });
}


/**
 * Orden estable segun el criterio elegido.
 *
 * Todas las ramas acaban en `id`: dos claves con el mismo titulo —el mismo
 * juego con dos claves, que es lo normal— comparten todos los campos por los
 * que se ordena, y sin ese desempate el orden entre ellas depende de como
 * llegara cada lista. Se notaba al quitar un filtro: las filas cambiaban de
 * sitio sin que hubiera cambiado nada.
 */
export function sortKeys(keys: readonly IGameKey[], sort: KeySort): readonly IGameKey[] {
  const sorted = [...keys];

  switch (sort) {
    case KeySort.Alfabetico:
      return sorted.sort(
        (a, b) => a.title.localeCompare(b.title, 'es') || a.id - b.id,
      );
    case KeySort.Estado:
      return sorted.sort(
        (a, b) =>
          a.status.localeCompare(b.status, 'es') ||
          a.title.localeCompare(b.title, 'es') ||
          a.id - b.id,
      );
    case KeySort.Plataforma:
      return sorted.sort(
        (a, b) =>
          a.platform.localeCompare(b.platform, 'es') ||
          a.title.localeCompare(b.title, 'es') ||
          a.id - b.id,
      );
    case KeySort.Reciente:
    default:
      return sorted.sort(
        (a, b) =>
          (b.addedOn ?? b.createdAt).localeCompare(a.addedOn ?? a.createdAt) ||
          a.title.localeCompare(b.title, 'es') ||
          a.id - b.id,
      );
  }
}

/** Recuento por estado, plataforma y total visible. */
export function computeStats(
  keys: readonly IGameKey[],
  visible: number,
): IKeyStats {
  const byPlatform: Record<string, number> = {};

  let available = 0;
  let gifted = 0;
  let redeemed = 0;
  let expired = 0;
  let unknown = 0;
  let games = 0;
  let addOns = 0;

  for (const key of keys) {
    byPlatform[key.platform] = (byPlatform[key.platform] ?? 0) + 1;

    if (key.parentTitle) addOns += 1;
    else games += 1;

    switch (key.status) {
      case KeyStatus.Available:
        available += 1;
        break;
      case KeyStatus.Gifted:
        gifted += 1;
        break;
      case KeyStatus.Redeemed:
        redeemed += 1;
        break;
      case KeyStatus.Expired:
        expired += 1;
        break;
      default:
        unknown += 1;
    }
  }

  return {
    total: keys.length,
    available,
    gifted,
    redeemed,
    expired,
    unknown,
    games,
    addOns,
    byPlatform,
    visible,
  };
}

/** Agrupa las keys por titulo normalizado: un juego con varias claves. */
export function groupByTitle(keys: readonly IGameKey[]): ReadonlyMap<string, IGameKey[]> {
  const groups = new Map<string, IGameKey[]>();

  for (const key of keys) {
    const fingerprint = keyFingerprint(key.title);
    const bucket = groups.get(fingerprint);

    if (bucket) bucket.push(key);
    else groups.set(fingerprint, [key]);
  }

  return groups;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}