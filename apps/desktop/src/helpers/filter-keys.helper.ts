import { GIFTABLE_STATUSES } from '@/contracts/enums/key-status.enum';
import { KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KeySort } from '@/contracts/enums/key-sort.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { keyFingerprint } from '@/helpers/normalize-text.helper';
import type { IGameKey } from '@/contracts/interfaces/game-key.interface';
import type {
  IKeyFilter,
  IKeyStats,
} from '@/contracts/interfaces/key-filter.interface';

/** Filtro vacio: no restringe nada. */
export function emptyFilter(): IKeyFilter {
  return {
    search: '',
    platforms: [],
    statuses: [],
    onlyGiftable: false,
    onlyAddOns: false,
  };
}

/** Aplica busqueda, plataformas, estados y los interruptores rapidos. */
export function filterKeys(
  keys: readonly IGameKey[],
  filter: IKeyFilter,
): readonly IGameKey[] {
  const needle = normalize(filter.search);
  const platforms = new Set<KeyPlatform>(filter.platforms);
  const statuses = new Set<KeyStatus>(filter.statuses);
  const giftable = new Set<KeyStatus>(GIFTABLE_STATUSES);

  return keys.filter((key) => {
    if (platforms.size > 0 && !platforms.has(key.platform)) return false;
    if (statuses.size > 0 && !statuses.has(key.status)) return false;
    if (filter.onlyGiftable && !giftable.has(key.status)) return false;
    if (filter.onlyAddOns && !key.parentTitle) return false;

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

/** Orden estable segun el criterio elegido. */
export function sortKeys(keys: readonly IGameKey[], sort: KeySort): readonly IGameKey[] {
  const sorted = [...keys];

  switch (sort) {
    case KeySort.Alfabetico:
      return sorted.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    case KeySort.Estado:
      return sorted.sort(
        (a, b) =>
          a.status.localeCompare(b.status, 'es') ||
          a.title.localeCompare(b.title, 'es'),
      );
    case KeySort.Plataforma:
      return sorted.sort(
        (a, b) =>
          a.platform.localeCompare(b.platform, 'es') ||
          a.title.localeCompare(b.title, 'es'),
      );
    case KeySort.Reciente:
    default:
      return sorted.sort(
        (a, b) =>
          (b.addedOn ?? b.createdAt).localeCompare(a.addedOn ?? a.createdAt) ||
          a.title.localeCompare(b.title, 'es'),
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

  for (const key of keys) {
    byPlatform[key.platform] = (byPlatform[key.platform] ?? 0) + 1;

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