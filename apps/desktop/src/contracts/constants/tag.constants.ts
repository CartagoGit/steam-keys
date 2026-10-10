import { KeyPlatform } from '@/contracts/enums/key-platform.enum';

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
 * Las etiquetas que ya existen en la coleccion, mas las de la plataforma.
 *
 * La lista de la plataforma va primero de las que ya existen para que las
 * sugiera el navegador en el orden en que mas probable es que se necesiten.
 */
export function suggestionsFor(
  platform: KeyPlatform,
  existentes: readonly string[],
): readonly string[] {
  const vistas = new Set(existentes.map(normalizeTag));
  const resultado: string[] = [];

  for (const tag of platformTags(platform)) {
    if (!vistas.has(normalizeTag(tag))) {
      resultado.push(tag);
      vistas.add(normalizeTag(tag));
    }
  }

  for (const tag of ORIGIN_TAGS) {
    if (!vistas.has(normalizeTag(tag))) {
      resultado.push(tag);
      vistas.add(normalizeTag(tag));
    }
  }

  for (const tag of existentes) {
    if (!vistas.has(normalizeTag(tag))) {
      resultado.push(tag);
      vistas.add(normalizeTag(tag));
    }
  }

  return resultado;
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