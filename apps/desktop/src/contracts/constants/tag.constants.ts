/**
 * Importacion **relativa** a proposito, y no `@/contracts`.
 *
 * Este fichero vive dentro del propio modulo de contratos. Pasando por el
 * barril se importaria el modulo que este fichero esta exportando, que es un
 * ciclo; bajando al sibling directo se evita. Los dos ficheros son pares: un
 * enum y las constantes que se apoyan en el.
 */
import { KeyPlatform } from '../enums/key-platform.enum';

/**
 * Etiquetas automaticas por plataforma.
 *
 * Al cambiar la plataforma de una clave se le pueden anadir estas etiquetas
 * para poder filtrar despues ("las de Battle.net", "las de GW2"). No se
 * imponen: se ofrecen, y quien no las quiera simplemente no las marca.
 */
export const PLATFORM_TAGS: Readonly<Record<KeyPlatform, readonly string[]>> =
  Object.freeze({
    [KeyPlatform.Steam]: Object.freeze(['steam']),
    [KeyPlatform.BattleNet]: Object.freeze(['battlenet', 'blizzard']),
    [KeyPlatform.GuildWars2]: Object.freeze(['gw2']),
    [KeyPlatform.Neverwinter]: Object.freeze(['neverwinter']),
    [KeyPlatform.BladeAndSoul]: Object.freeze(['blade-and-soul']),
    [KeyPlatform.ElderScrollsOnline]: Object.freeze(['eso']),
    [KeyPlatform.Unknown]: Object.freeze([]),
  });

/**
 * Etiquetas de origen, que no dependen de la plataforma.
 *
 * Son las que el importador crea a partir del formato del TXT, mas unas pocas
 * que se ofrecen para clasificar a mano.
 */
export const ORIGIN_TAGS: readonly string[] = Object.freeze([
  'dlc',
  'humble',
  'promo',
  'gift',
  'bundle',
  'review',
  'humo',
  'pack',
]);

/**
 * Normaliza una etiqueta para poder compararla.
 *
 * Sin acentos, en minusculas y sin espacios sobrantes: asi `BattLe.Net`,
 * `battlenet` y `Battlenet` son la misma etiqueta y no aparecen tres veces en
 * el filtro. No se quitan los puntos porque `blade-and-soul` los lleva.
 */
export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Quita acentos, deja en minusculas y aprieta los espacios. */
export function cleanTag(tag: string): string {
  return normalizeTag(tag).replace(/\s+/g, ' ').trim();
}

/** Todas las etiquetas que tienen sentido para una plataforma dada. */
export function platformTags(platform: KeyPlatform): readonly string[] {
  return PLATFORM_TAGS[platform];
}

/**
 * Las etiquetas que tienen sentido para una plataforma dada.
 *
 * La lista de la plataforma va primero de las que ya existen, porque son las
 * que mas probable es que hagan falta en ese momento; las que ya hay en la
 * coleccion se ofrecen despues, por si se quiere filtrar por algo raro.
 */
export function suggestionsFor(
  platform: KeyPlatform,
  existentes: readonly string[],
): readonly string[] {
  const resultado: string[] = [];
  const vistas = new Set<string>();

  for (const tag of [...platformTags(platform), ...ORIGIN_TAGS, ...existentes]) {
    const clave = normalizeTag(tag);

    if (clave.length === 0 || vistas.has(clave)) continue;

    vistas.add(clave);
    resultado.push(cleanTag(tag));
  }

  return resultado;
}

/**
 * Los tonos con los que se puede pintar una etiqueta.
 *
 * Se guardan por **nombre** y no por color, y no es una comodidad de la base
 * de datos: con `#a855f7` la etiqueta se veria igual de bien en los cinco temas
 * oscuros y mal en los cuatro claros, que es justo lo que los `--ok` y `--warn`
 * de cada tema vienen a evitar. Aqui solo se dice «esta etiqueta es de tono
 * `warn`» y el color lo pone el tema.
 *
 * Son los cinco colores con significado que ya declara `styles/index.css`, y no
 * uno mas, porque son los unicos que se sabe que se leen sobre cualquier
 * superficie en los nueve temas. Un sexto seria inventar una variable nueva
 * para nueve temas a cambio de un matiz.
 */
export const TAG_TONES = ['accent', 'ok', 'warn', 'info', 'danger'] as const;

/** Uno de los tonos de la paleta de etiquetas. */
export type TagTone = (typeof TAG_TONES)[number];

/**
 * Dos intensidades por tono, y no tonos distintos.
 *
 * Cinco colores para una paleta se quedan cortos en cuanto hay veinte
 * etiquetas, pero el color que hace falta para distinguirlas **no es un matiz
 * mas**: es saber cuales destacan y cuales se quedan de fondo. `info` e
 * `info-soft` cuentan eso con el mismo color.
 *
 * El relleno es el color entero y el texto el que se lee encima, al reves que en
 * los estados —alli el color va diluido y el texto fuerte, porque una pastilla
 * de estado tiene que leerse sin parecer un boton—. Aqui la etiqueta es lo que se
 * quiere mirar, no lo que se quiere pulsar.
 */
export type TagColor = TagTone | `${TagTone}-soft`;

/**
 * Los mismos cinco tonos, pero diluidos.
 *
 * Son los que se usan **por defecto**, mientras nadie ha elegido un color. Un
 * color entero de salida convierte cada etiqueta en un boton y hace que la fila
 * se parezca a una tabla de estados; diluidos se leen como lo que son —una
 * etiqueta al lado de una fecha— y ademas se distinguen de las que alguien ha
 * marcado a proposito, que son las unicas que tienen por que highlightarse.
 */
export const TAG_TONES_DEDUCIDOS: readonly TagColor[] = Object.freeze(
  TAG_TONES.map((tono) => `${tono}-soft` as TagColor),
);

/** Los diez colores, en el orden en que los ofrece el panel. */
export const TAG_COLORS: readonly TagColor[] = Object.freeze([
  ...TAG_TONES,
  ...TAG_TONES.map((tono) => `${tono}-soft` as TagColor),
]);

/**
 * Un color, en las tres piezas que se pintan.
 *
 * - `punto`: el disco del selector. Va **lleno** en las dos intensidades: un
 *   punto de `bg-info/15` sobre `bg-surface-2` no se ve.
 * - `pastilla`: la etiqueta en si, y es lo unico que cambia de verdad.
 * - `tinta`: el texto que va encima. El acento no tiene variante `-strong` —no
 *   la necesita, `--accent` ya es el tono de texto— y por eso el suyo es el
 *   mismo en las dos intensidades.
 * - `aro`: el anillo, para cuando hay que distinguirla de un boton. Va al 40
 *   y no a /60 como el borde de los controles, porque alrededor de un texto
 *   pequeno un anillo fuerte convierte la etiqueta en algo pulsable.
 *
 * Las clases van **escritas**, y no montadas con `bg-${tono}`: Tailwind lee el
 * codigo fuente, y una clase construida en tiempo de ejecucion no existe para
 * el y no sale en el CSS final. La pastilla se queda sin borde a proposito: un
 * borde alrededor de un texto pequeno lo convierte en un boton, y una etiqueta
 * no se pulsa.
 */
export const TAG_COLOR_CLASS: Readonly<
  Record<TagColor, { punto: string; pastilla: string; tinta: string; aro: string }>
> = Object.freeze({
  accent: {
    punto: 'bg-accent',
    pastilla: 'bg-accent text-on-accent',
    tinta: 'text-on-accent',
    aro: 'ring-accent/40',
  },
  ok: {
    punto: 'bg-ok',
    pastilla: 'bg-ok text-on-accent',
    tinta: 'text-on-accent',
    aro: 'ring-ok/40',
  },
  warn: {
    punto: 'bg-warn',
    pastilla: 'bg-warn text-on-accent',
    tinta: 'text-on-accent',
    aro: 'ring-warn/40',
  },
  info: {
    punto: 'bg-info',
    pastilla: 'bg-info text-on-accent',
    tinta: 'text-on-accent',
    aro: 'ring-info/40',
  },
  danger: {
    punto: 'bg-danger',
    pastilla: 'bg-danger text-on-accent',
    tinta: 'text-on-accent',
    aro: 'ring-danger/40',
  },
  'accent-soft': {
    punto: 'bg-accent',
    pastilla: 'bg-accent/15 text-accent',
    tinta: 'text-accent',
    aro: 'ring-accent/40',
  },
  'ok-soft': {
    punto: 'bg-ok',
    pastilla: 'bg-ok/15 text-ok-strong',
    tinta: 'text-ok-strong',
    aro: 'ring-ok/40',
  },
  'warn-soft': {
    punto: 'bg-warn',
    pastilla: 'bg-warn/15 text-warn-strong',
    tinta: 'text-warn-strong',
    aro: 'ring-warn/40',
  },
  'info-soft': {
    punto: 'bg-info',
    pastilla: 'bg-info/15 text-info-strong',
    tinta: 'text-info-strong',
    aro: 'ring-info/40',
  },
  'danger-soft': {
    punto: 'bg-danger',
    pastilla: 'bg-danger/15 text-danger-strong',
    tinta: 'text-danger-strong',
    aro: 'ring-danger/40',
  },
});

/**
 * Lee un color guardado y lo normaliza.
 *
 * La columna la escribe la app y solo la app, asi que en teoria nunca llega
 * nada raro. Pero la base de datos es un fichero que se puede abrir, editar a
 * mano y volver a abrir con otra version —y una etiqueta con un color que no
 * existe dejaria de tener color y se pintaria como si no tuviera, sin decir
 * nada—. Por eso lo que no se reconoce se devuelve como **sin color**, que es
 * lo que se muestra, y no como un error.
 */
export function parseTagColor(valor: string): TagColor | '' {
  const limpio = valor.trim().toLowerCase();

  return (TAG_COLORS as readonly string[]).includes(limpio)
    ? (limpio as TagColor)
    : '';
}
/** Une etiquetas sin repetir, ignorando mayusculas y acentos. */
export function mergeTags(
  actuales: readonly string[],
  nuevas: readonly string[],
): readonly string[] {
  const vistas = new Set(actuales.map(normalizeTag));
  const resultado = [...actuales];

  for (const tag of nuevas) {
    const clave = normalizeTag(tag);

    if (clave.length > 0 && !vistas.has(clave)) {
      vistas.add(clave);
      resultado.push(cleanTag(tag));
    }
  }

  return resultado;
}

/** Quita las etiquetas indicadas, comparando sin acentos ni mayusculas. */
export function removeTags(
  actuales: readonly string[],
  aQuitar: readonly string[],
): readonly string[] {
  const fuera = new Set(aQuitar.map(normalizeTag));

  return actuales.filter((tag) => !fuera.has(normalizeTag(tag)));
}