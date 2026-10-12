import { steamGet } from './steam-http.service';
import type { ISteamOwnedGame, ISteamOwnedGames, ISteamStoreApp } from '@/contracts';

const WEB_API = 'https://api.steampowered.com';
const STORE_API = 'https://store.steampowered.com/api';

/** Por que fallo una llamada a Steam. Lo que decide como se enseña. */
export type TSteamErrorCodigo =
  /** El propio usuario pulso la X. */
  | 'cancelado'
  /**
   * Steam ha dicho «has ido demasiado rapido». Tampoco es un fallo para el
   * usuario: lo resuelve quien llama esperando y reintentando.
   */
  | 'limite'
  | 'sinClave'
  | 'idInvalido'
  | 'perfilPrivado'
  | 'vacio'
  | 'http'
  // Los tres del XML del perfil. Van aparte de `idInvalido` porque el mensaje
  // es distinto: «no existe», «se renombro» y «no supe leerlo» son tres
  // problemas distintos con tres respuestas distintas, y colapsarlos en uno
  // mandaba al usuario a revisar como habia escrito el nombre cuando el
  // nombre estaba bien.
  | 'perfilNoExiste'
  | 'perfilRenombrado'
  | 'perfilIdNoLeido'
  /** Falló la peticion, y `args[0]` es lo que dijo el otro lado. */
  | 'perfilNoResponde';

/**
 * Error de Steam, **con la clave de su traduccion y no con el texto**.
 *
 * `message` es literalmente `steam.<codigo>`. Es a proposito, y es lo que hace
 * que el fallo sea ruidoso: si alguien lo pinta sin pasar por el traductor, en
 * pantalla sale `steam.perfilPrivado` en vez de una frase, y se nota a la
 * primera. Con el castellano dentro de la clase —como estaba— el mensaje era
 * el ultimo sitio donde se colaba texto de un solo idioma, y el que lo pintaba
 * no tenia forma de traducirlo porque el texto ya venia hecho.
 *
 * Los datos variables van en `args`, no en el mensaje.
 */
export class SteamError extends Error {
  constructor(
    readonly codigo: TSteamErrorCodigo,
    readonly args: readonly (string | number)[] = [],
  ) {
    super(`steam.${codigo}`);
    this.name = 'SteamError';
  }
}

/**
 * El texto de un error de Steam, ya traducido.
 *
 * Va en una funcion y no en un metodo porque traducir necesita el idioma, que
 * es cosa del componente: el servicio no sabe en que idioma esta la app, y por
 * eso sus errores solo llevan la clave.
 */
export function textoDeSteamError(
  error: SteamError,
  traducir: (clave: string, args?: readonly (string | number)[]) => string,
): string {
  return traducir(`steam.${error.codigo}`, error.args);
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
export async function resolveSteamId(
  entrada: string,
  signal?: AbortSignal,
): Promise<string> {
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
    throw new SteamError('idInvalido');
  }

  let cuerpo: string;

  try {
    // La peticion va por Rust cuando se puede: `steamcommunity.com` no manda
    // cabeceras CORS y el navegador la rechazaria antes de salir.
    cuerpo = await steamGet(
      `steamcommunity.com/id/${encodeURIComponent(handle)}/?xml=1`,
      signal,
    );
  } catch (cause) {
    /**
     * Tauri **no** rechaza con un `Error`, sino con el `String` del `Err` de
     * Rust. Mirar `instanceof Error` era por tanto una rama muerta dentro de
     * Tauri —la app de escritorio, que es donde se usa esto— y los errores
     * con mensaje propio («Ese dominio no esta permitido») llegaban aplastados
     * al genérico. Ahora se mira el `string` que de verdad llega.
     *
     * Fuera de Tauri si es un `Error` de verdad, y su mensaje se conserva: son
     * errores de red del navegador y su texto dice cosas que el nuestro no
     * («Failed to fetch» no, pero «aborted» si, y ese caso ya se trata aparte).
     */
    const mensaje =
      typeof cause === 'string'
        ? cause
        : cause instanceof Error
          ? cause.message
          : '';

    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new SteamError('cancelado');
    }

    throw new SteamError(mensaje === '' ? 'http' : 'perfilNoResponde', [mensaje]);
  }

  /**
   * Steam **no** devuelve un 404 cuando el perfil no existe: responde con un
   * 200 y el error va dentro del propio XML. Sin mirar esto, un nombre mal
   * escrito se cuela como si fuera bueno y el fallo aparece mas tarde como
   * una biblioteca vacia, que no explica nada.
   *
   * El patron acepta las tres formas que se han visto en produccion: con
   * `CDATA`, sin `CDATA`, y partido por un salto de linea. El regex anterior
   * exigia `<error><![CDATA[…]]></error>` exacto, y cuando no encajaba el flujo
   * caia en «no se pudo leer el ID» —que dice «no supe leerlo», no «no
   * existe»— que es el mensaje menos diagnostico de todos.
   */
  const error = /<error>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/error>/.exec(
    cuerpo,
  )?.[1]?.trim();

  if (error !== undefined && error !== '') {
    throw new SteamError('perfilNoExiste', [handle]);
  }

  /**
   * Un perfil cuyo nombre «vanity» se renombro devuelve `<redirect>` con el
   * nuevo, en vez de un error. Sin este caso caia en el mismo «no se pudo leer
   * el ID», que manda a revisar como se escribio el nombre cuando el nombre
   * esta bien y lo que cambio fue el destino.
   */
  const renombrado = /<redirect>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/redirect>/.exec(
    cuerpo,
  )?.[1]?.trim();

  if (renombrado !== undefined && renombrado !== '') {
    throw new SteamError('perfilRenombrado', [renombrado]);
  }

  const id = /<steamID64>(\d{17})<\/steamID64>/.exec(cuerpo)?.[1];

  if (!id) {
    throw new SteamError('perfilIdNoLeido', [handle]);
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
  ): Promise<ISteamOwnedGames> {
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

    /**
     * Paginas seguidas sin ningún juego nuevo.
     *
     * Va **fuera** del bucle a proposito: si se declarara dentro, seria un
     * contador que se reinicia en cada iteracion y por tanto siempre valdria
     * cero — que es exactamente el bug que se arregla aqui, reintroducido.
     */
    let vaciasSeguidas = 0;

    /** Se agoto el tope de paginas sin haber llegado al final real. */
    let terminado = false;

    for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
      if (pagina > 0) await esperar(PAUSA_ENTRE_PAGINAS_MS, signal);

      const url =
        `${WEB_API}/ISteamUser/GetOwnedGames/v0001/` +
        `?key=${encodeURIComponent(apiKey)}` +
        `&steamid=${encodeURIComponent(steamId)}` +
        `&include_appinfo=1&include_played_free_games=1` +
        `&page=${pagina}`;

      /**
       * `game_count` viene en la respuesta y no se usaba para nada. Es
       * justamente lo que distingue una biblioteca vacia de un perfil
       * privado, asi que se declara; los `games` se leen crudos y se
       * normalizan uno a uno, que es lo que evita que un elemento raro
       * tumbe la pagina entera.
       */
      const datos = await pedirConMargen<{
        response?: { games?: unknown[]; game_count?: number };
      }>(url, signal);

      const respuesta = datos.response;
      const paginaJuegos = respuesta?.games;

      if (!Array.isArray(paginaJuegos)) {
        /**
         * Biblioteca vacia no es perfil privado.
         *
         * Steam responde `{}` a un perfil privado —la clave vale, el juego
         * no— y `{"response":{"game_count":0}}` a una cuenta visible que no
         * tiene ningun juego. Antes las dos caian en el mismo `if` y las dos
         * salian como `perfilPrivado`, que es justo lo contrario de lo que
         * hay que decir en la segunda: no hay nada que arreglar, el juego
         * esta vacio y ya esta.
         *
         * El diagnostico se hace **una vez**, en la primera pagina. En las
         * siguientes la falta de juegos es simplemente el fin, y no hay nada
         * que explicar.
         */
        if (pagina === 0) {
          if (respuesta?.game_count === 0) {
            terminado = true;
            break;
          }

          throw new SteamError('perfilPrivado');
        }

        terminado = true;
        break;
      }

      if (paginaJuegos.length === 0) {
        terminado = true;
        break;
      }

      let nuevos = 0;

      for (const bruto of paginaJuegos) {
        const juego = normalizarJuego(bruto);

        // Sin `appid` no hay forma de deduplicarlo, y colgarlo bajo una clave
        // compartida haria desaparecer al resto. Se pierde el que falte.
        if (juego === null) continue;

        if (vistos.has(juego.appId)) continue;

        vistos.set(juego.appId, juego);
        nuevos += 1;
      }

      /**
       * Paginacion repetida **consecutiva**, no una sola pagina sin novedades.
       *
       * Antes una pagina entera sin nada nuevo cortaba el bucle, y la
       * justificacion era «una pagina sin nada nuevo es la misma pagina
       * repetida». Eso es una suposicion, no una garantia: Steam no documenta
       * que `page=` se respete con `include_appinfo=1`, ni que el orden sea
       * estable entre peticiones. Si un juego cambia su `rtime_last_played` y
       * la biblioteca se reordena, una pagina puede venir entera de cosas ya
       * vistas **seguida** de una con cincuenta nuevas — y cortando ahi la
       * biblioteca se queda a medias sin que nada diga nada.
       *
       * Dos paginas seguidas sin nada nuevo si son una senal mucho mas fuerte:
       * para que eso pase por casualidad haria falta que dos reordenaciones
       * coincidieran. Y el coste de acertar es una peticion mas.
       */
      vaciasSeguidas = nuevos === 0 ? vaciasSeguidas + 1 : 0;

      if (vaciasSeguidas >= 2) {
       terminado = true;
        break;
      }
    }

    /**
     * Salir del bucle por el tope de paginas **no** es lo mismo que haber
     * terminado: significa que habia mas juegos y se dejo de mirar. Se marca
     * para que el aviso pueda salir, en vez de devolver una lista a medio
     * hacer que el resto de la app da por buena —la guarda, la cuenta y la
     * muestra como si fuera la biblioteca entera.
     *
     * Con la cuenta mas grande que se conoce quedan muy por debajo, asi que
     * en la practica casi nunca se vera. "Casi nunca" no es "nunca", y un
     * numero de juegos equivocado en pantalla es de las cosas que hacen que
     * la app no sea de fiar.
     */
    const truncada = !terminado;

    return { juegos: [...vistos.values()], truncada };
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

/**
 * Un juego de la biblioteca, o `null` si no se puede usar.
 *
 * El `null` es lo nuevo y es lo importante. Antes se hacía `appid ?? 0` y se
 * insertaba igual: **todos** los juegos a los que les faltara el `appid` —
 * o viniera como cadena, o en cero— caían en el mapa bajo la misma clave `0`,
 * de modo que el primero se guardaba y los demás se descartaban sin avisar.
 *
 * Con eso, un `null` suelto en el array rompía el `item.appid` con un
 * `TypeError` que salía como error de red y un `appid` ausente hacía que
 * juegos que el usuario **sí tiene** desaparecieran de la biblioteca, mientras
 * aparecía un juego fantasma con id `0` que no emparejaba con nada.
 *
 * Lo que se hace ahora es conservar la deduplicación por `appid` —que es
 * correcta y necesaria— y descartar lo que no la puede usar. Perder una fila
 * malformada es mejor que perder veinte detrás de ella.
 */
function normalizarJuego(bruto: unknown): ISteamOwnedGame | null {
  if (bruto === null || typeof bruto !== 'object') return null;

  const item = bruto as {
    appid?: number;
    name?: string;
    playtime_forever?: number;
    rtime_last_played?: number;
    img_icon_url?: string;
  };

  // `Number.isInteger` y no `!= null`: un `appid` puede venir como cadena o
  // como 0 si Steam responde algo raro, y `??` no cubre ninguno de los dos.
  // El id es la clave de deduplicacion; sin el, el juego no tiene sitio.
  const appId = item.appid;

  if (typeof appId !== 'number' || !Number.isInteger(appId) || appId <= 0) {
    return null;
  }

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
 * Cuanto espera una peticion antes de darse por colgada.
 *
 * Sin esto, el unico final posible de un `fetch` a Steam es que responda o que
 * el usuario pulse la X. Y hay un tercer caso que no cabe en esas dos: Steam
 * acepta la conexion, manda las cabeceras 200 y luego deja el stream a medias.
 * Es raro pero pasa con HTTP/2 a medias, y entonces `respuesta.json()` no
 * resuelve nunca, la sincronizacion se queda esperando para siempre y el
 * indicador de carga —que el usuario puede cerrar, pero no siempre mira— es lo
 * unico que separa esa pantalla de una aplicacion colgada.
 *
 * Quince segundos es holgado para la API de Steam y corto para que no se note
 * como fallo: si tarda mas, esta caida y ya se avisara.
 */
const TIMEOUT_POR_PETICION_MS = 15_000;

/**
 * Estados que merece la pena volver a intententar.
 *
 * El 429 es lo que mas se ve, pero los 5xx son tan de Steam como el 429: la
 * biblioteca de una cuenta con mil juegos son veinte peticiones seguidas y
 * cualquier glitch del otro lado en la pagina quince se comia las veinte
 * —tirando por el suelo todo lo ya recogido— sin que el usuario entendiera por
 * que. Un 503 transitorio no es un fallo de la cuenta ni de la clave: es
 * volver a preguntar.
 *
 * Los 4xx, en cambio, son definitivos. Un 400 es una peticion mal formada y un
 * 401/403 es una clave caducada: repetirlo las tres veces solo retrasa el
 * aviso.
 */
const REINTENTABLES = new Set([408, 425, 429, 500, 502, 503, 504]);

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
 * Se aborta con **dos** señales —la del usuario y un reloj— y se distingue
 * cual de las dos fue: `steam.cancelado` es «lo has pedido tu» y no se avisa;
 * el reloj es un fallo y se avisa como tal. Confundirlos era el caso raro que
 * de verdad no occurre nunca, y por eso no lo cubria nadie.
 *
 * El 429 y los 5xx **no** se propagan como fallo: son «ahora no», lo resuelve
 * `pedirConMargen` esperando y reintentando.
 */
async function pedirJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const reloj = AbortSignal.timeout(TIMEOUT_POR_PETICION_MS);

  // `AbortSignal.any` es lo que hace que las dos cosas sirvan a la vez. Con un
  // solo `fetch` no se puede decir «corta esto, pero no antes de quince
  // segundos» sin compositionarla antes.
  const corte = signal === undefined ? reloj : AbortSignal.any([signal, reloj]);

  try {
    const respuesta = await fetch(url, { signal: corte });

    if (!respuesta.ok) {
      if (REINTENTABLES.has(respuesta.status)) {
        // No lleva texto: es un estado intermedio, nunca llega a la pantalla.
        throw new SteamError('limite');
      }

      if (respuesta.status === 403 || respuesta.status === 401) {
        throw new SteamError('idInvalido');
      }

      throw new SteamError('http');
    }

    return (await respuesta.json()) as T;
  } catch (cause) {
    // Lo que sale con forma de `SteamError` es una decision ya tomada: se
    // propaga tal cual en vez de reinterpretarse como fallo de red.
    if (cause instanceof SteamError) throw cause;

    const abortado = corte.aborted || (cause as Error)?.name === 'AbortError';

    // El orden importa: si el usuario pulso la X **y** el reloj habia saltado a
    // la vez, es una cancelacion —no se avisa de nada que el usuario acaba de
    // pedir—. Por eso se mira `signal` y no `corte`.
    if (signal?.aborted === true) {
      throw new SteamError('cancelado');
    }

    if (abortado) {
      throw new SteamError('http');
    }

    throw new SteamError('http');
  }
}

/**
 * Espera que se pueda cortar, para no dejar un temporizador vivo.
 *
 * El `{ once: true }` solo limpia el oyente **si el abort ocurre**. En el camino
 * normal —el temporizador gana, que es el que se usa casi siempre— el oyente
 * se queda registrado en el `AbortSignal` para siempre. Con una biblioteca de
 * veinte paginas son veinte esperas y veinte oyentes reteniendo el `signal`
 * entero, y a partir de diez Bun empieza a quejarse en la consola.
 *
 * Por eso se quita a mano en cuanto se resuelve, con el mismo gesto en los dos
 * caminos.
 */
function esperar(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    // Se guarda para quitarlo despues: sin esto, la primera alarma es «too many
    // listeners», y el aviso aparece en un sitio donde nadie lo mira.
    const alAbortar = (): void => {
      clearTimeout(reloj);
      resolve();
    };

    const reloj = setTimeout(() => {
      signal?.removeEventListener('abort', alAbortar);
      resolve();
    }, ms);

    if (signal?.aborted === true) {
      // Ya estaba abortado antes de empezar: `addEventListener` no dispara por
      // un abort pasado, asi que sin esto se esperaria el tiempo entero.
      alAbortar();
      return;
    }

    signal?.addEventListener('abort', alAbortar, { once: true });
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

      // En el ultimo intento no hay mas margen: se convierte en el fallo de
      // red de siempre, que es lo que el usuario sabe entender.
      if (intento === intentos - 1) {
        throw new SteamError('http');
      }

      /**
       * Exponencial de verdad, y con el suelo que pide Steam.
       *
       * El margen anterior era `1000 * (intento + 1)`, que es una progresión
       * aritmetica —1 s y 2 s— donde lo que hace falta es que cada intento
       * duplique el anterior: es lo que da margen a un servidor saturado sin
       * convertir el retraso en algo que el usuario percibe como colgado.
       *
       * El suelo son cuatro segundos porque el limite real de Steam son cinco
       * llamadas por cada diez segundos: reintentar al segundo tapaba la
       * siguiente llamada y tapabaaba el 429 que se estaba intentando esquivar.
       */
      await esperar(4000 * 2 ** intento, signal);
    }
  }

  throw new SteamError('http');
}
