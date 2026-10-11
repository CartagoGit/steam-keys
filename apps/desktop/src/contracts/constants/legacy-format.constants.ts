import { KeyStatus } from '../enums/key-status.enum';

/**
 * Expresiones regulares que describen el formato real del TXT de origen.
 * Centralizadas aqui para que parser, validadores y tests compartan la misma
 * definicion y no se desincronicen.
 */

/**
 * Clave de Steam clasica: cinco-cinco-cinco.
 *
 * El alfabeto real de Steam es A-Z y 0-9 completo: las claves del archivo
 * contienen ceros e "I" (`MQ7RT-29XKL-ZPN84`, `B4KMD-58RQW-LNCT3`), asi que
 * restricting el rango haria que se ignorarian dos de cada tres claves.
 */
export const STEAM_KEY_PATTERN = /\b[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}\b/i;

/** URL de Humble Bundle que lleva la clave en la query o en la ruta. */
export const HUMBLE_URL_PATTERN =
  /https?:\/\/[^\s]*humblebundle\.com[^\s]*/gi;

/** Parametro `key=` dentro de una URL de Humble (gift, downloads, etc.). */
export const HUMBLE_URL_KEY_PATTERN = /(?:\?|\/gift\?)[^#\s]*key=([A-Za-z0-9_-]{8,})/i;

/**
 * Clave de Battle.net: tres-tres-tres, p.ej. `A7T-9KX-R4Z`.
 *
 * El cierre usa una asercion negativa y no un `\b`: al terminar en caracteres
 * alfanumericos, un `\b` solo se cumpliria justo antes del ultimo, y el
 * patron no casaria nunca.
 */
export const BATTLENET_KEY_PATTERN = /\b[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}(?![A-Za-z0-9])/i;

/**
 * Clave alfanumerica de otras tiendas (GW2, Neverwinter, ESO, Blade & Soul):
 * de 8 a 24 caracteres, con al menos una letra y al menos un digito.
 *
 * Exigir el digito es lo que evita que se traguen palabras del titulo del
 * juego (`Giveaway`, `Uncharted`), que siempre son letras puras.
 */
export const ALPHANUMERIC_KEY_PATTERN =
  /\b(?=[A-Za-z0-9]{0,23}[A-Za-z])(?=[A-Za-z0-9]{0,23}\d)[A-Za-z0-9]{8,24}\b/;

/** Marcador de "ya regalada": el TXT empieza la linea con un guion. */
export const GIFT_MARKER_PATTERN = /^\s*-\s*/;

/**
 * Marcadores de estado que escribe el exportador al principio de la linea.
 *
 * El TXT original solo tenia `-` para "regalada"; el exportador anade el resto
 * para que la ida y vuelta a la base de datos no pierda informacion.
 *
 * La clave es un caracter suelto y cualquiera, asi que el tipo de clave no se
 * puede cerrar a una union de literales sin inventar un tipo artificial. Por
 * eso el mapa se declara abierto y **no se indexa nunca directamente**: para
 * leer se usa `statusForMarker()` y para escribir `markerForStatus()`, que son
 * las unicas dos formas de cruzarse con este dato. Con `Record<string, ...>`
 * un `STATUS_MARKERS[char]` se typea como `KeyStatus` —nunca `undefined`— y
 * el `if (STATUS_MARKERS[char])` que hace falta para cubrir el caracter
 * corriente deja de avisar al compilador.
 */
export const STATUS_MARKERS: Readonly<Record<string, KeyStatus>> = Object.freeze({
  '-': KeyStatus.Gifted,
  '!': KeyStatus.Redeemed,
  '~': KeyStatus.Expired,
  '?': KeyStatus.Unknown,
});

/** Caracteres que abren linea y significan algo mas que parte del nombre. */
export const STATUS_MARKER_CHARS = Object.freeze(Object.keys(STATUS_MARKERS).join(''));

/** Estado que corresponde a un caracter de marcador, o `null` si no lo es. */
export function statusForMarker(char: string): KeyStatus | null {
  return STATUS_MARKERS[char] ?? null;
}

/**
 * Caracter que escribe el exportador para un estado, o `null` si ese estado no
 * tiene marcador (el TXT original no distinguia "disponible" de nada, asi que
 * `available` es el unico que se escribe sin prefijo).
 *
 * Es la inversa de `STATUS_MARKERS`: ambos caminos salen del mismo mapa, de
 * modo que anadir un estado nuevo obliga a decidir su marcador aqui.
 */
export function markerForStatus(status: KeyStatus): string | null {
  for (const [char, mapped] of Object.entries(STATUS_MARKERS)) {
    if (mapped === status) {
      return char;
    }
  }
  return null;
}

/** Anotaciones con prefijo que escribe el exportador dentro de `[...]`. */
export const PARENT_ANNOTATION_PREFIX = 'parent:';
export const PLATFORM_ANNOTATION_PREFIX = 'plataforma:';

/** Separador entre anotaciones encadenadas dentro de un mismo `[...]`. */
export const ANNOTATION_SEPARATOR = '·';

/** Cabecera de fecha del TXT: `# 22-01-25`, `# 10-10-2026`. */
export const DATE_HEADER_PATTERN = /^#\s*(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\s*$/;

/** Lineas puramente decorativas: guiones, puntos, asteriscos, almohadillas. */
export const DECORATIVE_PATTERN = /^[\s\-=_*#.~]{3,}$/;

/** Separadores horizontales y encabezados de "ronda"/"sesion de regalos". */
export const SECTION_MARKER_PATTERN = /(RONDA DE KEYS|Sesion de regalos|sesion de regalos)/i;

/**
 * Inicio de una ronda de regalos: `................. 3 Sesion de regalos......`
 *
 * El numero de puntos varia entre bloques, asi que se ancla en el texto. El
 * grupo 1 se queda con el numero de sesion.
 */
export const GIVEAWAY_START_PATTERN = /\.{3,}\s*(\d+)\s*Sesion de regalos\s*\.{3,}/i;

/**
 * Cierre de una ronda: `.................FIN 3 Sesion de regalos...........`
 *
 * Se distingue del inicio por el `FIN`. Sin el, el cierre se confundiria con
 * una sesion nueva y las claves del final nunca saldrian del bloque.
 */
export const GIVEAWAY_END_PATTERN = /\.{3,}\s*FIN\s*\d+\s*Sesion de regalos\s*\.{3,}/i;

/** Etiqueta que se pone a las regaladas en ronda, sin destinatario. */
export const GIVEAWAY_TAG = 'sesion-regalos';

/**
 * Nota que indica que las keys siguientes **estan canjeadas por mi**.
 *
 * Solo cuenta `ACTIVAR YO`. El TXT tambien trae
 * `ACTIVAR Con el juego base - TODAS SON DLCS ->>>`, que empieza igual pero
 * significa otra cosa: que esas DLC hay que activarlas junto con el juego
 * base, no que ya las hayaactivado. Confundir las dos marcaba como canjeadas
 * 19 DLCs de Earth Defense Force que no lo estaban.
 */
export const REDEEM_MARKER_PATTERN = /^.*\bACTIVAR\s+YO\b/i;

/**
 * Cualquier otra nota que empiece por ACTIVAR.
 *
 * Se comprueba **despues** del anterior, y apaga el modo canjeado: es una
 * instruccion nueva, asi que lo que venga a partir de aqui ya no arrastra el
 * estado de la seccion anterior.
 */
export const ACTIVATE_NOTE_PATTERN = /^.*\bACTIVAR\b/i;

/** Lineas de instrucciones de Humble: no aportan ninguna clave. */
export const INSTRUCTION_PATTERN = /\b(INSTRUCCIONES|INSTRUCCION|COMO CANJEAR|CÓMO CANJEAR)\b/i;

/** Texto que fija la plataforma de las entradas siguientes. */
export const PLATFORM_HINT_PATTERN =
  /(BATTLE\.NET|BLIZARD|BLADE\s*&\s*SOUL|PAY\s*OR\s*WIN|GUILD\s*WARS\s*2|NEVERWINTER|ELDER\s*SCROLLS\s*ONLINE|\bESO\b)/i;

/** Parentesis de un bloque de DLC: `{` abre, `}` cierra. */
export const BLOCK_OPEN_PATTERN = /^\s*\{\s*$/;
export const BLOCK_CLOSE_PATTERN = /^\s*\}\s*$/;

/** Un destinatario: pocas palabras, sin cifras, sin signos raros. */
export const RECIPIENT_PATTERN = /^[\p{L}][\p{L}\s'’.]{2,38}$/u;

/** Numero maximo de palabras que se consideran un destinatario. */
export const RECIPIENT_MAX_WORDS = 4;

/** Prefijos/sufijos que se limpian de un titulo. */
export const TITLE_NOISE_PATTERN =
  /\b(steam\s*key|clave|key|codigo|código)\b\s*:?\s*$/i;