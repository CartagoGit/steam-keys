import { steamGet } from './steam-http.service';
import type { ISteamOwnedGame, ISteamStoreApp, MatchConfidence } from '@/contracts';
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
      | 'vacio'
      /**
       * El propio usuario pulso la X. No es un fallo y no se enseña como tal:
       * avisar de un error que ha pedido el usuario es la peor forma de
       * confirmar que se le ha parado algo.
       */
      | 'cancelado'
      /**
       * Steam ha dicho «has ido demasiado rapido» (429). Tampoco es un fallo
       * para el usuario: lo resuelve quien llama esperando y reintentando, y no
       * llega a verse nunca.
       */
      | 'limite',
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
  /**
   * Tu biblioteca. Necesita clave.
   *
   * Steam devuelve los juegos **por paginas** y no dice cuantas hay: hay que
   * seguir pidiendo hasta que una pagina viene vacia. Sin esto, con mas de unos
   * pocos cientos de juegos la biblioteca aparecia a medias y no habia forma de
   * saber que faltaban, que es justo el caso en el que mas duele.
   *
   * Las peticiones van encadenadas, no en paralelo: el limite de Steam es de
   * unas cinco llamadas cada diez segundos, y pedirlas todas a la vez es la via
   * rapida a que respondan con un 429 y a que la biblioteca se quede a medias.
   *
   * `signal` cancela de verdad: es un `fetch` y se puede matar. Es lo que
   * permite que la X del indicador de carga corte una sincronizacion en vez de
   * dejarla esperando a que Steam conteste.
   */
  async getOwnedGames(
    apiKey: string,
    steamId: string,
    signal?: AbortSignal,
  ): Promise<ISteamOwnedGame[]> {
    /**
     * Lo ya recogido, por appid.
     *
     * No es solo una comodidad: Steam no documenta que `page=` se respete con
     * `include_appinfo=1`. Si dejara de hacerlo devolveria la misma pagina una
     * y otra vez, y sin este mapa el bucle acabaria con cien copias de la misma
     * biblioteca y un numero en la barra que no corresponde a nada.
     *
     * Es un `Map` y no un `Set` porque hay que **conservar el juego entero**,
     * no solo su id: con un conjunto habria que normalizar dos veces.
     */
    const vistos = new Map<number, ISteamOwnedGame>();

    /**
     * Tope de paginas.
     *
     * Con la cuenta mas grande que se ha visto quedan muy por debajo. Es la
     * ultima red, no la primera: `vistos` ya corta la repeticion, y esto protege
     * de un API que devuelva paginas distintas y nunca termine.
     */
    const MAX_PAGINAS = 100;

    /**
     * Pausa entre paginas.
     *
     * Encadenar no es limitar: sin esto, una biblioteca de tres paginas son tres
     * peticiones seguidas y la tercera se come el 429. El limite de Steam es de
     * unos cinco por cada diez segundos, asi que 300 ms entre ellas lo evitan.
     */
    const PAUSA_ENTRE_PAGINAS_MS = 300;

    for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
      if (pagina > 0) await esperar(PAUSA_ENTRE_PAGINAS_MS, signal);

      const url =
        `${WEB_API}/ISteamUser/GetOwnedGames/v0001/` +
        `?key=${encodeURIComponent(apiKey)}` +
        `&steamid=${encodeURIComponent(steamId)}` +
        `&include_appinfo=1&include_played_free_games=1` +
        `&page=${pagina}`;

      const datos = await pedirConMargen<{ response?: { games?: unknown[] } }>(
        url,
        signal,
      );

      const paginaJuegos = datos.response?.games;

      if (!Array.isArray(paginaJuegos)) {
        // Steam devuelve un objeto vacio sin error cuando la clave es valida pero
        // el perfil es privado. Es el fallo mas desconcertante que hay, asi que
        // se distingue del resto para poder explicarlo bien.
        //
        // Solo en la **primera** pagina: en las siguientes es simplemente el fin
        // de los juegos, y ahi no hay nada que explicar.
        if (pagina === 0) {
          throw new SteamError(
            'La biblioteca vino vacia. Comprueba que tu perfil sea publico.',
            'perfilPrivado',
          );
        }

        break;
      }

      if (paginaJuegos.length === 0) break;

      let nuevos = 0;

      for (const bruto of paginaJuegos) {
        const juego = normalizarJuego(bruto);

        if (vistos.has(juego.appId)) continue;

        vistos.set(juego.appId, juego);
        nuevos += 1;
      }

      // Una pagina entera sin nada nuevo es la misma pagina repetida: seguir
      // pidiendo solo gastaria el margen de peticiones para acabar igual.
      if (nuevos === 0) break;
    }

    return [...vistos.values()];
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

/**
 * Pide JSON a Steam.
 *
 * `signal` se pasa al `fetch`, que es lo que hace que la peticion sea
 * realmente cancelable y no solo «dejar de esperarla». Cuando se aborta, el
 * `fetch` lanza `AbortError`, y aqui se distingue de un fallo de red para que
 * quien llama pueda no avisar de un error que el propio usuario acaba de pedir.
 */
/**
 * Pide JSON a Steam.
 *
 * `signal` se pasa al `fetch`, que es lo que hace que la peticion sea
 * realmente cancelable y no solo «dejar de mirarla». Cuando se aborta, el
 * `fetch` lanza `AbortError`, y aqui se distingue de un fallo de red para que
 * quien llama pueda no avisar de un error que el propio usuario acaba de pedir.
 *
 * El `try` cubre **el cuerpo entero**, no solo la cabecera. Con la biblioteca
 * grande el stream tarda, y la cancelacion cae casi siempre mientras se lee el
 * cuerpo: si `json()` se quedara fuera, su `AbortError` pasaria como fallo
 * normal y el usuario veria un aviso de error por algo que el mismo acaba de
 * cancelar.
 *
 * El 429 no se propaga como fallo. Es «has ido demasiado rapido», lo unico que
 * Steam responde con codigo y lo unico que tiene arreglo; lo distingue
 * `pedirConMargen`, que espera y lo reintenta.
 */
async function pedirJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  try {
    const respuesta = await fetch(url, signal === undefined ? undefined : { signal });

    if (!respuesta.ok) {
      if (respuesta.status === 429) {
        throw new SteamError('demasiado-rapido', 'limite');
      }

      if (respuesta.status === 403 || respuesta.status === 401) {
        throw new SteamError('La clave de la API no es valida.', 'idInvalido');
      }

      throw new SteamError('Steam no ha contestado.', 'http');
    }

    return (await respuesta.json()) as T;
  } catch (cause) {
    // Lo que sale con forma de `SteamError` es una decision ya tomada: se
    // propaga tal cual en vez de reinterpretarse como fallo de red.
    if (cause instanceof SteamError) throw cause;

    if (signal?.aborted === true || (cause as Error)?.name === 'AbortError') {
      throw new SteamError('Sincronizacion cancelada.', 'cancelado');
    }

    throw new SteamError('No se pudo contactar con Steam.', 'http');
  }
}

/** Espera que se pueda cortar, para no dejar un temporizador vivo. */
function esperar(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const reloj = setTimeout(resolve, ms);

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(reloj);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Pide JSON, esperando y reintentando si Steam dice «demasiado rapido».
 *
 * Encadenar peticiones no es limitar el ritmo: sin una pausa, una biblioteca de
 * tres paginas son tres peticiones seguidas y la tercera se come el 429. El
 * dorsal ademas espera entre paginas, que es lo que hace el limite real de unos
 * cinco por diez segundos.
 */
async function pedirConMargen<T>(
  url: string,
  signal?: AbortSignal,
  intentos = 3,
): Promise<T> {
  for (let intento = 0; intento < intentos; intento += 1) {
    try {
      return await pedirJson<T>(url, signal);
    } catch (cause) {
      const esLimite = cause instanceof SteamError && cause.codigo === 'limite';

      if (!esLimite) throw cause;

      // En el ultimo intento no hay mas margen: se convierte en el fallo de red
      // de siempre, que es lo que el usuario sabe entender.
      if (intento === intentos - 1) {
        throw new SteamError('Steam no ha contestado.', 'http');
      }

      await esperar(1000 * (intento + 1), signal);
    }
  }

  throw new SteamError('Steam no ha contestado.', 'http');
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

/**
 * Similitud a partir de la cual se dice «ya lo tienes».
 *
 * El valor sale de `confidenceFor`: `exact` es 0.97 o mas, y `likely` es 0.85
 * cuando ademas hay un solo candidato. Se eligen esos dos y se descarta `loose`
 * a proposito.
 *
 * `loose` empieza en 0.70, y ahi entran cosas que **no** son el mismo juego:
 * «Portal» contra «Portal 2» se puntua en 0.75, igual que «Half-Life» contra
 * «Half-Life 2». Marcar esas como propias seria lo peor que puede hacer este
 * badge: dice que la clave sobra, y el usuario la regala y pierde el juego.
 *
 * 0.85 sube justo con las diferencias de verdad:
 * - «World War III Black Gold» contra «World War 3 Black Gold» → 1.00, porque
 *   `normalizeForMatch` escribe los numeros romanos como digitos.
 * - «Broken Sword 1: Shadow of the Templars - Director's Cut» contra
 *   «Broken Sword: Shadow of the Templars - Director's Cut» → 0.96
 *
 * Sin la conversion de romanos el primer caso se queda en 0.84, a una centesima
 * del umbral. Por eso la conversion esta en `normalizeForMatch` y no aqui.
 */
export const PROPIO_MINIMO: MatchConfidence[] = ['exact', 'likely'];

/** `true` si esta confianza alcanza para marcar el juego como propio. */
export function cuentaComoPropio(confianza: MatchConfidence): boolean {
  return PROPIO_MINIMO.includes(confianza);
}
