import { describe, expect, test } from 'bun:test';

import {
  STATUS_MARKER_CHARS,
  STATUS_MARKERS,
  markerForStatus,
  statusForMarker,
} from './legacy-format.constants';
import { KEY_STATUS_VALUES, KeyStatus } from '../enums/key-status.enum';

/**
 * El mapa de marcadores es la unica fuente de verdad de la ida y vuelta
 * exportar -> importar. Estos tests fijan las tres cosas que pueden romperla:
 * que `STATUS_MARKER_CHARS` no se desincronice del mapa, que la ida y la vuelta
 * sean inversas, y que un caracter corriente no se lea como estado.
 */
describe('marcadores de estado del TXT', () => {
  test('los caracteres derivados son exactamente las claves del mapa', () => {
    expect([...STATUS_MARKER_CHARS].sort()).toEqual(Object.keys(STATUS_MARKERS).sort());
  });

  test('cada estado con marcador se recupera al escribirlo', () => {
    for (const [char, status] of Object.entries(STATUS_MARKERS)) {
      expect(statusForMarker(char)).toBe(status);
      expect(markerForStatus(status)).toBe(char);
    }
  });

  test('disponible se escribe sin prefijo: el TXT original no lo distinguia', () => {
    expect(markerForStatus(KeyStatus.Available)).toBeNull();
  });

  test('un caracter corriente no es un estado', () => {
    // Cubre el `if (STATUS_MARKERS[char])` que el tipo `Record<string, ...>`
    // hacia invisible: con el mapa abierto, indexar devuelve `KeyStatus` y el
    // chequeo parece redundante, pero en runtime es la unica proteccion.
    for (const char of ['A', '0', ' ', '', '#', '*', 'x']) {
      expect(statusForMarker(char)).toBeNull();
    }
  });

  test('todos los estados del enum se pueden escribir o son sin marcador', () => {
    for (const status of KEY_STATUS_VALUES) {
      const marker = markerForStatus(status);
      expect(marker === null || STATUS_MARKERS[marker] === status).toBe(true);
    }
  });

  test('el guion del TXT original sigue significando "regalada"', () => {
    expect(statusForMarker('-')).toBe(KeyStatus.Gifted);
    expect(markerForStatus(KeyStatus.Gifted)).toBe('-');
  });
});