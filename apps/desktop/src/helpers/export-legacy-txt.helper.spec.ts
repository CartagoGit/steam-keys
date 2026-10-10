import { describe, expect, test } from 'bun:test';

import { parseLegacyTxt } from './parse-legacy-txt.helper';
import { exportKeysToLegacyTxt, formatKeyLine } from './export-legacy-txt.helper';
import { extractAnnotations } from './normalize-text.helper';
import { KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { KeySource } from '@/contracts/enums/key-source.enum';
import type { IGameKey } from '@/contracts/interfaces/game-key.interface';

/** Fixtures sinteticas: ninguna de estas claves existe. */
const KEY_A = 'MQ7RT-29XKL-ZPN84';
const KEY_B = 'B4KMD-58RQW-LNCT3';
const KEY_C = 'ZR92N-7JDMK-QPW45';

function makeEntry(overrides: Partial<IGameKey> = {}): IGameKey {
  return {
    id: 1,
    title: 'Celeste',
    keyValue: KEY_A,
    platform: KeyPlatform.Steam,
    status: KeyStatus.Available,
    source: KeySource.LegacyTxt,
    giftedTo: null,
    parentTitle: null,
    note: null,
    tags: [],
    addedOn: '2025-01-22',
    lastUsedAt: null,
    createdAt: '2025-01-22 00:00:00',
    updatedAt: '2025-01-22 00:00:00',
    ...overrides,
  };
}

describe('anotaciones del exportador', () => {
  test('separa la nota entre corchetes', () => {
    const result = extractAnnotations('celeste [Junio 2018 Humble Monthly]');

    expect(result.title).toBe('celeste');
    expect(result.note).toBe('Junio 2018 Humble Monthly');
  });

  test('separa las etiquetas entre llaves', () => {
    const result = extractAnnotations('celeste {humble,dlc}');

    expect(result.title).toBe('celeste');
    expect(result.tags).toEqual(['humble', 'dlc']);
  });

  test('reconoce la anotacion de juego padre', () => {
    const result = extractAnnotations('snowfall [parent: Cities Skylines]');

    expect(result.parentTitle).toBe('Cities Skylines');
    expect(result.note).toBeNull();
  });

  test('una linea sin anotaciones se queda igual', () => {
    const result = extractAnnotations('Celeste');

    expect(result.title).toBe('Celeste');
    expect(result.note).toBeNull();
    expect(result.parentTitle).toBeNull();
    expect(result.tags).toEqual([]);
  });
});

describe('exportacion al formato TXT', () => {
  test('la regalada lleva el guion inicial', () => {
    const line = formatKeyLine(makeEntry({ status: KeyStatus.Gifted }));

    expect(line.startsWith('- ')).toBe(true);
    expect(line).toContain('Celeste');
    expect(line).toContain(KEY_A);
  });

  test('la canjeada lleva su propio marcador', () => {
    expect(formatKeyLine(makeEntry({ status: KeyStatus.Redeemed })).startsWith('! ')).toBe(true);
    expect(formatKeyLine(makeEntry({ status: KeyStatus.Expired })).startsWith('~ ')).toBe(true);
  });

  test('la disponible no lleva marcador', () => {
    expect(formatKeyLine(makeEntry()).startsWith('Celeste')).toBe(true);
  });

  test('incluye destinatario, padre, nota y etiquetas', () => {
    const line = formatKeyLine(
      makeEntry({
        status: KeyStatus.Gifted,
        giftedTo: 'Olga',
        parentTitle: 'Half-Life 2',
        note: 'Humble Choice',
        tags: ['dlc', 'humble'],
      }),
    );

    expect(line).toContain('- Olga');
    expect(line).toContain('[parent: Half-Life 2');
    expect(line).toContain('Humble Choice');
    expect(line).toContain('{dlc,humble}');
  });
});

describe('ida y vuelta: exportar y volver a importar', () => {
  const coleccion: readonly IGameKey[] = [
    makeEntry({ id: 1, title: 'Celeste', keyValue: KEY_A, status: KeyStatus.Available }),
    makeEntry({
      id: 2,
      title: 'Hollow Knight',
      keyValue: KEY_B,
      status: KeyStatus.Gifted,
      giftedTo: 'Olga',
      note: 'Junio 2018 Humble Monthly',
      tags: ['humble'],
    }),
    makeEntry({
      id: 3,
      title: 'Cities Skylines Snowfall',
      keyValue: KEY_C,
      status: KeyStatus.Redeemed,
      parentTitle: 'Cities Skylines',
      tags: ['dlc'],
    }),
    makeEntry({
      id: 4,
      title: 'Grim Dawn',
      keyValue: 'UWFGQ-7XPL3-9KMDR',
      status: KeyStatus.Expired,
      platform: KeyPlatform.BattleNet,
    }),
  ];

  const repintadas = parseLegacyTxt(exportKeysToLegacyTxt(coleccion)).entries;

  const porClave = (clave: string) =>
    repintadas.find((entry) => entry.keyValue === clave);

  test('se recupera exactamente el mismo numero de claves', () => {
    expect(repintadas).toHaveLength(coleccion.length);
  });

  test('se conserva el titulo', () => {
    for (const original of coleccion) {
      expect(porClave(original.keyValue)?.title).toBe(original.title);
    }
  });

  test('se conserva el estado', () => {
    for (const original of coleccion) {
      expect(porClave(original.keyValue)?.status).toBe(original.status);
    }
  });

  test('se conserva el destinatario', () => {
    expect(porClave(KEY_B)?.giftedTo).toBe('Olga');
  });

  test('se conserva el juego padre de los DLC', () => {
    expect(porClave(KEY_C)?.parentTitle).toBe('Cities Skylines');
  });

  test('se conservan las etiquetas', () => {
    expect(porClave(KEY_B)?.tags).toContain('humble');
    expect(porClave(KEY_C)?.tags).toContain('dlc');
  });

  test('se conserva la plataforma no-Steam', () => {
    expect(porClave('UWFGQ-7XPL3-9KMDR')?.platform).toBe(KeyPlatform.BattleNet);
  });

  test('la nota no se cuela en el titulo', () => {
    expect(porClave(KEY_B)?.title).toBe('Hollow Knight');
    expect(porClave(KEY_B)?.note).toBe('Junio 2018 Humble Monthly');
  });

  test('exportar dos veces da el mismo resultado', () => {
    expect(exportKeysToLegacyTxt(coleccion)).toBe(exportKeysToLegacyTxt(coleccion));
  });
});