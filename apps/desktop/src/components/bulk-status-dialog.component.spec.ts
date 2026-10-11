import { describe, expect, test } from 'bun:test';

import { previewBulkStatus } from './bulk-status-dialog.component';
import { AppLocale, KeyStatus, type IGameKey, type Translator } from '@/contracts';
import { translate } from '@/helpers/i18n.helper';

/**
 * Traductor en castellano, que es el idioma de origen.
 *
 * Se pasa a mano porque `previewBulkStatus` es una funcion pura: no monta nada y
 * por eso se puede probar sin React. El reparto no depende del idioma, asi que
 * probarlo en el de origen cubre las mismas ramas que probarlo en los otros
 * cuatro.
 */
const en: Translator = (clave, args) => translate(AppLocale.Es, clave, args);

/**
 * El reparto que enseña el dialogo de cambiar el estado en bloque.
 *
 * Lo que se comprueba aqui es la parte en la que se puede perder trabajo de
 * verdad: si el calculo dice que veinte claves cambian y solo cambian tres, se
 * han marcado como regaladas claves que no se queria. Y al reves, si dice
 * que no cambia ninguna, el boton queda apagado y no hay forma de llegar.
 */

function clave(id: number, status: KeyStatus, extra: Partial<IGameKey> = {}): IGameKey {
  return {
    id,
    title: `Juego ${id}`,
    keyValue: 'AAAAA-BBBBB-CCCCC',
    status,
    addedOn: '2026-01-01',
    ...extra,
  } as IGameKey;
}

describe('cambiar el estado de varias claves a la vez', () => {
  test('todas disponibles pasan a regaladas si tienen destinatario', () => {
    const seleccion = [
      clave(1, KeyStatus.Available, { giftedTo: 'Ana' }),
      clave(2, KeyStatus.Available, { giftedTo: 'Luis' }),
    ];

    const p = previewBulkStatus(seleccion, KeyStatus.Gifted, en);

    expect(p.cambian.map((k) => k.id)).toEqual([1, 2]);
    expect(p.bloqueadas).toEqual([]);
  });

  test('sin destinatario la clave no se regala, y el motivo lo dice', () => {
    const seleccion = [
      clave(1, KeyStatus.Available, { giftedTo: 'Ana' }),
      clave(2, KeyStatus.Available),
    ];

    const p = previewBulkStatus(seleccion, KeyStatus.Gifted, en);

    expect(p.cambian.map((k) => k.id)).toEqual([1]);
    expect(p.bloqueadas).toHaveLength(1);
    expect(p.bloqueadas[0]?.key.id).toBe(2);
    expect(p.bloqueadas[0]?.motivo).toContain('a quien');
  });

  test('a caducada se puede ir cualquiera que no lo este ya', () => {
    const seleccion = [
      clave(1, KeyStatus.Available),
      clave(2, KeyStatus.Gifted),
      clave(3, KeyStatus.Redeemed),
      clave(4, KeyStatus.Expired),
    ];

    const p = previewBulkStatus(seleccion, KeyStatus.Expired, en);

    expect(p.cambian.map((k) => k.id)).toEqual([1, 2, 3]);
    // La que ya estaba caducada no se toca: no hay nada que cambiar, y cuenta
    // como tal y no como error.
    expect(p.iguales.map((k) => k.id)).toEqual([4]);
    expect(p.bloqueadas).toEqual([]);
  });

  test('a disponible solo vuelve una clave caducada, no una ya regalada', () => {
    // Este es el caso peligroso: marcar como disponible algo que ya se regalo
    // seria mentir, porque esa clave ya no se tiene.
    const seleccion = [
      clave(1, KeyStatus.Expired),
      clave(2, KeyStatus.Gifted, { giftedTo: 'Ana' }),
      clave(3, KeyStatus.Redeemed),
    ];

    const p = previewBulkStatus(seleccion, KeyStatus.Available, en);

    expect(p.cambian.map((k) => k.id)).toEqual([1]);
    expect(p.bloqueadas.map((b) => b.key.id)).toEqual([2, 3]);
  });

  test('marcar disponible una seleccion ya disponible no cambia nada', () => {
    const seleccion = [clave(1, KeyStatus.Available), clave(2, KeyStatus.Available)];

    const p = previewBulkStatus(seleccion, KeyStatus.Available, en);

    expect(p.cambian).toHaveLength(0);
    expect(p.iguales).toHaveLength(2);
    expect(p.bloqueadas).toHaveLength(0);
  });

  test('el reparto siempre cuadra con el total', () => {
    // Si las tres partes no suman el total, se ha perdido alguna clave por el
    // camino, y eso no se veria en la interfaz.
    const seleccion = [
      clave(1, KeyStatus.Available, { giftedTo: 'Ana' }),
      clave(2, KeyStatus.Available),
      clave(3, KeyStatus.Expired),
      clave(4, KeyStatus.Gifted, { giftedTo: 'Luis' }),
    ];

    for (const estado of Object.values(KeyStatus)) {
      const p = previewBulkStatus(seleccion, estado, en);

      expect(p.cambian.length + p.iguales.length + p.bloqueadas.length).toBe(
        seleccion.length,
      );
    }
  });

  test('una seleccion vacia no propone nada', () => {
    const p = previewBulkStatus([], KeyStatus.Expired, en);

    expect(p.cambian).toEqual([]);
    expect(p.iguales).toEqual([]);
    expect(p.bloqueadas).toEqual([]);
  });
});