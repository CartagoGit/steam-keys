import { describe, expect, test } from 'bun:test';

import { emptyFilter, filterKeys, sortKeys } from './filter-keys.helper';
import {
  KeyPlatform,
  KeyScope,
  KeySource,
  KeyStatus,
  KeySort,
  type IGameKey,
  type IKeyFilter,
} from '@/contracts';

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
/**
 * La exclusion: varias etiquetas marcadas, «y» o «o».
 *
 * Con OR sale lo que lleva **cualquiera** de las marcadas, que es lo que se
 * quiere casi siempre. Con `excluir` hay que llevarlas todas, que es el otro
 * filtro que se quiere a veces y que con OR no se puede pedir.
 */
describe('combinar varias etiquetas', () => {
  const catalogo = [
    clave(1, { tags: ['cumplidos', 'regalo'] }),
    clave(2, { tags: ['cumplidos'] }),
    clave(3, { tags: ['regalo'] }),
    clave(4, { tags: [] }),
  ];

  const titulos = (keys: readonly IGameKey[]) => keys.map((k) => k.title + '#' + k.id);

  test('sin marcar nada se ve todo, y da igual el modo', () => {
    expect(titulos(filterKeys(catalogo, emptyFilter()))).toHaveLength(4);
    expect(titulos(filterKeys(catalogo, { ...emptyFilter(), excluir: true }))).toHaveLength(4);
  });

  test('con una sola marcada los dos modos coinciden', () => {
    const base = { ...emptyFilter(), tags: ['cumplidos'] };

    expect(titulos(filterKeys(catalogo, base))).toEqual(['Juego#1', 'Juego#2']);
    expect(titulos(filterKeys(catalogaPor(catalogo), { ...base, excluir: true }))).toEqual(['Juego#1', 'Juego#2']);
  });

  test('sin excluir sale lo que lleva alguna: es una disyunion', () => {
    const r = filterKeys(catalogo, { ...emptyFilter(), tags: ['cumplidos', 'regalo'] });

    expect(titulos(r)).toEqual(['Juego#1', 'Juego#2', 'Juego#3']);
  });

  test('excluyendo sale lo que lleva todas: es una conjuncion', () => {
    const r = filterKeys(catalogo, { ...emptyFilter(), tags: ['cumplidos', 'regalo'], excluir: true });

    expect(titulos(r)).toEqual(['Juego#1']);
  });

  test('excluyendo con tres marcadas es casi siempre vacio, y hay que verlo asi', () => {
    // Con AND y tres etiquetas, casi ninguna clave las lleva todas. Devolver la
    // lista vacia es la respuesta correcta —y hay que decirla, no disimularla
    // quitando la exclusion sin avisar.
    const r = filterKeys(catalogo, {
      ...emptyFilter(),
      tags: ['cumplidos', 'regalo', 'nunca'],
      excluir: true,
    });

    expect(r).toEqual([]);
  });

  test('la exclusion no toca las etiquetas de las claves', () => {
    const r = filterKeys(catalogo, { ...emptyFilter(), tags: ['cumplidos'], excluir: true });

    // Con `excluir` la clave tiene que llevar la etiqueta: es un «y», no un
    // «o». El `!` se come el `undefined` porque con `noUncheckedIndexedAccess`
    // el elemento es opcional, y si el filtro fallara el test tiene que
    // fallar tambien —no reventar con un error de tipo.
    expect(r[0]?.tags).toEqual(['cumplidos', 'regalo']);
    expect(catalogo[0]?.tags).toEqual(['cumplidos', 'regalo']);
  });
});

/** Copia la lista, para comprobar que el filtro no toca el original. */
function catalogaPor(origen: readonly IGameKey[]): readonly IGameKey[] {
  return origen.map((k) => ({ ...k, tags: [...k.tags] }));
}

/**
 * Plataforma y estado acotan y nada mas: **no tienen candado**.
 *
 * El candado lo lleva solo el filtro de etiquetas, y no por gusto sino por los
 * datos. Una clave lleva todas las etiquetas que lleva, asi que «cumplidos **y**
 * regalados» es una consulta que existe. Una clave tiene **una sola**
 * plataforma y **un solo** estado, de modo que «Steam **y** Epic» no devuelve
 * nada ni con la coleccion entera: un filtro que solo puede devolver la lista
 * vacia esta roto, y mas si el icono dice «cerrado».
 *
 * Lo que antes ocupaba ese hueco —cerrado descartaba las marcadas, «todo menos
 * las de Steam»— era otra consulta, distinta y no mistaken, pero el icono del
 * candado, que tiene dos estados, decia lo mismo para las dos. Lo unico que se
 * ensenaba era un modo que no existe y que solo aparecia al marcar algo.
 *
 * Ahora el que tiene candado es el de etiquetas, y los otros dos no lo pintan.
 */
describe('plataforma y estado acotan, sin candado', () => {
  const catalogo = [
    clave(1, { platform: KeyPlatform.Steam, status: KeyStatus.Available }),
    clave(2, { platform: KeyPlatform.BattleNet, status: KeyStatus.Available, tags: ['cumplidos'] }),
    clave(3, { platform: KeyPlatform.Steam, status: KeyStatus.Gifted }),
    clave(4, { platform: KeyPlatform.BattleNet, status: KeyStatus.Gifted, tags: ['cumplidos'] }),
  ];

  const todo = (): IKeyFilter => ({ ...emptyFilter(), scope: KeyScope.All });

  test('abierto acota a las plataformas marcadas', () => {
    const r = filterKeys(catalogo, {
      ...todo(),
      platforms: [KeyPlatform.Steam],
    });

    expect(r.map((k) => k.id)).toEqual([1, 3]);
  });

  /**
   * Plataforma y estado tienen **un solo modo**, y es a proposito.
   *
   * Antes tenian dos, como las etiquetas: abierto acotaba a las marcadas y
   * cerrado las descartaba. El cerrado no era un AND —no se podia, una clave
   * tiene una sola plataforma— sino la negacion. Y el icono del candado, que
   * solo tiene dos estados, decia «cerrado» para las dos cosas: no hay forma de
   * que un icono diga «todo menos estas».
   *
   * El filtro era util («todo menos las de Steam»), pero lo que se ensefia no
   * era ese filtro: era un modo que no existe y que solo aparece cuando se
   * marca algo. Con ninguna marcada no se ve, y es justo cuando se empieza a
   * marcar.
   *
   * Ahora el candado solo lo lleva las etiquetas, que si pueden pedir las dos
   * cosas porque una clave lleva todas las que lleva.
   */
  test('dos plataformas marcadas: sale lo que lleva alguna de las dos', () => {
    const r = filterKeys(catalogo, {
      ...todo(),
      platforms: [KeyPlatform.Steam, KeyPlatform.BattleNet],
    });

    expect(r).toHaveLength(4);
  });

  test('varias plataformas marcadas no se pueden negar', () => {
    // `IKeyFilter` no tiene `excluirPlataformas`, asi que la forma de «todo
    // menos las de Steam» no se puede ni escribir. Esto lo fija el
    // compilador, y el test es la red por si alguien lo relaja.
    expect('excluirPlataformas' in todo()).toBe(false);
    expect('excluirEstados' in todo()).toBe(false);
  });

  test('el estado acota y no se descarta, y es independiente de la plataforma', () => {
    const soloRegaladas = filterKeys(catalogo, {
      ...todo(),
      statuses: [KeyStatus.Available],
    });

    expect(soloRegaladas.map((k) => k.id)).toEqual([1, 2]);

    // Los dos a la vez: solo Steam **y** solo Available.
    const ambos = filterKeys(catalogo, {
      ...todo(),
      platforms: [KeyPlatform.Steam],
      statuses: [KeyStatus.Available],
    });

    expect(ambos.map((k) => k.id)).toEqual([1]);
  });

  test('con una sola marcada, sale lo que la lleva y solo lo que la lleva', () => {
    const r = filterKeys(catalogo, {
      ...todo(),
      platforms: [KeyPlatform.BattleNet],
    });

    expect(r.map((k) => k.id)).toEqual([2, 4]);
  });

  test('sin nada marcado, el filtro no acota', () => {
    expect(filterKeys(catalogo, { ...todo() })).toHaveLength(4);
  });

  test('el candado de etiquetas es independiente de plataforma y estado', () => {
    const r = filterKeys(catalogo, {
      ...todo(),
      platforms: [KeyPlatform.BattleNet],
      tags: ['cumplidos'],
      excluir: true,
    });

    // BattleNet **y** con la etiqueta: sale la 2 y la 4, que son las unicas
    // de BattleNet y las unicas con la etiqueta. Las dos reglas a la vez, y
    // aqui si se puede pedir porque una clave lleva varias etiquetas.
    expect(r.map((k) => k.id)).toEqual([2, 4]);

    // Y sin el AND sale mas: el «o» tambien acota por plataforma. Lo que hace
    // el candado no es mezclarse con el otro filtro, es estrechar **dentro** de
    // lo que ese filtro ya habia dejado.
    const abierto = filterKeys(catalogo, {
      ...todo(),
      platforms: [KeyPlatform.BattleNet],
      tags: ['cumplidos'],
    });

    expect(abierto).toHaveLength(2);
  });
});
