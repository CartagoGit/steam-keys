import { GIFTABLE_STATUSES, KeyKind, KeyPlatform, KeyScope, KeySort, KeyStatus, type IGameKey, type IKeyFilter, type IKeyStats } from '@/contracts';

/**
 * Filtro por defecto: solo las claves que siguen disponibles.
 *
 * Con cuatrocientas claves de las que mas de la mitad ya se han regalado o
 * canjeado, lo util por defecto es "las que aun tengo en la mano". Ver la
 * coleccion entera se pide explicitamente con "Todos".
 *
 * `excluir` es el unico modo de los tres, porque el candado solo lo lleva el
 * filtro de etiquetas: plataforma y estado son un valor por clave, y ahi el AND
 * no existe.
 */
export function emptyFilter(): IKeyFilter {
  return {
    search: '',
    scope: KeyScope.Available,
    kind: KeyKind.All,
    platforms: [],
    statuses: [],
    tags: [],
    excluir: false,
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
  const tags = new Set<string>(filter.tags);

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

    // Plataforma y estado acotan y nada mas: sin marcadas no se filtra, y con
    // marcadas sale lo que las lleva. No hay segundo modo porque una clave
    // tiene una sola de cada —ver `IKeyFilter`.
    if (platforms.size > 0 && !platforms.has(key.platform)) return false;
    if (statuses.size > 0 && !statuses.has(key.status)) return false;

    /**
     * Varias etiquetas a la vez son **OR** por defecto: con «canducadas» y
     * «regalo» marcadas sale lo que lleva cualquiera de las dos, que es lo que
     * se espera al buscar «lo mio de este tema».
     *
     * Con `excluir` se invierte a **AND**: hay que llevar las todas. Es el otro
     * filtro que se quiere a veces —«cumplidos **y** regalados»— y con OR no
     * hay manera de pedirlo. Es el unico filtro que puede pedir las dos cosas,
     * porque una clave lleva todas las etiquetas que lleva.
     *
     * Con ninguna marcada no dice nada, asi que el `size > 0` sale antes y en
     * los dos modos se ve la lista entera. Con AND y cero marcadas, «tiene
     * todos los vacios» es cierto para todo, asi que tambien daria todo —pero
     * explicitandolo se entiende que el filtro esta apagado, que es distinto.
     */
    if (tags.size > 0) {
      if (filter.excluir) {
        if (![...tags].every((tag) => key.tags.includes(tag))) return false;
      } else if (!key.tags.some((tag) => tags.has(tag))) {
        return false;
      }
    }

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

/*
 * Aqui **no** hay un agrupar-por-titulo.
 *
 * Habia uno, y llevaba el mismo nombre que el de `selection.helper`, que si se
 * usa. La guarda de codigo muerto lo daba por vivo porque encontraba una
 * llamada con ese nombre, que era la del otro fichero: dos funciones
 * llamadas igual tapando la muerte la una de la otra. Renombrarlas —esta
 * `clavesPorTitulo` y la otra `resumenPorTitulo`— fue lo que dejo ver que
 * esta no la llamaba nadie, y se borro.
 */

function normalize(value: string): string {
  return value.trim().toLowerCase();
}