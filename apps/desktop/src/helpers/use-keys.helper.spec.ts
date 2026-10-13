import { describe, expect, test } from 'bun:test';

import { KeyPlatform, KeySource, KeyStatus, type IGameKey } from '@/contracts';

import { patchKeyIn, removeKeysFrom } from './use-keys.helper';

/** Clave de mentira con la forma de las de verdad. */
function clave(id: number, cambios: Partial<IGameKey> = {}): IGameKey {
  return {
    id,
    title: `Juego ${id}`,
    keyValue: `FAKE-${id}-AAAAA-BBBBB`,
    platform: KeyPlatform.Steam,
    status: KeyStatus.Available,
    source: KeySource.Manual,
    giftedTo: null,
    parentTitle: null,
    note: null,
    tags: [],
    addedOn: null,
    lastUsedAt: null,
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
    ...cambios,
  };
}

/*
 * Estas pruebas son de las dos funciones puras, no del hook.
 *
 * Bun no trae `renderHook` y el repo no trae nada para montar React —los specs
 * de `use-loading` y de `undo` prueban igual que aqui, `conTiempoLimite` y
 * `borradorDe`—, asi que el cableado del hook se queda sin cubrir. Lo que si se
 * cubre es lo que tiene reglas: que se sustituya por id y no por posicion, que
 * una clave que no estaba no se pierda, y que ninguna de las dos devuelva el
 * mismo array que le dieron.
 */
describe('sustituir una clave en la lista', () => {
  test('cambia la que tiene el mismo id', () => {
    const lista = [clave(1, { title: 'Viejo' }), clave(2)];
    const salida = patchKeyIn(lista, clave(1, { title: 'Nuevo' }));

    expect(salida).toHaveLength(2);
    expect(salida[0]?.title).toBe('Nuevo');
  });

  test('sustituye por id y no por posicion ni por contenido', () => {
    /*
     * Las dos tienen el mismo titulo, asi que comparar por contenido —que es lo
     * que haria un `find` por titulo— cambiaria la fila equivocada. El id es lo
     * unico que identifica una fila: es lo que devuelve el servicio.
     */
    const lista = [clave(1, { title: 'Igual' }), clave(2, { title: 'Igual' })];
    const salida = patchKeyIn(lista, clave(2, { title: 'Igual', status: KeyStatus.Gifted }));

    expect(salida.map((k) => k.status)).toEqual([KeyStatus.Available, KeyStatus.Gifted]);
  });

  test('anade la que no estaba, en vez de perderla', () => {
    /*
     * Una clave que viene de una fusion o de un import trae ids de otra base.
     * Si no estaba, ignorarla haria desaparecer una fila que el usuario acaba
     * de guardar en la base de datos.
     */
    const salida = patchKeyIn([clave(1)], clave(2, { title: 'Nueva' }));

    expect(salida.map((k) => k.id)).toEqual([1, 2]);
  });

  test('no toca el array que le dieron', () => {
    const lista = [clave(1, { title: 'Viejo' })];

    patchKeyIn(lista, clave(1, { title: 'Nuevo' }));

    /*
     * React compara con `Object.is`, asi que devolver el mismo array haria que
     * el componente no repintase y el cambio se quedase solo en la base de
     * datos. Este es el fallo silencioso que cuesta una tarde.
     */
    expect(lista[0]?.title).toBe('Viejo');
  });

  test('con dos filas del mismo id las cambia a las dos', () => {
    /*
     * `map` cambia todas las que coinciden, no solo la primera. No es
     * decision, es lo que hace `map`: la alternativa —parar en la primera—
     * seria mas codigo para un caso que no se puede dar, porque el id es clave
     * primaria y dos filas con el mismo id no existen en la base de datos. Se
     * deja escrito para que nadie lo lea como un cambio sin querer.
     */
    const salida = patchKeyIn([clave(1), clave(1)], clave(1, { title: 'Nueva' }));

    expect(salida.map((k) => k.title)).toEqual(['Nueva', 'Nueva']);
  });

  test('una lista vacia se queda con la clave suelta', () => {
    expect(patchKeyIn([], clave(1))).toHaveLength(1);
  });
});

describe('quitar claves de la lista', () => {
  test('quita las que tienen el id dado', () => {
    const salida = removeKeysFrom([clave(1), clave(2), clave(3)], [1, 3]);

    expect(salida.map((k) => k.id)).toEqual([2]);
  });

  test('quitar un id que no esta no cambia nada', () => {
    expect(removeKeysFrom([clave(1)], [99])).toHaveLength(1);
  });

  test('quitar todas deja la lista vacia', () => {
    expect(removeKeysFrom([clave(1), clave(2)], [1, 2])).toEqual([]);
  });

  test('quitar ninguno deja la lista como estaba', () => {
    expect(removeKeysFrom([clave(1), clave(2)], [])).toHaveLength(2);
  });

  test('conserva el orden de las que quedan', () => {
    const salida = removeKeysFrom([clave(1), clave(2), clave(3), clave(4)], [2, 4]);

    expect(salida.map((k) => k.id)).toEqual([1, 3]);
  });
});