import { describe, expect, test } from 'bun:test';

import {
  bestCandidate,
  confidenceFor,
  levenshtein,
  normalizeTitle,
  resolveSteamId,
  similarity,
} from './steam.service';
import type { ISteamOwnedGame } from '@/contracts/interfaces/steam-account.interface';

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
  test('un numero de 17 cifras se acepta tal cual', async () => {
    expect(await resolveSteamId('76561198023249625')).toBe('76561198023249625');
  });

  test('los espacios alrededor no estorban', async () => {
    expect(await resolveSteamId('  76561198023249625  ')).toBe('76561198023249625');
  });

  test('un nombre de perfil se traduce al numero', async () => {
    // Se comprueba contra el XML publico real de Steam, que es la misma
    // llamada que hara la app. Sin API key.
    expect(await resolveSteamId('cartagonova')).toBe('76561198023249625');
  });

  test('se acepta la direccion completa del perfil', async () => {
    expect(
      await resolveSteamId('https://steamcommunity.com/id/cartagonova'),
    ).toBe('76561198023249625');
  });

  test('un nombre que no existe da un error legible', async () => {
    await expect(resolveSteamId('este-perfil-no-existe-xyz')).rejects.toThrow(
      /no hay ningun perfil/i,
    );
  });

  test('un texto sin forma de ID se rechaza sin llamar a nadie', async () => {
    await expect(resolveSteamId('a b c')).rejects.toThrow(/no parece/i);
  });
});

describe('normalizar el titulo quitando la edicion', () => {
  test('quita el GOTY', () => {
    expect(normalizeTitle('Middle-earth: Shadow of Mordor GOTY Edition')).toBe(
      'middle earth shadow of mordor',
    );
  });

  test('quita el Definitive', () => {
    expect(normalizeTitle('Terraria Definitive Edition')).toBe('terraria');
  });

  test('deja intacto lo que no lleva coletilla', () => {
    expect(normalizeTitle('Cities: Skylines - Snowfall')).toBe(
      'cities skylines snowfall',
    );
  });

  test('no se come el juego cuando la coletilla es el titulo entero', () => {
    expect(normalizeTitle('Definitive Edition')).toBe('definitive edition');
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