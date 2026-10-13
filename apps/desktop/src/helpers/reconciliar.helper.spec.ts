import { describe, expect, test } from 'bun:test';
import {
  KeyPlatform,
  KeyStatus,
  ParsedKeyKind,
  type IParsedEntry,
} from '@/contracts';

import {
  juntarEtiquetas,
  reconciliar,
  resumenDeCambios,
  type IChange,
  type IFilaReconciliable,
} from './reconciliar.helper';

/**
 * Clave de mentira con la forma de las de verdad.
 *
 * El formato importa: `reconciliar` empareja por `keyFingerprint`, no por el
 * texto, y un test con «A» y «B» pasaria aunque el emparejamiento estubiera
 * mal porque no habria forma de que las dos escrituras distintas dieran el
 * mismo nombre. Con claves con guiones, compararlas de otra manera —
normalizadas, sin guiones, con los espacios de mas— tiene que seguir
 * encontrandolas.
 */
const CLAVE_A = 'MQ7RT-29XKL-ZPN84';
const CLAVE_B = 'A7T-9KX-R4Z';

/** Entrada del TXT de mentira. */
function entrada(cambios: Partial<IParsedEntry> = {}): IParsedEntry {
  return {
    title: 'Juego',
    keyValue: CLAVE_A,
    platform: KeyPlatform.Steam,
    status: KeyStatus.Available,
    keyKind: ParsedKeyKind.Steam,
    gifted: false,
    giftedTo: null,
    parentTitle: null,
    note: null,
    tags: [],
    addedOn: null,
    sourceLine: 1,
    ...cambios,
  };
}

/** Fila de la base de datos de mentira. */
function fila(cambios: Partial<IFilaReconciliable> = {}): IFilaReconciliable {
  return {
    id: 1,
    title: 'Juego',
    key_value: CLAVE_A,
    status: KeyStatus.Available,
    tags: '',
    ...cambios,
  };
}

describe('reconciliar la base con el TXT', () => {
  test('una clave que ya coincide no genera cambio', () => {
    const { cambios } = reconciliar([fila()], [entrada()]);

    expect(cambios).toEqual([]);
  });

  test('un estado distinto genera un cambio con el antes y el despues', () => {
    const { cambios } = reconciliar(
      [fila({ status: KeyStatus.Available })],
      [entrada({ status: KeyStatus.Gifted })],
    );

    expect(cambios).toEqual([
      expect.objectContaining({
        id: 1,
        before: KeyStatus.Available,
        after: KeyStatus.Gifted,
      }),
    ]);
  });

  test('las etiquetas del TXT que faltan generan cambio aunque el estado no cambie', () => {
    /*
     * Este es el caso que hace que el script exista y por el que no basta con
     * comparar estados: el parser se corrige, la clave ya estaba importada con
     * el criterio viejo, y el unico rastro del cambio son las etiquetas.
     */
    const { cambios } = reconciliar(
      [fila({ tags: 'regalo' })],
      [entrada({ tags: ['regalo', 'navidad'] })],
    );

    expect(cambios).toHaveLength(1);
    // `toHaveLength` de arriba ya dijo que hay uno; `cambios[0]` sigue siendo
    // `IChange | undefined` para el typechecker porque no sabe comprobar
    // longitudes, y este es el punto de donde sale el valor.
    const [cambio] = cambios as readonly [IChange, ...IChange[]];

    expect(cambio.before).toBe(cambio.after);
    expect(cambio.tags).toEqual(['navidad']);
  });

  test('una etiqueta que ya esta puesta con otra caja no se vuelve a anadir', () => {
    const { cambios } = reconciliar(
      [fila({ tags: 'Navidad' })],
      [entrada({ tags: ['navidad'] })],
    );

    expect(cambios).toEqual([]);
  });

  test('una clave que no esta en el TXT no se toca y se cuenta aparte', () => {
    const { cambios, sinPareja } = reconciliar(
      [fila({ id: 7, key_value: 'T7XbN2pLqW9mK4cR' })],
      [entrada()],
    );

    expect(cambios).toEqual([]);
    expect(sinPareja).toHaveLength(1);
    expect(sinPareja.map((f) => f.id)).toEqual([7]);
  });

  test('el emparejamiento ignora como esten escritas las claves', () => {
    /*
     * El TXT es de 2015 y esta escrito a mano; el formato de la clave no tiene
     * por que coincidir con el que genera la app. Si el emparejamiento fuera
     * literal, cambiar el parser para entender mejor el TXT haria que
     * `reconciliar` dejara de encontrar **todas** las claves y no tocara
     * ninguna — que es justo lo contrario de lo que se le pide.
     */
    const { cambios, sinPareja } = reconciliar(
      [fila({ status: KeyStatus.Available })],
      [entrada({ keyValue: 'mq7rt29xklzpn84', status: KeyStatus.Gifted })],
    );

    expect(sinPareja).toEqual([]);
    expect(cambios.map((c) => c.after)).toEqual([KeyStatus.Gifted]);
  });

  test('las claves se emparejan una a una, no se pisan entre si', () => {
    const { cambios, sinPareja } = reconciliar(
      [
        fila({ id: 1, key_value: CLAVE_A, status: KeyStatus.Available }),
        fila({ id: 2, key_value: CLAVE_B, status: KeyStatus.Available }),
      ],
      [
        entrada({ keyValue: CLAVE_A, status: KeyStatus.Gifted }),
        entrada({ keyValue: CLAVE_B, status: KeyStatus.Redeemed }),
      ],
    );

    expect(sinPareja).toEqual([]);
    expect(cambios.map((c) => [c.id, c.after])).toEqual([
      [1, KeyStatus.Gifted],
      [2, KeyStatus.Redeemed],
    ]);
  });

  test('no toca la nota ni el destinatario ni el titulo', () => {
    /*
     * `IFilaReconciliable` ni siquiera los trae. No es que se decida no
     * tocarlos: es que no hay por donde tocarlos. El TXT de 2015 no es la
     * fuente de verdad de una nota escrita hoy, y si lo fuera se perderia.
     */
    const { cambios } = reconciliar(
      [fila({ title: 'Lo que escribi yo' })],
      [entrada({ title: 'Como lo llama el TXT', status: KeyStatus.Gifted })],
    );

    expect(cambios.map((c) => c.title)).toEqual(['Lo que escribi yo']);
  });

  test('con la base y el TXT vacios no hay nada que hacer', () => {
    expect(reconciliar([], [])).toEqual({ cambios: [], sinPareja: [] });
  });
});

describe('juntar etiquetas sin tirar las que ya havia', () => {
  test('las nuevas se anaden a las que ya habia', () => {
    expect(juntarEtiquetas(['regalo'], ['navidad'])).toEqual(['regalo', 'navidad']);
  });

  test('una que ya estaba no se repite aunque venga distinta', () => {
    expect(juntarEtiquetas(['Navidad'], ['navidad'])).toEqual(['Navidad']);
  });

  test('sin actuales sale solo las nuevas, en su orden', () => {
    expect(juntarEtiquetas([], ['a', 'b'])).toEqual(['a', 'b']);
  });

  test('sin nuevas se devuelve las actuales sin tocarlas', () => {
    expect(juntarEtiquetas(['a', 'b'], [])).toEqual(['a', 'b']);
  });

  test('las de dentro tampoco se repiten entre si', () => {
    expect(juntarEtiquetas(['Navidad'], ['navidad', 'NAVIDAD'])).toEqual(['Navidad']);
  });
});

describe('el resumen que imprime el script', () => {
  test('agrupa por el par de estados y cuenta', () => {
    const texto = resumenDeCambios([
      { before: KeyStatus.Available, after: KeyStatus.Gifted },
      { before: KeyStatus.Available, after: KeyStatus.Gifted },
      { before: KeyStatus.Available, after: KeyStatus.Redeemed },
    ]);

    expect(texto).toContain('available -> gifted');
    expect(texto).toContain('available -> redeemed');
    expect(texto.trim().split('\n')).toHaveLength(2);
  });

  test('lo que mas se repite sale primero', () => {
    /*
     * El resumen se lee para encontrar el patron que mas se repite, que es el
     * que mas probable sea un fallo del parser y no de los datos. Poner el
     * patron grande al final obligaria a leerlo entero para verlo.
     */
    const texto = resumenDeCambios([
      { before: KeyStatus.Available, after: KeyStatus.Redeemed },
      { before: KeyStatus.Available, after: KeyStatus.Gifted },
      { before: KeyStatus.Available, after: KeyStatus.Gifted },
    ]);
    const primera = texto.trim().split('\n')[0];

    expect(primera).toContain('gifted');
  });

  test('sin cambios no imprime nada', () => {
    expect(resumenDeCambios([])).toBe('');
  });
});