import { describe, expect, test } from 'bun:test';
import { normalizeForMatch } from '@/helpers/match-title.helper';

import {
  bestCandidate,
  confidenceFor,
  levenshtein,
  resolveSteamId,
  similarity,
} from './steam.service';
import type { ISteamOwnedGame } from '@/contracts';

/** Juego de Steam de mentira. */
function juego(appId: number, name: string, isDlc = false): ISteamOwnedGame {
  return {
    appId,
    name,
    playtimeForever: 0,
    lastPlayed: 0,
    isDlc,
    iconUrl: null,
  };
}

describe('averiguar el ID de Steam', () => {
  // El numero de ejemplo es el del perfil publico de Valve, no el de ninguna
  // persona: un test que depende de la cuenta de alguien se rompe si esa
  // persona renombra el perfil, y ademas pone un nombre real en el historial de
  // git sin querer.
  const ID_DE_EJEMPLO = '76561197960287930';

  test('un numero de 17 cifras se acepta tal cual', async () => {
    expect(await resolveSteamId(ID_DE_EJEMPLO)).toBe(ID_DE_EJEMPLO);
  });

  test('los espacios alrededor no estorban', async () => {
    expect(await resolveSteamId(`  ${ID_DE_EJEMPLO}  `)).toBe(ID_DE_EJEMPLO);
  });

  test('un SteamID de 32 digitos se pasa sin tocar', async () => {
    const id32 = '79614873091234567890123456789012';

    expect(await resolveSteamId(id32)).toBe(id32);
  });

  test('algo que no es ni ID ni nombre da un error legible', async () => {
    // No se llega a hacer ninguna peticion: se rechaza antes, y sin red.
    await expect(resolveSteamId('no es un id!!')).rejects.toThrow(
      /no parece un id de steam/i,
    );
  });

  test('un nombre con espacios de mas se limpia antes de buscarlo', async () => {
    await expect(resolveSteamId('   ')).rejects.toThrow();
  });

  test('un texto sin forma de ID se rechaza sin llamar a nadie', async () => {
    await expect(resolveSteamId('a b c')).rejects.toThrow(/no parece/i);
  });
});

describe('normalizar el titulo quitando la edicion', () => {
  test('quita el GOTY', () => {
    expect(normalizeForMatch('Middle-earth: Shadow of Mordor GOTY Edition')).toBe(
      'middle earth shadow of mordor',
    );
  });

  test('quita el Definitive', () => {
    expect(normalizeForMatch('Terraria Definitive Edition')).toBe('terraria');
  });

  test('deja intacto lo que no lleva coletilla', () => {
    expect(normalizeForMatch('Cities: Skylines - Snowfall')).toBe(
      'cities skylines snowfall',
    );
  });

  test('no se come el juego cuando la coletilla es el titulo entero', () => {
    expect(normalizeForMatch('Definitive Edition')).toBe('definitive edition');
  });

  // Antes el servicio **no** quitaba acentos y la app si, con dos
  // implementaciones distintas. Con una sola, los dos caminos coinciden: es el
  // caso de "Pokemon" contra "Pokémon", que antes no se emparejaban al buscar
  // en la biblioteca de Steam.
  test('los acentos no impiden reconocer el mismo juego', () => {
    expect(normalizeForMatch('Pokémon')).toBe(normalizeForMatch('Pokemon'));
    expect(normalizeForMatch('Pokémon Lets Go Pikachu')).toBe(
      normalizeForMatch('Pokemon Lets Go Pikachu'),
    );
  });

  test('la coletilla de edicion se quita con o sin puntuacion delante', () => {
    // El caso por el que existia la falta: una clave con la coletilla contra un
    // juego que la lista de Steam no la trae.
    expect(normalizeForMatch('Middle-earth: Shadow of Mordor GOTY Edition')).toBe(
      normalizeForMatch('Middle-earth: Shadow of Mordor'),
    );
    expect(normalizeForMatch("Shadow of Mordor - Collector's Edition")).toBe(
      normalizeForMatch('Shadow of Mordor'),
    );
  });
});

describe('distancia entre titulos', () => {
  test('dos cadenas iguales valen 1', () => {
    expect(similarity('Celeste', 'Celeste')).toBe(1);
  });

  test('solo los puntos separan dos titulos', () => {
    expect(similarity('Cities: Skylines', 'Cities Skylines')).toBeCloseTo(1, 2);
  });

  test('dos juegos sin relacion valen casi 0', () => {
    expect(similarity('Witcher 3', 'Twisted Metal')).toBeLessThan(0.4);
  });

  test('levenshtein cuenta los cambios minimos', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', 'abc')).toBe(0);
  });
});

describe('la confianza del emparejamiento', () => {
  test('un nombre identico es exacto', () => {
    expect(confidenceFor(1, 1)).toBe('exact');
  });

  test('un parecido alto con varios candidatos es dudoso', () => {
    expect(confidenceFor(0.9, 5)).toBe('loose');
  });

  test('un parecido alto con un solo candidato es probable', () => {
    expect(confidenceFor(0.9, 1)).toBe('likely');
  });

  test('un parecido bajo no se empareja', () => {
    expect(confidenceFor(0.3, 1)).toBe('none');
  });
});

describe('elegir el mejor candidato de una busqueda', () => {
  test('sin candidatos no hay nada que devolver', () => {
    const r = bestCandidate('Celeste', []);

    expect(r.elegido).toBeNull();
    expect(r.confianza).toBe('none');
  });

  test('elige el juego que mas se parece, no el primero', () => {
    const r = bestCandidate('Middle-earth: Shadow of Mordor', [
      juego(1, 'Middle-earth: Shadow of Mordor - Power of Shadow', true),
      juego(2, 'Middle-earth: Shadow of Mordor'),
      juego(3, 'Middle-earth: Shadow of Mordor - Berserks Warband', true),
    ]);

    expect(r.elegido?.appId).toBe(2);
    expect(r.confianza).toBe('exact');
  });

  test('queda el DLC cuando es lo que mas se parece', () => {
    const r = bestCandidate('Cities Skylines Snowfall', [
      juego(420610, 'Cities: Skylines - Snowfall', true),
      juego(255960, 'Cities: Skylines'),
    ]);

    // El titulo de la key es *del DLC*, asi que el DLC es la respuesta
    // correcta: la pregunta es "tengo esto", no "tengo el juego base".
    expect(r.elegido?.appId).toBe(420610);
  });

  test('con un solo DLC y sin alternativa devuelve el DLC', () => {
    const r = bestCandidate('Cities Skylines Snowfall', [
      juego(420610, 'Cities: Skylines - Snowfall', true),
    ]);

    expect(r.elegido?.appId).toBe(420610);
  });

  test('un titulo sin nada parecido no se empareja', () => {
    const r = bestCandidate('Witcher 3', [
      juego(1, 'Counter-Strike'),
      juego(2, 'Team Fortress'),
    ]);

    expect(r.elegido?.appId).not.toBeNull();
    expect(r.confianza).toBe('none');
  });

  test('devuelve todas las puntuaciones para poder revisar', () => {
    const r = bestCandidate('Celeste', [juego(1, 'Celeste'), juego(2, 'Celeste Classic')]);

    expect(r.puntuaciones).toHaveLength(2);
    expect(r.puntuaciones[0]).toBeGreaterThanOrEqual(r.puntuaciones[1]!);
  });
});