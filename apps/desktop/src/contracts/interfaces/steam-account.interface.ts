/**
 * Un juego de la biblioteca de Steam.
 *
 * Es la informacion que devuelve `GetOwnedGames`, mas lo que se puede saber de
 * el desde la tienda publica. El `appId` es lo unico que identifica un juego
 * de forma fiable: el nombre no, porque un mismo juego tiene varias ediciones
 * con nombres distintos y un DLC puede llamarse casi como el juego base.
 */
export interface ISteamOwnedGame {
  /** Identificador de la aplicacion en Steam. Es la unica identidad fiable. */
  appId: number;
  /** Nombre tal como lo devuelve Steam. Puede venir en el idioma de la region. */
  name: string;
  /** Horas jugadas. 0 si nunca se abrio. */
  playtimeForever: number;
  /** Ultima vez que se juega, en epoch Unix (segundos). 0 si nunca. */
  lastPlayed: number;
  /** `true` si es contenido adicional (DLC, expansions, etc.). */
  isDlc: boolean;
  /** Icono, si Steam lo devuelve. */
  iconUrl: string | null;
}

/**
 * Lo que devuelve una lectura de la biblioteca.
 *
 * No es solo la lista porque **puede venir incompleta** y hay que poder
 * decirlo. El tope de paginas existe para que un API que devuelva
 * paginas distintas sin terminar no se lleve el proceso por delante, y
 * cuando se topa con el la respuesta esta incompleta de verdad: hay
 * menos juegos de los que tiene la cuenta.
 *
 * Devolver solo el array obligaba a mentir por omision: quien llamaba
 * guardaba, contaba y pintaba esos numeros como si fueran la
 * biblioteca entera. Con `truncada` a la vista, avisar es una linea.
 */
export interface ISteamOwnedGames {
  juegos: readonly ISteamOwnedGame[];
  /** `true` si se paro por el tope de paginas, no porque se acabaran. */
  truncada: boolean;
}

/** Datos publicos de la tienda, que no necesitan clave de API. */
export interface ISteamStoreApp {
  appId: number;
  name: string;
  /** `game` o `dlc`. Es lo que distingue un juego de su contenido extra. */
  type: 'game' | 'dlc';
  developers: readonly string[];
  publishers: readonly string[];
  genres: readonly string[];
  /** Caracteristicas: mando, Steam Deck, HDR, multijugador... */
  categories: readonly string[];
  metacritic: number | null;
  /** Puntuacion de resenas de 1 a 10, y su etiqueta. */
  reviewScore: number | null;
  reviewScoreDesc: string | null;
  totalReviews: number;
  totalPositive: number;
  totalNegative: number;
  /** Proporcion de resenas positivas de los ultimos 30 dias, si se pudo leer. */
  recentPositiveRatio: number | null;
  recentTotal: number | null;
  /** Precio final formateado, si esta a la venta. */
  price: string | null;
  headerImage: string | null;
}

/**
 * Lo que el emparejador ha decidido sobre un juego.
 *
 * El emparejamiento por nombre no es fiable y no se disimula: cada clave queda
 * emparejada con la confianza que se ha podido medir, y las dudosas se pueden
 * revisar a mano.
 */
export type MatchConfidence =
  /** Un solo candidato y el nombre coincide de verdad. */
  | 'exact'
  /** Varios candidatos, pero uno encaja claramente mejor. */
  | 'likely'
  /** Solo se ha podido quitar la coletilla ("GOTY Edition", "Definitive"...). */
  | 'loose'
  /** Nada convincente. Mejor preguntarle a la persona. */
  | 'none';

export interface IAppMatch {
  /** La key de la coleccion. */
  keyId: number;
  /** El appId encontrado, si se hallo alguno. */
  appId: number | null;
  /** Confianza del emparejamiento. */
  confidence: MatchConfidence;
  /** Qué se emparejó y por qué, para poder revisarlo. */
  razon: string;
  /** Candidatos alternativos, para cuando el primero no era el bueno. */
  alternativas: readonly { appId: number; name: string }[];
}

/** Una clave de la coleccion con su emparejamiento a un juego de Steam. */
export interface IResolvedKey {
  keyId: number;
  title: string;
  appId: number | null;
  /** `true` si la cuenta ya tiene ese juego. */
  owned: boolean;
  confidence: MatchConfidence;
  /** Puntuaciones del juego, si se pudieron leer de la tienda. */
  store: ISteamStoreApp | null;
}

/** Estado de la conexion con la cuenta de Steam, para los ajustes. */
export interface SteamAccountStatus {
  conectado: boolean;
  steamId: string;
  /** Numero de juegos de la biblioteca. 0 si no se ha sincronizado. */
  juegos: number;
  /** Ultima sincronizacion correcta, en ISO. */
  sincronizadoAt: string | null;
  /** `true` si la API ha devuelto una biblioteca vacia con la clave buena. */
  perfilPrivado: boolean;
}