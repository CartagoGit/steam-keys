import { describe, expect, test } from 'bun:test';

import {
  analyzeSelection,
  groupByTitle,
  isExpirable,
  isGiftable,
  siblingsOf,
} from './selection.helper';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KeySource } from '@/contracts/enums/key-source.enum';
import type { IGameKey } from '@/contracts/interfaces/game-key.interface';

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

  test('una seleccion mezclada bloquea el regalar aunque el interruptor este activo', () => {
    const seleccion = [
      clave(1, KeyStatus.Available),
      clave(2, KeyStatus.Gifted),
    ];

    const facts = analyzeSelection(seleccion, true);

    expect(facts.giftable).toBe(1);
    expect(facts.canExport).toBe(false);

    const motivo = facts.blocked.find((b) => b.action === 'export');
    // El motivo usa la etiqueta del estado, no el valor crudo del enum: decir
    // "gifted" en un tooltip en castellano no le dice nada a nadie.
    expect(motivo?.message).toContain('regalada');
    expect(motivo?.message).not.toContain('gifted');
  });

  test('el bloqueo explica el motivo en el tooltip', () => {
    const facts = analyzeSelection([clave(1, KeyStatus.Expired)], true);
    const motivo = facts.blocked.find((b) => b.action === 'export');

    expect(motivo).toBeDefined();
    expect(motivo?.message.length).toBeGreaterThan(10);
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
    expect(motivo?.message).toContain('ya estaban caducadas');
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

  test('el motivo lleva las claves en plural', () => {
    const facts = analyzeSelection(
      [clave(1, KeyStatus.Gifted), clave(2, KeyStatus.Gifted)],
      true,
    );

    const motivo = facts.blocked.find((b) => b.action === 'gift');
    expect(motivo?.message).toContain('2 claves regaladas');
  });

  test('el motivo de canjeadas tambien va en plural', () => {
    const facts = analyzeSelection([clave(1, KeyStatus.Redeemed)], true);

    const motivo = facts.blocked.find((b) => b.action === 'export');
    expect(motivo?.message).toContain('canjeadas');
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
    const mapa = groupByTitle([
      clave(1, KeyStatus.Available, 'Knights of Pen and Paper + 1 Edition'),
      clave(2, KeyStatus.Gifted, 'Knights of Pen & Paper +1 Edition'),
      clave(3, KeyStatus.Available, 'Otro juego'),
    ]);

    expect(mapa.size).toBe(2);

    const grupo = [...mapa.values()].find((g) => g.total === 2);
    expect(grupo).toBeDefined();
    expect(grupo?.available).toBe(1);
  });

  test('cuenta las Hermanas de una clave', () => {
    const todas = [
      clave(1, KeyStatus.Available, 'Cities: Skylines - Snowfall'),
      clave(2, KeyStatus.Redeemed, 'Cities: Skylines - Snowfall'),
    ];

    expect(siblingsOf(todas[0]!, todas)).toBe(2);
    expect(siblingsOf(todas[0]!, [todas[0]!])).toBe(1);
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