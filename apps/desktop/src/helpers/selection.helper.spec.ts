import { describe, expect, test } from 'bun:test';
import { APP_LOCALE_VALUES } from '@/contracts';
import { translate } from '@/helpers/i18n.helper';

import {
  analyzeSelection,
  resumenPorTitulo,
  isExpirable,
  isGiftable,
  podarSeleccion,
} from './selection.helper';
import { KeyPlatform, KeySource, KeyStatus, type IGameKey } from '@/contracts';

/** Clave de mentira con el estado que se le pase. */
function clave(id: number, status: KeyStatus, title = `Juego ${id}`): IGameKey {
  return {
    id,
    title,
    keyValue: `FAKE-${id}-AAAAA-BBBBB`,
    platform: KeyPlatform.Steam,
    status,
    source: KeySource.Manual,
    giftedTo: status === KeyStatus.Gifted ? 'Alguien' : null,
    parentTitle: null,
    note: null,
    tags: [],
    addedOn: null,
    lastUsedAt: null,
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
  };
}

describe('que se puede hacer con una seleccion', () => {
  test('una clave disponible se puede regalar', () => {
    const facts = analyzeSelection([clave(1, KeyStatus.Available)], true);

    expect(facts.canExport).toBe(true);
    expect(facts.canGift).toBe(true);
    expect(facts.canExpire).toBe(true);
    expect(facts.blocked).toHaveLength(0);
  });

  test('una clave ya regalada no se puede volver a regalar', () => {
    const facts = analyzeSelection([clave(1, KeyStatus.Gifted)], true);

    expect(facts.canExport).toBe(false);
    expect(facts.canGift).toBe(false);
  });

  test('una clave canjeada no se puede regalar', () => {
    const facts = analyzeSelection([clave(1, KeyStatus.Redeemed)], true);

    expect(facts.canGift).toBe(false);
  });

  test('con el interruptor apagado no se puede regalar ni con claves limpias', () => {
    const facts = analyzeSelection([clave(1, KeyStatus.Available)], false);

    expect(facts.canExport).toBe(false);
    expect(facts.canGift).toBe(false);
  });

  test('una seleccion mezclada bloquea el regalar aunque el filtro sea de disponibles', () => {
    const seleccion = [
      clave(1, KeyStatus.Available),
      clave(2, KeyStatus.Gifted),
    ];

    const facts = analyzeSelection(seleccion, true);

    expect(facts.giftable).toBe(1);
    expect(facts.canExport).toBe(false);

    // El mensaje no nombra el estado de las claves que lo impiden: la barra de
    // seleccion ya lo dice en su cabecera ("3 se pueden regalar · 2 ya no"), y
    // cada fila muestra su propio estado. Aqui va lo que **falta por hacer**,
    // que es lo unico que no se deduce de la cabecera.
    //
    // Dice "cambia el filtro", no "pulsa el interruptor": el interruptor que
    // habia en la barra de seleccion se quito por duplicar el filtro de la
    // barra de filtros, y este mensaje quedaria obsoleto si se hubiera dejado.
    const motivo = facts.blocked.find((b) => b.action === 'export');
    expect(motivo?.messageKey).toBe('selection.blockedOne');

    // Las claves concretas que lo impiden si vienen, en `ids`, para poder
    // nombrarlas en el aviso al completar la accion.
    expect(motivo?.ids).toEqual([2]);
  });

  test('el bloqueo explica el motivo en el tooltip', () => {
    const facts = analyzeSelection([clave(1, KeyStatus.Expired)], true);
    const motivo = facts.blocked.find((b) => b.action === 'export');

    expect(motivo).toBeDefined();
    expect(motivo?.messageKey).toBe('selection.blockedOne');
  });

  // El mensaje salia escrito a mano en castellano, y el lint que busca eso solo
  // recorria los `.tsx`: un helper es un `.ts` y quedaba fuera por construccion.
  // Aqui se comprueba la cadena entera: que exista en los cinco idiomas y que al
  // traducirla salga el numero que corresponde.
  test('el motivo del bloqueo sale traducido y con su numero', () => {
    const facts = analyzeSelection(
      [
        clave(1, KeyStatus.Gifted),
        clave(2, KeyStatus.Gifted),
        clave(3, KeyStatus.Available),
      ],
      false,
    );

    const motivo = facts.blocked.find((b) => b.action === 'export');

    expect(motivo?.messageKey).toBe('selection.blockedMany');

    for (const locale of APP_LOCALE_VALUES) {
      const texto = translate(locale, motivo!.messageKey, motivo!.messageArgs);

      // Nunca devuelve la clave en crudo: eso seria un texto sin traducir
      // pintado en el tooltip.
      expect(texto).not.toBe(motivo!.messageKey);
      expect(texto).toContain('2');
    }
  });

  test('caducar si vale para lo que no esta caducado', () => {
    const facts = analyzeSelection(
      [clave(1, KeyStatus.Gifted), clave(2, KeyStatus.Expired)],
      true,
    );

    expect(facts.canExpire).toBe(true);
    expect(facts.expirable).toBe(1);
  });

  test('si todo esta caducado no se puede volver a caducar', () => {
    const facts = analyzeSelection(
      [clave(1, KeyStatus.Expired), clave(2, KeyStatus.Expired)],
      true,
    );

    expect(facts.canExpire).toBe(false);

    const motivo = facts.blocked.find((b) => b.action === 'expire');
    expect(motivo?.messageKey).toBe('selection.blockedExpired');
  });

  test('una seleccion vacia no habilita nada', () => {
    const facts = analyzeSelection([], true);

    expect(facts.total).toBe(0);
    expect(facts.canExport).toBe(false);
    expect(facts.canGift).toBe(false);
    expect(facts.canExpire).toBe(false);
    expect(facts.canTag).toBe(false);
  });

  test('las etiquetas siempre se pueden cambiar', () => {
    const facts = analyzeSelection([clave(1, KeyStatus.Expired)], true);

    expect(facts.canTag).toBe(true);
  });

  test('el motivo dice cuantas claves hay que dejar fuera', () => {
    const facts = analyzeSelection(
      [clave(1, KeyStatus.Gifted), clave(2, KeyStatus.Gifted)],
      true,
    );

    const motivo = facts.blocked.find((b) => b.action === 'gift');
    expect(motivo?.messageKey).toBe('selection.blockedMany');
    expect(motivo?.messageArgs).toEqual([2]);
    expect(motivo?.ids).toEqual([1, 2]);
  });

  test('el motivo tambien sale con una sola clave que estorba', () => {
    const facts = analyzeSelection([clave(1, KeyStatus.Redeemed)], true);

    const motivo = facts.blocked.find((b) => b.action === 'export');
    expect(motivo?.messageKey).toBe('selection.blockedOne');
    expect(motivo?.messageArgs ?? []).toEqual([]);
    expect(motivo?.ids).toEqual([1]);
  });

  test('si no hay ninguna que estorbe el motivo no inventa un numero', () => {
    // Todo disponible pero con el filtro en «Todos»: no hay claves que dejar
    // fuera, asi que el motivo no debe llevar un "esas 0".
    const facts = analyzeSelection([clave(1, KeyStatus.Available)], false);

    const motivo = facts.blocked.find((b) => b.action === 'export');

    expect(motivo?.messageKey).toBe('selection.blockedNone');
    expect(motivo?.messageArgs ?? []).toEqual([]);
  });
});

describe('varias claves del mismo juego', () => {
  test('son claves distintas y cada una conserva su estado', () => {
    const facts = analyzeSelection(
      [
        clave(1, KeyStatus.Available, 'SanctuaryRPG: Black Edition'),
        clave(2, KeyStatus.Gifted, 'SanctuaryRPG: Black Edition'),
        clave(3, KeyStatus.Redeemed, 'SanctuaryRPG: Black Edition'),
      ],
      true,
    );

    expect(facts.total).toBe(3);
    expect(facts.giftable).toBe(1);
  });

  test('solo la disponible se puede regalar del grupo', () => {
    const seleccion = [
      clave(1, KeyStatus.Available, 'Witcher 3'),
      clave(2, KeyStatus.Gifted, 'Witcher 3'),
    ];

    const facts = analyzeSelection(seleccion, true);

    // El interruptor esta activo pero hay una no disponible, asi que el
    // regalar queda bloqueado: es preferible a regalar en silencio solo una.
    expect(facts.canGift).toBe(false);
    expect(facts.giftable).toBe(1);
  });

  test('agrupa por titulo ignorando mayusculas y acentos', () => {
    const mapa = resumenPorTitulo([
      clave(1, KeyStatus.Available, 'Knights of Pen and Paper + 1 Edition'),
      clave(2, KeyStatus.Gifted, 'Knights of Pen & Paper +1 Edition'),
      clave(3, KeyStatus.Available, 'Otro juego'),
    ]);

    expect(mapa.size).toBe(2);

    const grupo = [...mapa.values()].find((g) => g.total === 2);
    expect(grupo).toBeDefined();
    expect(grupo?.available).toBe(1);
  });
});

describe('permisos por clave', () => {
  test('solo lo disponible es regalable', () => {
    expect(isGiftable(clave(1, KeyStatus.Available))).toBe(true);
    expect(isGiftable(clave(1, KeyStatus.Gifted))).toBe(false);
    expect(isGiftable(clave(1, KeyStatus.Redeemed))).toBe(false);
    expect(isGiftable(clave(1, KeyStatus.Expired))).toBe(false);
    expect(isGiftable(clave(1, KeyStatus.Unknown))).toBe(false);
  });

  test('casi todo se puede marcar como caducado menos lo ya caducado', () => {
    expect(isExpirable(clave(1, KeyStatus.Expired))).toBe(false);
    expect(isExpirable(clave(1, KeyStatus.Available))).toBe(true);
    expect(isExpirable(clave(1, KeyStatus.Redeemed))).toBe(true);
  });
});
describe('podar la seleccion al cambiar el filtro', () => {
  test('lo que ya no se ve se deselecciona', () => {
    // El caso del que habla el usuario: veinte seleccionadas, se cambia el
    // filtro y solo cuatro siguen en pantalla. Sin esto, «Exportar» se lleva
    // veinte claves de las que solo se ven cuatro, y no hay forma de saber
    // cuales son porque las otras no tienen fila donde mirar su casilla.
    const seleccion = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
    const visibles = [clave(1, KeyStatus.Available), clave(2, KeyStatus.Available)];

    expect([...podarSeleccion(seleccion, visibles)]).toEqual([1, 2]);
  });

  test('lo que sigue en pantalla se conserva', () => {
    const seleccion = new Set([1, 3]);
    const visibles = [
      clave(1, KeyStatus.Available),
      clave(2, KeyStatus.Available),
      clave(3, KeyStatus.Available),
    ];

    expect([...podarSeleccion(seleccion, visibles)]).toEqual([1, 3]);
  });

  test('si no hay que quitar nada devuelve el mismo conjunto', () => {
    // React compara por referencia: devolver un Set nuevo con el mismo
    // contenido haria que el efecto se volviera a disparar, y el ciclo no
    // terminaria nunca.
    const seleccion = new Set([1, 2]);
    const visibles = [clave(1, KeyStatus.Available), clave(2, KeyStatus.Available)];

    expect(podarSeleccion(seleccion, visibles)).toBe(seleccion);
  });

  test('una lista vacia vacia la seleccion', () => {
    expect([...podarSeleccion(new Set([1, 2, 3]), [])]).toEqual([]);
  });

  test('una seleccion vacia se queda vacia y sin cambio', () => {
    const seleccion = new Set<number>();

    expect(podarSeleccion(seleccion, [clave(1, KeyStatus.Available)]).size).toBe(0);
  });

  test('solo se quita lo que no esta en pantalla, sin tocar el original', () => {
    const seleccion = new Set([1, 9]);
    const visibles = [clave(1, KeyStatus.Available)];

    const resultado = podarSeleccion(seleccion, visibles);

    expect(resultado).not.toBe(seleccion);
    // El conjunto original no se toca: es el estado de React.
    expect([...seleccion]).toEqual([1, 9]);
  });
});
