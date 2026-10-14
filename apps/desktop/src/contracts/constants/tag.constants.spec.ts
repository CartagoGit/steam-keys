import { describe, expect, test } from 'bun:test';

import {
  cleanTag,
  mergeTags,
  normalizeTag,
  platformTags,
  presentaTag,
  removeTags,
  suggestionsFor,
} from '@/contracts/constants/tag.constants';
import { KeyPlatform } from '@/contracts/enums/key-platform.enum';

/**
 * La clave y el titulo son dos preguntas distintas, y por eso dos funciones.
 *
 * `normalizeTag` contesta «¿son la misma etiqueta?» y `presentaTag` contesta
 * «¿cómo se escribe?». Si se usara la primera para las dos, renombrar «dlc» a
 * «DLC» no tendria sitio donde guardarse; si se usara la segunda para buscar,
 * «dlc» y «DLC» serian dos etiquetas.
 */
describe('el titulo de una etiqueta', () => {
  test('limpia los espacios pero respeta como esta escrito', () => {
    expect(presentaTag('  juego   de   rol  ')).toBe('juego de rol');
    expect(presentaTag('DLC')).toBe('DLC');
    expect(presentaTag('Promo Café')).toBe('Promo Café');
  });

  test('la clave de ese mismo titulo es la normalizada', () => {
    /*
     * La pareja completa, que es la que se guarda. «Promo Café» se enseña tal
     * cual y se busca como «promo cafe»: si se buscara con la caja, escribir
     * «promo cafe» no encontraria la etiqueta que esta escrita con tilde.
     */
    const escrito = presentaTag('Promo Café');

    expect(normalizeTag(escrito)).toBe('promo cafe');
  });

  test('los espacios de en medio tambien se aprietan en la clave', () => {
    expect(normalizeTag(presentaTag('  juego   de   rol  '))).toBe('juego de rol');
  });
});

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