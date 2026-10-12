import { describe, expect, test } from 'bun:test';

import { conTiempoLimite } from './use-loading.helper';
import { borradorDe, instantaneaDe } from './undo.helper';
import { KeyPlatform, KeySource, KeyStatus, type IGameKey } from '@/contracts';

/** Una clave con todo relleno, para no tener que inventar campos en cada test. */
function clave(over: Partial<IGameKey> = {}): IGameKey {
  return {
    id: 1,
    title: 'Celeste',
    keyValue: 'ABCDE-11111-22222-33333',
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

describe('tope de espera', () => {
  test('devuelve el valor si la promesa responde a tiempo', async () => {
    expect(await conTiempoLimite(Promise.resolve(7), 50)).toEqual({ ok: true, valor: 7 });
  });

  test('avisa cuando se pasa de tiempo', async () => {
    const lento = new Promise<number>((resolve) => setTimeout(() => resolve(1), 200));

    expect(await conTiempoLimite(lento, 10)).toEqual({ ok: false });
  });

  test('un resultado undefined no se confunde con el tope', async () => {
    // El caso que motivo el cambio de contrato: un `onSave` que no devuelve nada
    // es igual de valido que uno que se cuelga, y confundirlos hacia que un
    // guardado correcto se anunciara como fallo.
    const vacio = await conTiempoLimite(Promise.resolve(undefined), 50);

    expect(vacio.ok).toBe(true);
    expect(vacio).toEqual({ ok: true, valor: undefined });
  });

  test('un rechazo late no se cuela como excepcion sin dueno', async () => {
    // La promesa original sigue viva cuando salta el reloj; su error tiene que
    // acabar descartado, o aparece en pantalla mucho despues de que ya no importa.
    const tarde = new Promise<number>((_, reject) =>
      setTimeout(() => reject(new Error('tarde')), 30),
    );

    await conTiempoLimite(tarde, 5);

    await new Promise((r) => setTimeout(r, 60));

    // Si el rechazo se hubiera colado, Bun lo habria reportado aqui.
    expect(true).toBe(true);
  });

  test('el error real sigue llegando si la promesa falla antes del reloj', async () => {
    await expect(conTiempoLimite(Promise.reject(new Error('revento')), 50)).rejects.toThrow(
      'revento',
    );
  });
});

describe('deshacer', () => {
  test('la foto guarda lo editable y nada mas', () => {
    const [foto] = instantaneaDe([
      clave({ id: 7, title: 'Hollow Knight', note: 'humble', tags: ['humble'] }),
    ]);

    expect(foto).toEqual({
      title: 'Hollow Knight',
      keyValue: 'ABCDE-11111-22222-33333',
      platform: KeyPlatform.Steam,
      status: KeyStatus.Available,
      giftedTo: null,
      parentTitle: null,
      note: 'humble',
      tags: ['humble'],
      addedOn: '2020-01-01',
    });
  });

  test('la foto copia las etiquetas, no las comparte', () => {
    // Si compartiera el array, deshacer una clave modificaria las etiquetas de
    // las demas que tuvieran el mismo array.
    const original = clave({ tags: ['humble', 'dlc'] });
    const foto = instantaneaDe([original])[0]!;

    (foto.tags as string[]).push('nueva');

    expect(original.tags).toEqual(['humble', 'dlc']);
  });

  test('la foto y el borrador dicen lo mismo', () => {
    const entrada = clave({
      title: 'Portal 2',
      status: KeyStatus.Gifted,
      giftedTo: 'Marta',
      tags: ['regalo'],
    });

    const borrador = borradorDe(instantaneaDe([entrada])[0]!);

    expect(borrador).toEqual({
      title: 'Portal 2',
      keyValue: entrada.keyValue,
      platform: KeyPlatform.Steam,
      status: KeyStatus.Gifted,
      giftedTo: 'Marta',
      parentTitle: null,
      note: null,
      tags: ['regalo'],
      addedOn: '2020-01-01',
    });
  });

  test('deshacer un regalo devuelve al estado y al destinatario de antes', () => {
    // El destinatario es la parte que mas se olvida: se escribe al regalar y
    // deshacer solo el estado dejaria una clave regalada sin saber a quien.
    const despues = clave({ status: KeyStatus.Gifted, giftedTo: 'Marta' });
    const antes = instantaneaDe([clave()])[0]!;

    expect(borradorDe(antes).status).toBe(KeyStatus.Available);
    expect(borradorDe(antes).giftedTo).toBeNull();
    expect(despues.giftedTo).toBe('Marta');
  });
});