import { describe, expect, test } from 'bun:test';

import { sortKeys } from './filter-keys.helper';
import { KeyPlatform, KeySource, KeyStatus, KeySort, type IGameKey } from '@/contracts';

function clave(id: number, over: Partial<IGameKey> = {}): IGameKey {
  return {
    id,
    title: 'Juego',
    keyValue: `KEY-${id}`,
    platform: KeyPlatform.Steam,
    status: KeyStatus.Available,
    source: KeySource.Manual,
    giftedTo: null,
    parentTitle: null,
    note: null,
    tags: [],
    addedOn: '2020-01-01',
    lastUsedAt: null,
    createdAt: '2020-01-01 00:00:00',
    updatedAt: '2020-01-01 00:00:00',
    ...over,
  };
}

describe('orden estable', () => {
  test('alfabetico desempata por id entre claves del mismo juego', () => {
    // El caso que se notaba: el mismo juego con dos claves —lo normal— comparte
    // titulo, y sin desempate su orden relativo dependia de como llegara la
    // lista. Al quitar un filtro, las filas cambiaban de sitio sin que hubiera
    // cambiado nada.
    const entrada = [clave(3), clave(1), clave(2)];

    expect(sortKeys(entrada, KeySort.Alfabetico).map((k) => k.id)).toEqual([1, 2, 3]);
  });

  test('repartir la lista en dos y volver a unir da el mismo orden', () => {
    const entrada = [clave(5), clave(2), clave(9), clave(1), clave(7)];
    const primera = sortKeys(entrada, KeySort.Alfabetico);
    const troceada = [...primera.slice(0, 2), ...primera.slice(2)];

    expect(sortKeys(troceada, KeySort.Alfabetico).map((k) => k.id)).toEqual(
      primera.map((k) => k.id),
    );
  });

  test('por estado desempata por titulo y luego por id', () => {
    const entrada = [
      clave(3, { status: KeyStatus.Expired, title: 'Zelda' }),
      clave(1, { status: KeyStatus.Available, title: 'Bravo' }),
      clave(2, { status: KeyStatus.Available, title: 'Alfa' }),
      clave(4, { status: KeyStatus.Expired, title: 'Alfa' }),
    ];

    expect(sortKeys(entrada, KeySort.Estado).map((k) => k.id)).toEqual([2, 1, 4, 3]);
  });

  test('reciente ordena por la mas reciente y no se mueve al reordenar', () => {
    const entrada = [
      clave(1, { addedOn: '2020-01-01' }),
      clave(2, { addedOn: '2022-06-01' }),
      clave(3, { addedOn: null, createdAt: '2021-03-01 00:00:00' }),
    ];

    expect(sortKeys(entrada, KeySort.Reciente).map((k) => k.id)).toEqual([2, 3, 1]);
    expect(sortKeys([...entrada].reverse(), KeySort.Reciente).map((k) => k.id)).toEqual([
      2, 3, 1,
    ]);
  });

  test('no toca la lista que recibe', () => {
    const entrada = [clave(3), clave(1), clave(2)];
    const copia = [...entrada];

    sortKeys(entrada, KeySort.Alfabetico);

    expect(entrada).toEqual(copia);
  });
});