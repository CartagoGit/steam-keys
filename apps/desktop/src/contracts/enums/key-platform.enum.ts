/**
 * Plataforma a la que pertenece una key.
 * El TXT original mezcla Steam con claves de otras tiendas, asi que el valor
 * se deduce por la forma de la clave o se fija a mano desde la UI.
 */
export enum KeyPlatform {
  Steam = 'steam',
  BattleNet = 'battlenet',
  GuildWars2 = 'guildwars2',
  Neverwinter = 'neverwinter',
  BladeAndSoul = 'bladeandsoul',
  ElderScrollsOnline = 'elderscrollsonline',
  Unknown = 'unknown',
}

/** Lista cerrada de plataformas, util para validar y para pintar filtros. */
export const KEY_PLATFORM_VALUES: readonly KeyPlatform[] = Object.freeze([
  KeyPlatform.Steam,
  KeyPlatform.BattleNet,
  KeyPlatform.GuildWars2,
  KeyPlatform.Neverwinter,
  KeyPlatform.BladeAndSoul,
  KeyPlatform.ElderScrollsOnline,
  KeyPlatform.Unknown,
]);