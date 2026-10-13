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
 * Las familias de color del panel.
 *
 * Se agrupan por **familia** y no por tono suelto porque es como se elige: primero
 * el color —rojo, verde, azul— y despues lo claro o lo oscuro. Al reves, con
 * dieciocho tonos sin familia, habia que acordarse de que el morado claro estaba
 * en la fila de arriba a la izquierda.
 */
export const TAG_FAMILIAS = ['red', 'orange', 'amber', 'green', 'sky', 'violet'] as const;

/** Una de las familias del panel de color. */
export type TagFamilia = (typeof TAG_FAMILIAS)[number];

/**
 * Un color del panel.
 *
 * El `hex` va **escrito**, y no como una clase de Tailwind, porque es lo unico
 * que esta app pinta con un color que no viene de un tema: lo elige la persona.
 * Con `bg-red-500` solo habria diez colores y ademas estarian atados al tema —
 * un rojo de fondo oscuro se lava sobre un crema—, mientras que un `hex` se
 * pinta igual en los nueve.
 *
 * Son los que trae la rampa de Tailwind, convertidos a `hex` para poder
 * guardarlos y poder medir su contraste. Las clases `bg-red-500` y las demas
 * **no** se usan para esto: un color elegido no es un color de la rampa, es un
 * color cualquiera, y ahi si hay que poder contrastarlo.
 */
export interface ITagTono {
  /** El color, en hexadecimal. */
  hex: string;
  /** La familia a la que pertenece. */
  familia: TagFamilia;
  /**
   * Cuanto claro es: 1 el mas claro, 3 el mas oscuro.
   *
   * Es un numero y no un color porque el panel los ordena por el y porque las
   * tres columnas son el mismo tono a distinta luz: no son tres colores, es uno
   * con tres pasos de claridad.
   */
  paso: 1 | 2 | 3;
}

/** Las dieciocho muestras, por filas: de la familia mas clara a la mas oscura. */
export const TAG_TONOS: readonly ITagTono[] = Object.freeze([
  { hex: '#ffa2a2', familia: 'red', paso: 1 },
  { hex: '#ffb86a', familia: 'orange', paso: 1 },
  { hex: '#ffd230', familia: 'amber', paso: 1 },
  { hex: '#7bf1a8', familia: 'green', paso: 1 },
  { hex: '#74d4ff', familia: 'sky', paso: 1 },
  { hex: '#c4b4ff', familia: 'violet', paso: 1 },
  { hex: '#fb2c36', familia: 'red', paso: 2 },
  { hex: '#ff6900', familia: 'orange', paso: 2 },
  { hex: '#fe9a00', familia: 'amber', paso: 2 },
  { hex: '#00c950', familia: 'green', paso: 2 },
  { hex: '#00a6f4', familia: 'sky', paso: 2 },
  { hex: '#8e51ff', familia: 'violet', paso: 2 },
  { hex: '#c10007', familia: 'red', paso: 3 },
  { hex: '#ca3500', familia: 'orange', paso: 3 },
  { hex: '#bb4d00', familia: 'amber', paso: 3 },
  { hex: '#008236', familia: 'green', paso: 3 },
  { hex: '#0069a8', familia: 'sky', paso: 3 },
  { hex: '#7008e7', familia: 'violet', paso: 3 },
]);

/** Las tres columnas del panel: de la mas clara a la mas oscura. */
export const TAG_PASOS: readonly (1 | 2 | 3)[] = Object.freeze([1, 2, 3]);

/** El texto que se pone encima de un color, medido contra el. */
export const TEXTO_CLARO = '#ffffff';
export const TEXTO_OSCURO = '#10151f';

/**
 * Si un color guardado es de los que se sabe pintar.
 *
 * Es la unica puerta por la que pasa lo que llega de la base de datos, y tiene que
 * ser estrecha. La columna la escribe la app, pero el fichero de la base se
 * puede abrir y editar a mano, y un `color` con cualquier cosa dentro —un
 * `red`, un `#fff` de tres digitos, un texto entero— se pondria tal cual en el
 * `style` de la pastilla. Ahi no hay ni error ni aviso: sale un color raro y ya
 * esta. Lo que no se reconoce se trata como **sin color**, que es justo lo que
 * se ve entonces.
 */
export function parseTagColor(valor: string): string {
  const limpio = valor.trim().toLowerCase();

  return /^#[0-9a-f]{6}$/.test(limpio) ? limpio : '';
}

/**
 * Si un color es el que hay en la paleta.
 *
 * Distinto de `parseTagColor`: aqui se admite cualquier hexadecimal, porque el
 * panel podria crecer y una base con un color de una version anterior tiene que
 * seguir pintandose. Lo que se rechaza es lo que no es un color.
 */
export function esHex(limpio: string): boolean {
  return /^#[0-9a-f]{6}$/.test(limpio);
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