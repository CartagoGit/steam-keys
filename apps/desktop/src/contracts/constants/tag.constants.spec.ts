import { describe, expect, test } from 'bun:test';

import {
  cleanTag,
  mergeTags,
  normalizeTag,
  platformTags,
  removeTags,
  suggestionsFor,
} from '@/contracts/constants/tag.constants';
import { KeyPlatform } from '@/contracts/enums/key-platform.enum';

describe('normalizar etiquetas', () => {
  test('quita acentos y pasa a minusculas', () => {
    expect(normalizeTag('Edición')).toBe('edicion');
  });

  test('aprieta los espacios sobrantes', () => {
    expect(cleanTag('  juego   de   rol  ')).toBe('juego de rol');
  });

  test('deja intacto el guion de blade-and-soul', () => {
    expect(cleanTag('Blade-and-Soul')).toBe('blade-and-soul');
  });
});

describe('etiquetas por plataforma', () => {
  test('cada plataforma tiene sus propias etiquetas', () => {
    expect(platformTags(KeyPlatform.Steam)).toContain('steam');
    expect(platformTags(KeyPlatform.GuildWars2)).toContain('gw2');
    expect(platformTags(KeyPlatform.ElderScrollsOnline)).toContain('eso');
  });

  test('una plataforma sin etiqueta propia no propone nada', () => {
    expect(platformTags(KeyPlatform.Unknown)).toHaveLength(0);
  });

  test('las sugerencias empiezan por las de la plataforma', () => {
    const sugeridas = suggestionsFor(KeyPlatform.BattleNet, []);

    expect(sugeridas[0]).toBe('battlenet');
  });

  test('una etiqueta que ya existe no sale dos veces', () => {
    const sugeridas = suggestionsFor(KeyPlatform.Steam, ['steam', 'dlc']);

    const vapores = sugeridas.map(normalizeTag);

    // `steam` y `dlc` salen, pero solo una vez: viene de las sugerencias de la
    // plataforma y de la lista de origen, y tambien estaban en la coleccion.
    expect(vapores).toContain('steam');
    expect(vapores).toContain('dlc');
    expect(new Set(vapores).size).toBe(vapores.length);
  });

  test('las etiquetas que ya hay se ofrecen al final', () => {
    const sugeridas = suggestionsFor(KeyPlatform.Steam, ['mi-etiqueta']);

    // Las de la plataforma van primero; las que ya existen en la coleccion se
    // añaden al final, que es donde estan las menos frecuentes.
    expect(sugeridas[0]).toBe('steam');
    expect(sugeridas).toContain('mi-etiqueta');
  });
});

describe('fusionar etiquetas', () => {
  test('añade las que faltan', () => {
    expect(mergeTags(['dlc'], ['promo'])).toEqual(['dlc', 'promo']);
  });

  test('no repite aunque cambien las mayusculas', () => {
    expect(mergeTags(['Humble'], ['humble'])).toEqual(['Humble']);
  });

  test('ignora las cadenas vacias', () => {
    expect(mergeTags(['dlc'], ['', '   '])).toEqual(['dlc']);
  });

  test('no toca el array original', () => {
    const original = ['dlc'];

    mergeTags(original, ['promo']);

    expect(original).toEqual(['dlc']);
  });
});

describe('quitar etiquetas', () => {
  test('quita las indicadas', () => {
    expect(removeTags(['dlc', 'promo'], ['promo'])).toEqual(['dlc']);
  });

  test('quita sin importar las mayusculas', () => {
    expect(removeTags(['Humble', 'dlc'], ['humble'])).toEqual(['dlc']);
  });

  test('deja el array intacto si no quita ninguna', () => {
    expect(removeTags(['dlc'], ['promo'])).toEqual(['dlc']);
  });
});