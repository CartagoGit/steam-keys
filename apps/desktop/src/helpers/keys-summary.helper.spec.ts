import { describe, expect, test } from 'bun:test';
import { KeyKind, KeyPlatform, KeyScope, KeySource, KeyStatus, type IGameKey, type IKeyFilter } from '@/contracts';

import { emptyFilter } from './filter-keys.helper';
import { clearFilter, matchesFilter, summarizeKeys } from './keys-summary.helper';

/** Clave de mentira con lo que se le pase, y el resto como la app los deja. */
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

describe('lo que dice la lista que se esta mirando', () => {
  test('sin claves todos los numeros son cero', () => {
    const resumen = summarizeKeys([]);

    expect(resumen.total).toBe(0);
    expect(resumen.titulos).toBe(0);
    expect(resumen.duplicadas).toBe(0);
    expect(resumen.destinatarios).toBe(0);
    expect(resumen.steam).toBe(0);
    expect(resumen.otras).toBe(0);
    expect(Object.keys(resumen.porPlataforma)).toEqual([]);
  });

  test('cuenta cada estado por separado', () => {
    const resumen = summarizeKeys([
      clave(1),
      clave(2),
      clave(3, { status: KeyStatus.Gifted, giftedTo: 'Ana' }),
      clave(4, { status: KeyStatus.Redeemed }),
      clave(5, { status: KeyStatus.Expired }),
    ]);

    expect(resumen.total).toBe(5);
    expect(resumen.available).toBe(2);
    expect(resumen.gifted).toBe(1);
    expect(resumen.redeemed).toBe(1);
    expect(resumen.expired).toBe(1);
    expect(resumen.unknown).toBe(0);
  });

  test('una clave con un estado que no se reconoce cuenta como desconocida', () => {
    /*
     * El `default` del switch existe por esto. Un estado nuevo en el enum que
     * se anada sin tocar el recuento no puede hacer que el total deje de
     * cuadrar con la suma de las partes: o cuenta como desconocido, o las
     * cuentas de abajo no suman lo mismo que el total de arriba.
     */
    const resumen = summarizeKeys([clave(1, { status: 'inventado' as KeyStatus })]);

    expect(resumen.unknown).toBe(1);
    expect(
      resumen.available +
        resumen.gifted +
        resumen.redeemed +
        resumen.expired +
        resumen.unknown,
    ).toBe(resumen.total);
  });

  test('el total siempre es la suma de los estados y de los tipos', () => {
    const resumen = summarizeKeys([
      clave(1),
      clave(2, { parentTitle: 'Juego 1' }),
      clave(3, { status: KeyStatus.Gifted, giftedTo: 'Ana', parentTitle: 'Juego 1' }),
    ]);

    expect(resumen.games + resumen.addOns).toBe(resumen.total);
    expect(
      resumen.available +
        resumen.gifted +
        resumen.redeemed +
        resumen.expired +
        resumen.unknown,
    ).toBe(resumen.total);
  });

  test('los titulos se cuentan por juego, no por clave', () => {
    const resumen = summarizeKeys([
      clave(1, { title: 'Portal 2' }),
      clave(2, { title: 'Portal 2', parentTitle: null }),
      clave(3, { title: 'Half-Life' }),
    ]);

    expect(resumen.total).toBe(3);
    expect(resumen.titulos).toBe(2);
  });

  test('el mismo titulo escrito distinto sigue siendo el mismo juego', () => {
    /*
     * Sin normalizar, «Portal 2» y «portal 2» salen como dos juegos y el
     * numero de repetidas sale cero. El resto de la app compara titulos
     * normalizados —`normalize`, en `filter-keys.helper.ts`—, asi que hacer
     * aqui lo mismo es lo que evita que el pie diga una cosa y la lista otra.
     */
    const resumen = summarizeKeys([
      clave(1, { title: 'Portal 2' }),
      clave(2, { title: '  portal 2  ' }),
    ]);

    expect(resumen.titulos).toBe(1);
    expect(resumen.duplicadas).toBe(2);
  });

  test('las repetidas se cuentan por clave, no por grupo', () => {
    /*
     * Tres claves del mismo juego son tres repetidas, no una: el pie dice
     * cuantas claves hay que comparten titulo, que es lo que se puede
     * arreglar. Si dijera «1 titulo repetido» habria que multiplicar para saber
     * cuantas sobran.
     */
    const resumen = summarizeKeys([
      clave(1, { title: 'Portal 2' }),
      clave(2, { title: 'Portal 2' }),
      clave(3, { title: 'Portal 2' }),
      clave(4, { title: 'Half-Life' }),
    ]);

    expect(resumen.duplicadas).toBe(3);
    expect(resumen.titulos).toBe(2);
  });

  test('un titulo que sale una vez no cuenta como repetido', () => {
    const resumen = summarizeKeys([
      clave(1, { title: 'A' }),
      clave(2, { title: 'B' }),
      clave(3, { title: 'C' }),
    ]);

    expect(resumen.duplicadas).toBe(0);
  });

  test('los destinatarios son personas, no veces que se regaló', () => {
    const resumen = summarizeKeys([
      clave(1, { status: KeyStatus.Gifted, giftedTo: 'Ana' }),
      clave(2, { status: KeyStatus.Gifted, giftedTo: 'Ana' }),
      clave(3, { status: KeyStatus.Gifted, giftedTo: 'Luis' }),
    ]);

    expect(resumen.gifted).toBe(3);
    expect(resumen.destinatarios).toBe(2);
  });

  test('la misma persona escrita distinto sigue siendo la misma', () => {
    const resumen = summarizeKeys([
      clave(1, { status: KeyStatus.Gifted, giftedTo: 'Ana' }),
      clave(2, { status: KeyStatus.Gifted, giftedTo: '  ana  ' }),
    ]);

    expect(resumen.destinatarios).toBe(1);
  });

  test('una clave regalada sin destinatario no cuenta como persona', () => {
    const resumen = summarizeKeys([
      clave(1, { status: KeyStatus.Gifted, giftedTo: null }),
      clave(2, { status: KeyStatus.Gifted, giftedTo: '' }),
      clave(3, { status: KeyStatus.Gifted, giftedTo: '   ' }),
    ]);

    expect(resumen.gifted).toBe(3);
    expect(resumen.destinatarios).toBe(0);
  });

  test('Steam y las demas plataformas van por separado y no se pierden', () => {
    const resumen = summarizeKeys([
      clave(1),
      clave(2),
      clave(3, { platform: KeyPlatform.GuildWars2 }),
      clave(4, { platform: KeyPlatform.BattleNet }),
    ]);

    expect(resumen.steam).toBe(2);
    expect(resumen.otras).toBe(2);
    expect(resumen.porPlataforma[KeyPlatform.Steam]).toBe(2);
    expect(resumen.porPlataforma[KeyPlatform.GuildWars2]).toBe(1);
    expect(resumen.porPlataforma[KeyPlatform.BattleNet]).toBe(1);
  });

  test('contar la lista no la modifica', () => {
    const lista = [
      clave(1, { title: 'Portal 2' }),
      clave(2, { title: 'Portal 2', status: KeyStatus.Gifted, giftedTo: 'Ana' }),
    ];
    const copia = structuredClone(lista);

    summarizeKeys(lista);

    expect(lista).toEqual(copia);
  });
});

describe('saber si un tramo del pie ya esta puesto', () => {
  test('un filtro vacio coincide con el filtro vacio', () => {
    expect(matchesFilter(emptyFilter(), {})).toBe(true);
  });

  test('un estado puesto coincide solo consigo mismo', () => {
    const filtro: IKeyFilter = { ...emptyFilter(), statuses: [KeyStatus.Gifted] };

    expect(matchesFilter(filtro, { statuses: [KeyStatus.Gifted] })).toBe(true);
    expect(matchesFilter(filtro, { statuses: [KeyStatus.Available] })).toBe(false);
  });

  test('comparar listas cuenta tambien el orden y la longitud', () => {
    const filtro: IKeyFilter = {
      ...emptyFilter(),
      statuses: [KeyStatus.Gifted, KeyStatus.Redeemed],
    };

    expect(matchesFilter(filtro, { statuses: [KeyStatus.Gifted, KeyStatus.Redeemed] })).toBe(true);
    // El mismo par en el otro orden **si** coincide, y tiene que ser asi: el
    // filtro es un conjunto y `filterKeys` no mira el orden, asi que las dos
    // listas filtran exactamente lo mismo. Si aqui no coincidieran, el boton
    // se apagaria solo por el orden en que llegaron los estados, sin que
    // hubiera cambiado nada de lo que se ve.
    expect(matchesFilter(filtro, { statuses: [KeyStatus.Redeemed, KeyStatus.Gifted] })).toBe(true);
    // Un prefijo, en cambio, no vale: `[gifted]` es un filtro distinto de
    // `[gifted, redeemed]`, no uno mas corto. Por eso se compara la longitud
    // ademas de los elementos: sin ella, un filtro de dos estados daria por
    // puesta una lista de uno solo.
    expect(matchesFilter(filtro, { statuses: [KeyStatus.Gifted] })).toBe(false);
  });

  test('varias claves a la vez tienen que estar todas', () => {
    const filtro: IKeyFilter = {
      ...emptyFilter(),
      statuses: [KeyStatus.Gifted],
      kind: KeyKind.Dlc,
    };

    expect(matchesFilter(filtro, { statuses: [KeyStatus.Gifted], kind: KeyKind.Dlc })).toBe(true);
    expect(matchesFilter(filtro, { statuses: [KeyStatus.Gifted], kind: KeyKind.Games })).toBe(false);
  });

  test('un filtro con una lista vacia no se considera puesto', () => {
    /*
     * `patchFilter` va por encima de lo que le pasa encima, asi que
     * `statuses: []` quita el filtro en lugar de ponerlo. Si `matchesFilter` lo
     * diera por puesto, el boton de ese estado se quedaria encendido con la
     * lista sin filtrar, que es el caso en el que mas confunde.
     */
    const filtro: IKeyFilter = { ...emptyFilter(), statuses: [] };

    expect(matchesFilter(filtro, { statuses: [] })).toBe(true);
    expect(matchesFilter(emptyFilter(), { statuses: [KeyStatus.Gifted] })).toBe(false);
  });
});

describe('quitar un filtro que ya esta puesto', () => {
  test('una lista se quita dejandola vacia', () => {
    expect(clearFilter({ statuses: [KeyStatus.Gifted] })).toEqual({ statuses: [] });
    expect(clearFilter({ platforms: [KeyPlatform.GuildWars2] })).toEqual({
      platforms: [],
    });
  });

  test('un filtro que no es lista se quita con su valor por defecto', () => {
    /*
     * Este es el que estaba mal. Devolver el mismo `kind` no lo quita de
     * nada: `patchFilter` va por encima de lo que hay, y `{ kind: 'dlc' }`
     * sobre `{ kind: 'dlc' }` deja el filtro igual. El boton se quedaba
     * encendido y pulsarlo otra vez no hacia nada.
     */
    expect(clearFilter({ kind: KeyKind.Dlc })).toEqual({ kind: KeyKind.All });
  });

  test('el ambito no se toca al apagar', () => {
    /*
     * `scope` no lo pone ningun tramo del pie —no salen en el ambito «solo
     * disponibles» precisamente para no tener que—, pero si llegara, dejarlo
     * como esta es lo correcto: lo puso el usuario desde la barra de filtros y
     * el boton del pie no tiene por que deshacerlo. Devolverlo al valor de
     * partida haria que la lista se moviera sola justo cuando alguien cree que
     * la esta volviendo a donde estaba.
     */
    const apagado = clearFilter({
      statuses: [KeyStatus.Gifted],
      scope: KeyScope.All,
    });

    expect(apagado.scope).toBe(KeyScope.All);
    expect(apagado.statuses).toEqual([]);
  });

  test('la busqueda y el modo and de etiquetas tampoco se tocan', () => {
    /*
     * Los tres campos que el pie nunca manda. Se comprueban igual porque
     * `clearFilter` es generica y el dia que un tramo los use, tiene que
     * saber que dejarlos como estan es lo que se quiere —o lo que no—.
     */
    expect(clearFilter({ search: 'portal', tags: ['navidad'], excluir: true })).toEqual({
      search: 'portal',
      tags: [],
      excluir: true,
    });
  });

  test('un filtro vacio se apaga a un filtro vacio', () => {
    expect(clearFilter({})).toEqual({});
  });

  test('apagar dos veces da lo mismo que apagar una', () => {
    const una = clearFilter({ statuses: [KeyStatus.Gifted], kind: KeyKind.Dlc });

    expect(clearFilter(una)).toEqual(una);
  });
});