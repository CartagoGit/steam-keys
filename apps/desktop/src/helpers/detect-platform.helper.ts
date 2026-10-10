import { KeyPlatform } from '@/contracts/enums/key-platform.enum';

/**
 * Deduce la plataforma a partir de la *forma* de la clave.
 *
 * El TXT mezcla claves de Steam con Giveaways de otras tiendas. Solo se da por
 * segura la forma de Steam (5-5-5) y la de Battle.net (3-3-2). Todo lo demas
 * se marca como `Unknown` a proposito: equivocar la plataforma es peor que
 * pedirla al usuario, que la corrige en un clic desde la UI.
 */
export function inferPlatformFromKeyShape(keyValue: string): KeyPlatform {
  const value = keyValue.trim().toUpperCase();

  // Steam: cinco-cinco-cinco.
  if (/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(value)) {
    return KeyPlatform.Steam;
  }

  // Battle.net: tres-tres-tres.
  if (/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(value)) {
    return KeyPlatform.BattleNet;
  }

  return KeyPlatform.Unknown;
}

/**
 * Traduce las pistas textuales del TXT ("BATTLE.NET", "BLADE & SOUL", ...) a
 * una plataforma. Devuelve `null` cuando el texto no aporta nada.
 */
export function platformFromHint(hint: string | null | undefined): KeyPlatform | null {
  if (!hint) return null;

  const text = hint.toUpperCase();

  if (text.includes('BATTLE.NET') || text.includes('BATTLE NET') || text.includes('BLIZARD')) {
    return KeyPlatform.BattleNet;
  }
  if (text.includes('GUILD WARS')) return KeyPlatform.GuildWars2;
  if (text.includes('NEVERWINTER')) return KeyPlatform.Neverwinter;
  if (text.includes('BLADE')) return KeyPlatform.BladeAndSoul;
  if (/\bESO\b/.test(text) || text.includes('ELDER SCROLLS ONLINE')) {
    return KeyPlatform.ElderScrollsOnline;
  }

  return null;
}