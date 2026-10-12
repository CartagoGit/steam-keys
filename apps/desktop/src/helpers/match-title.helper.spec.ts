import { describe, expect, test } from 'bun:test';

import { normalizeForMatch } from './match-title.helper';

/**
 * `normalizeForMatch` es lo que hace comparables dos titulos escritos de
 * distinta forma. Es la pieza de la que depende todo el emparejado por
 * nombre, asi que sus casos van aqui y no junto al servicio que la
 * consume.
 */

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
