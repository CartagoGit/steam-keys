import { describe, expect, test } from 'bun:test';

import { basename } from './path.helper';

describe('nombre de la ruta', () => {
  test('se queda con el ultimo trozo', () => {
    expect(basename('/home/cartago/juegos/steam-keys.db')).toBe('steam-keys.db');
    expect(basename('steam-keys.db')).toBe('steam-keys.db');
  });

  test('parte tambien por la barra de Windows', () => {
    // Las rutas llegan del backend, y pueden venir de Windows aunque se este
    // viendo en otro sistema. `path.basename` de Node solo parte por la barra
    // del sistema, y esto devolveria la ruta entera.
    expect(basename('C:\\Juegos\\SteamKeys\\steam-keys.db')).toBe('steam-keys.db');
  });

  test('una ruta acabada en separador devuelve la ultima parte', () => {
    expect(basename('/home/cartago/juegos/')).toBe('juegos');
  });

  test('una ruta vacia no revienta', () => {
    expect(basename('')).toBe('');
  });
});