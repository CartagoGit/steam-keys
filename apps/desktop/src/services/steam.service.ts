import { steamGet } from './steam-http.service';
import type { IGameKey, ISteamOwnedGame, ISteamStoreApp, MatchConfidence } from '@/contracts';
import { normalizeForMatch } from '@/helpers/match-title.helper';

const WEB_API = 'https://api.steampowered.com';
const STORE_API = 'https://store.steampowered.com/api';

/** Error con mensaje en castellano, para poder enseñarlo tal cual. */
export class SteamError extends Error {
  constructor(
    message: string,
    readonly codigo:
      | 'sinClave'
      | 'idInvalido'
      | 'perfilPrivado'
      | 'http'
      | 'vacio',
  ) {
    super(message);
    this.name = 'SteamError';
  }
}

/**
 * Cliente de Steam.
 *
 * Mezcla dos APIs que se comportan de forma muy distinta:
 *
 * - `ISteamUser/GetOwnedGames` necesita clave, y devuelve **tu** biblioteca.
 * - `store.steampowered.com/api` es publica y no necesita clave, y trae el
 *   nombre, el genero, las caracteristicas y las resenas de cualquier juego.
 *
 * Separarlas importa: la parte que da valor a la app (puntuaciones, metadatos)
 * funciona sin cuenta, y la parte que necesita tu permiso se degrada con
 * elegancia si no lo has dado.
 */
/**
 * Traduce lo que la persona escribe a un SteamID de 17 cifras.
 *
 * Hay dos formas de identificar una cuenta y la gente no sabe cual tiene: el
 * numero de 17 cifras (`7656119…`) o el nombre de perfil, que es lo que sale
 * en la direccion de la web, en `steamcommunity.com/id/tunombre`. Admitir las
 * dos evita tener que buscar el numero a mano, que es el rodeo que hace que la
 * gente se rinda y no conecte la cuenta.
 *
 * El nombre se resuelve contra el XML publico del perfil, que **no necesita
 * clave de API**: asi se puede averiguar el ID antes de tener la clave, y un
 * nombre mal escrito se detecta aqui con un mensaje claro en vez de devolver
 * un error de autorizacion mas adelante que no explica nada.
 */
export async function resolveSteamId(entrada: string): Promise<string> {
  const limpio = entrada.trim();

  if (/^7656119\d{10}$/.test(limpio)) return limpio;

  const handle = limpio
    .replace(/^https?:\/\/steamcommunity\.com\//i, '')
    .replace(/^id\//i, '')
    .replace(/[/?#].*$/, '')
    .trim();

  // Un SteamID de 32 digitos es el de la API v2 y tambien vale, pero no hay
  // conversion publica fiable de uno a otro, asi que se pasa sin tocar.
  if (/^\d{32}$/.test(handle)) return handle;

  if (!/^[a-z0-9._-]{2,32}$/i.test(handle)) {
    throw new SteamError(
      'Eso no parece un ID de Steam ni un nombre de perfil.',
      'idInvalido',
    );
  }

let cuerpo: string;

try {
    // La peticion va por Rust cuando se puede: `steamcommunity.com` no manda
    // cabeceras CORS y el navegador la rechazaria antes de salir.
    cuerpo = await steamGet(
      `steamcommunity.com/id/${encodeURIComponent(handle)}/?xml=1`,
    );
  } catch (cause) {
    throw new SteamError(
      cause instanceof Error
        ? `No se pudo consultar Steam: ${cause.message}`
        : 'No se pudo contactar con Steam.',
      'http',
    );
  }

  // Steam **no** devuelve un 404 cuando el perfil no existe: responde con un
  // 200 y el error va dentro del propio XML. Sin mirar esto, un nombre mal
  // escrito se cuela como si fuera bueno y el fallo aparece mas tarde como
  // una biblioteca vacia, que no explica nada.
  const error = /<error><!\[CDATA\[([^\]]+)\]\]><\/error>/.exec(cuerpo)?.[1];

  if (error) {
    throw new SteamError(
      `No hay ningun perfil con el nombre "${handle}".`,
      'idInvalido',
    );
  }

  const id = /<steamID64>(\d{17})<\/steamID64>/.exec(cuerpo)?.[1];

  if (!id) {
    throw new SteamError(
      `No se pudo leer el ID del perfil "${handle}".`,
      'idInvalido',
    );
  }

  return id;
}

export const steamService = {
  /** Tu biblioteca. Necesita clave. */
  async getOwnedGames(apiKey: string, steamId: string): Promise<ISteamOwnedGame[]> {
    const url =
      `${WEB_API}/ISteamUser/GetOwnedGames/v0001/` +
      `?key=${encodeURIComponent(apiKey)}` +
      `&steamid=${encodeURIComponent(steamId)}` +
      `&include_appinfo=1&include_played_free_games=1`;

    const datos = await pedirJson<{ response?: { games?: unknown[] } }>(url);

    const juegos = datos.response?.games;

    if (!Array.isArray(juegos)) {
      // Steam devuelve un objeto vacio sin error cuando la clave es valida pero
      // el perfil es privado. Es el fallo mas desconcertante que hay, asi que
      // se distingue del resto para poder explicarlo bien.
      throw new SteamError(
        'La biblioteca vino vacia. Comprueba que tu perfil sea publico.',
        'perfilPrivado',
      );
    }

    return juegos.map(normalizarJuego);
  },

  /**
   * Busca un juego por nombre.
   *
   * Es la parte fragil: devuelve tambien los DLC y las ediciones sueltas, que
   * es exactamente lo que hace que el emparejamiento no sea de fiar. Por eso
   * quien llama tiene que mirar los candidatos, no coger el primero.
   */
  async search(term: string): Promise<readonly ISteamOwnedGame[]> {
    const url =
      `${STORE_API}/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=us`;

    const datos = await pedirJson<{
      items?: { type?: string; name?: string; id?: number }[];
    }>(url);

    return (datos.items ?? [])
      .filter((item) => item.type === 'app' && typeof item.id === 'number')
      .map((item) => ({
        appId: item.id as number,
        name: item.name ?? '',
        playtimeForever: 0,
        lastPlayed: 0,
        isDlc: false,
        iconUrl: null,
      }));
  },

  /** Datos publicos de un juego. No necesita clave. */
  async getStoreApp(appId: number): Promise<ISteamStoreApp | null> {
    const url = `${STORE_API}/appdetails?appids=${appId}&l=english&cc=us`;

    const datos = await pedirJson<Record<string, { success?: boolean; data?: unknown }>>(
      url,
    );

    const entrada = datos[String(appId)];

    if (!entrada?.success || !entrada.data) return null;

    return normalizarTienda(entrada.data as IStorePayload, appId);
  },

  /** Puntuaciones de resenas. No necesita clave. */
  async getReviews(appId: number): Promise<
    Pick<
      ISteamStoreApp,
      | 'reviewScore'
      | 'reviewScoreDesc'
      | 'totalReviews'
      | 'totalPositive'
      | 'totalNegative'
      | 'recentPositiveRatio'
      | 'recentTotal'
    > | null
  > {
    const url =
      `${STORE_API}/appreviews/${appId}` +
      '?json=1&language=all&purchase_type=all&num_per_page=0';

    try {
      const datos = await pedirJson<{
        success?: number;
        query_summary?: {
          review_score?: number;
          review_score_desc?: string;
          total_reviews?: number;
          total_positive?: number;
          total_negative?: number;
        };
      }>(url);

      if (!datos.success) return null;

      const resumen = datos.query_summary ?? {};

      return {
        reviewScore: resumen.review_score ?? null,
        reviewScoreDesc: resumen.review_score_desc ?? null,
        totalReviews: resumen.total_reviews ?? 0,
        totalPositive: resumen.total_positive ?? 0,
        totalNegative: resumen.total_negative ?? 0,
        // La API publica no da el desglose de 30 dias: `filter=recent` y
        // `day_range` devuelven exactamente lo mismo que sin filtro. Se deja en
        // null en vez de inventar un numero.
        recentPositiveRatio: null,
        recentTotal: null,
      };
    } catch {
      return null;
    }
  },
};

interface IStorePayload {
  name?: string;
  type?: string;
  metacritic?: { score?: number };
  recommendations?: { total?: number };
  developers?: string[];
  publishers?: string[];
  genres?: { description: string }[];
  categories?: { id: number; description: string }[];
  price_overview?: { final_formatted?: string };
  header_image?: string;
}

function normalizarTienda(datos: IStorePayload, appId: number): ISteamStoreApp {
  const categorias = datos.categories ?? [];
  const esDlc = datos.type === 'dlc' || categorias.some((c) => c.id === 21);

  return {
    appId,
    name: datos.name ?? '',
    type: esDlc ? 'dlc' : 'game',
    developers: datos.developers ?? [],
    publishers: datos.publishers ?? [],
    genres: (datos.genres ?? []).map((genero) => genero.description),
    categories: categorias.map((categoria) => categoria.description),
    metacritic: datos.metacritic?.score ?? null,
    reviewScore: null,
    reviewScoreDesc: null,
    totalReviews: datos.recommendations?.total ?? 0,
    totalPositive: 0,
    totalNegative: 0,
    recentPositiveRatio: null,
    recentTotal: null,
    price: datos.price_overview?.final_formatted ?? null,
    headerImage: datos.header_image ?? null,
  };
}

function normalizarJuego(bruto: unknown): ISteamOwnedGame {
  const item = bruto as {
    appid?: number;
    name?: string;
    playtime_forever?: number;
    rtime_last_played?: number;
    img_icon_url?: string;
  };

  const appId = item.appid ?? 0;

  return {
    appId,
    name: item.name ?? '',
    playtimeForever: item.playtime_forever ?? 0,
    lastPlayed: item.rtime_last_played ?? 0,
    isDlc: false,
    iconUrl: item.img_icon_url
      ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${item.img_icon_url}.jpg`
      : null,
  };
}

async function pedirJson<T>(url: string): Promise<T> {
  const respuesta = await fetch(url);

  if (!respuesta.ok) {
    if (respuesta.status === 403 || respuesta.status === 401) {
      throw new SteamError('La clave de la API no es valida.', 'idInvalido');
    }

    throw new SteamError('Steam no ha contestado.', 'http');
  }

  return (await respuesta.json()) as T;
}

/* -------------------------------------------------------------------------- */
/*                        Emparejamiento de nombres                            */
/* -------------------------------------------------------------------------- */

/**
 * Coletillas que distinguen una edicion de otra.
 *
 * Es la razon por la que el emparejamiento por nombre no puede ser de fiar: dos
 * claves del mismo juego pueden llamarse casi igual y ser **juegos distintos**
 * en Steam. Un "GOTY Edition" y la edicion normal son el mismo appid, pero un
 * "Snowfall" es un DLC con appid propio. Quitar estas palabras reduce el ruido,
 * pero no lo elimina, y por eso el resultado lleva confianza.
 */
/**
 * Quita la coletilla de edicion de un nombre y lo deja comparable.
 *
 * "Middle-earth: Shadow of Mordor GOTY Edition" pasa a ser "middle earth shadow
 * of mordor", que ya se parece a lo que Steam llama al juego base. De paso se
 * quitan los signos de puntuacion, porque "Cities: Skylines" y "Cities
 * Skylines" son el mismo juego escritos de dos formas y sale mas a cuenta
 * compararlos asi que puntuando cada letra.
 */
/**
 * Que tan parecidas son dos cadenas, de 0 a 1.
 *
 * Se usa la distancia de Levenshtein normalizada porque "Cities Skylines" y
 * "Cities: Skylines" solo se diferencian en un caracter, mientras que "Witcher"
 * y "Twisted Metal" no tienen nada que ver. Comparar palabras sueltas daria
 * falsos positivos en titulos cortos.
 */
export function similarity(a: string, b: string): number {
  const x = normalizeForMatch(a);
  const y = normalizeForMatch(b);

  if (x === y) return 1;
  if (x.length === 0 || y.length === 0) return 0;

  const distancia = levenshtein(x, y);
  const largo = Math.max(x.length, y.length);

  return 1 - distancia / largo;
}

/** Distancia de Levenshtein, con dos filas en vez de una matriz entera. */
export function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  let actual = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    actual[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;

      actual[j] = Math.min(
        (actual[j - 1] ?? 0) + 1,
        (anterior[j] ?? 0) + 1,
        (anterior[j - 1] ?? 0) + coste,
      );
    }

    [anterior, actual] = [actual, anterior];
  }

  return anterior[b.length] ?? a.length;
}

/** Que confianza merece un emparejamiento segun lo que se parece el nombre. */
export function confidenceFor(similitud: number, candidatos: number): MatchConfidence {
  if (similitud >= 0.97) return 'exact';
  if (similitud >= 0.85) return candidatos === 1 ? 'likely' : 'loose';
  if (similitud >= 0.7) return 'loose';
  return 'none';
}

/**
 * Elige el mejor candidato de una busqueda para un titulo dado.
 *
 * No devuelve el primero: elige el que mas se parezca y **descarta los DLC**
 * cuando hay un juego normal con parecido parecido, porque lo que se busca es
 * "tengo este juego", no "tengo este contenido extra". Si solo hay DLC, se
 * devuelve igualmente, que es mejor que un "no lo tienes" cuando lo que hay es
 * el juego.
 */
export function bestCandidate(
  title: string,
  candidatos: readonly ISteamOwnedGame[],
): { elegido: ISteamOwnedGame | null; confianza: MatchConfidence; puntuaciones: number[] } {
  if (candidatos.length === 0) {
    return { elegido: null, confianza: 'none', puntuaciones: [] };
  }

  const puntuados = candidatos
    .map((candidato) => ({
      candidato,
      puntuacion: similarity(title, candidato.name),
    }))
    .sort((a, b) => b.puntuacion - a.puntuacion);

  const puntuaciones = puntuados.map((p) => p.puntuacion);
  const mejor = puntuados[0];

  if (!mejor) {
    return { elegido: null, confianza: 'none', puntuaciones };
  }

  // Si el mejor es un DLC pero hay un juego normal casi igual de parecido, se
  // prefiere el juego normal: es casi siempre el que se quiere decir.
  if (mejor.candidato.isDlc) {
    const juego = puntuados.find((p) => !p.candidato.isDlc);

    if (juego && juego.puntuacion >= mejor.puntuacion - 0.05) {
      return {
        elegido: juego.candidato,
        confianza: confidenceFor(juego.puntuacion, candidatos.length),
        puntuaciones,
      };
    }
  }

  return {
    elegido: mejor.candidato,
    confianza: confidenceFor(mejor.puntuacion, candidatos.length),
    puntuaciones,
  };
}

/** Todas las claves que comparten el nombre mas limpio, para agruparlas. */
export function keysMatching(
  keys: readonly IGameKey[],
  title: string,
): readonly IGameKey[] {
  const objetivo = normalizeForMatch(title);

  return keys.filter((key) => normalizeForMatch(key.title) === objetivo);
}