import { describe, expect, test } from 'bun:test';

import { buildGiftTxt, giftFileName } from './gift-export.helper';
import { KeyPlatform, KeySource, KeyStatus, type IGameKey } from '@/contracts';

/** Clave de mentira con el titulo que se le pase. */
function claveFalsa(id: number, title: string, keyValue: string): IGameKey {
  return {
    id,
    title,
    keyValue,
    platform: KeyPlatform.Steam,
    status: KeyStatus.Available,
    source: KeySource.LegacyTxt,
    giftedTo: null,
    parentTitle: null,
    note: null,
    tags: [],
    addedOn: null,
    lastUsedAt: null,
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
  };
}

describe('exportar las claves para regalar', () => {
  test('cada juego va con su nombre y su clave en lineas separadas', () => {
    const txt = buildGiftTxt([
      claveFalsa(1, 'Celeste', 'MQ7RT-29XKL-ZPN84'),
      claveFalsa(2, 'Hollow Knight', 'B4KMD-58RQW-LNCT3'),
    ]);

    expect(txt).toBe(
      'Celeste\nMQ7RT-29XKL-ZPN84\n\nHollow Knight\nB4KMD-58RQW-LNCT3',
    );
  });

  test('las claves van en claro, porque un TXT para regalar tiene que servirlas', () => {
    const txt = buildGiftTxt([claveFalsa(1, 'Celeste', 'MQ7RT-29XKL-ZPN84')]);

    expect(txt).toContain('MQ7RT-29XKL-ZPN84');
    expect(txt).not.toContain('*');
  });

  test('los saltos de linea del titulo no rompen el formato', () => {
    // Un titulo con salto de linea partia el TXT en dos entradas y la clave
    // acababa sola, que es justo lo que el parser lee como otra key.
    const txt = buildGiftTxt([claveFalsa(1, 'Celeste\nRemastered', 'MQ7RT-29XKL-ZPN84')]);

    expect(txt).toBe('Celeste Remastered\nMQ7RT-29XKL-ZPN84');
    expect(txt.split('\n')).toHaveLength(2);
  });

  test('sin claves seleccionadas sale un TXT vacio, no un "undefined"', () => {
    expect(buildGiftTxt([])).toBe('');
  });

  test('el nombre del fichero lleva la fecha para no sobrescribir', () => {
    expect(giftFileName(new Date('2026-10-11T12:00:00Z'))).toBe(
      'claves-para-regalar-2026-10-11.txt',
    );
  });
});