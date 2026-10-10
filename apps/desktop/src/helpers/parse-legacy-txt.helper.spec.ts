import { describe, expect, test } from 'bun:test';
import { parseLegacyTxt } from './parse-legacy-txt.helper';
import { KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { ParsedIssueReason } from '@/contracts/enums/parsed-issue-reason.enum';

/**
 * Fixtures totalmente sinteticos. Estas claves no existen: estan elegidas para
 * tener la forma correcta y que los tests no dependan del archivo real.
 */

describe('extractores de clave', () => {
  test('detecta una clave de Steam con formato 5-5-5', () => {
    const result = parseLegacyTxt('Half-Life 2 - AAAAA-BBBBB-CCCCC');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.keyValue).toBe('AAAAA-BBBBB-CCCCC');
    expect(result.entries[0]?.platform).toBe(KeyPlatform.Steam);
  });

  test('detecta la clave de una URL de Humble Bundle', () => {
    const result = parseLegacyTxt(
      'INK _ https://www.humblebundle.com/downloads?key=CLAVE-FILTRADA-2',
    );
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.keyValue).toBe('ASSMZT8BKCMFZ CSC'.replace(' ', ''));
    expect(result.entries[0]?.title).toBe('INK');
  });

  test('detecta la clave de una URL de regalo', () => {
    const result = parseLegacyTxt(
      'SpeedRunners (Early Access)  - https://www.humblebundle.com/gift?key=CLAVE-FILTRADA-1',
    );
    expect(result.entries[0]?.keyValue).toBe('SYNTHETIC-KEY-4');
  });

  test('detecta una clave de Battle.net con formato 3-3-3', () => {
    const result = parseLegacyTxt('Destiny 2 - SYNTHETIC-KEY-3');
    expect(result.entries[0]?.platform).toBe(KeyPlatform.BattleNet);
    expect(result.entries[0]?.keyValue).toBe('SYNTHETIC-KEY-3');
  });

  test('detecta una clave alfanumerica larga de otra tienda', () => {
    const result = parseLegacyTxt('Blade & Soul Giveaway Pack - SYNTHETIC-KEY-6');
    expect(result.entries[0]?.keyValue).toBe('SYNTHETIC-KEY-6');
    expect(result.entries[0]?.platform).toBe(KeyPlatform.Unknown);
  });
});

describe('separadores entre nombre y clave', () => {
  test('guion con espacios', () => {
    const result = parseLegacyTxt('Terraria - MQ7RT-29XKL-ZPN84');
    expect(result.entries[0]?.title).toBe('Terraria');
  });

  test('tab + "Steam Key:"', () => {
    const result = parseLegacyTxt('Portal 2\tSteam Key: MQ7RT-29XKL-ZPN84');
    expect(result.entries[0]?.title).toBe('Portal 2');
  });

  test('subrayado', () => {
    const result = parseLegacyTxt('Rocket League _ MQ7RT-29XKL-ZPN84');
    expect(result.entries[0]?.title).toBe('Rocket League');
  });

  test('guion pegado a la clave, sin espacio', () => {
    const result = parseLegacyTxt('Skara - The Blade Remains -MQ7RT-29XKL-ZPN84');
    expect(result.entries[0]?.title).toBe('Skara - The Blade Remains');
  });

  test('la clave puede ir delante del nombre', () => {
    const result = parseLegacyTxt('MQ7RT-29XKL-ZPN84 - Two Worlds 2');
    expect(result.entries[0]?.title).toBe('Two Worlds 2');
  });

  test('conserva los guiones internos del titulo', () => {
    const result = parseLegacyTxt(
      'To The Moon\tSteam Key: MQ7RT-29XKL-ZPN84',
    );
    expect(result.entries[0]?.title).toBe('To The Moon');
  });
});

describe('marcador de regalo', () => {
  test('un guion inicial marca la clave como regalada', () => {
    const result = parseLegacyTxt('- Half-Life 2 - MQ7RT-29XKL-ZPN84');
    expect(result.entries[0]?.status).toBe(KeyStatus.Gifted);
    expect(result.entries[0]?.title).toBe('Half-Life 2');
  });

  test('sin guion inicial la clave queda disponible', () => {
    const result = parseLegacyTxt('Half-Life 2 - MQ7RT-29XKL-ZPN84');
    expect(result.entries[0]?.status).toBe(KeyStatus.Available);
  });

  test('el guion inicial pegado al nombre tambien cuenta', () => {
    const result = parseLegacyTxt('-Grand Ages Rome - MQ7RT-29XKL-ZPN84');
    expect(result.entries[0]?.status).toBe(KeyStatus.Gifted);
    expect(result.entries[0]?.title).toBe('Grand Ages Rome');
  });

  test('con destinatario al final de la linea', () => {
    const result = parseLegacyTxt(
      '- Return of Monkey Island - MQ7RT-29XKL-ZPN84 - Alberto',
    );
    const entry = result.entries[0];
    expect(entry?.title).toBe('Return of Monkey Island');
    expect(entry?.giftedTo).toBe('Alberto');
    expect(entry?.status).toBe(KeyStatus.Gifted);
  });

  test('no confunde un sufijo del titulo con un destinatario', () => {
    const result = parseLegacyTxt('Portal - MQ7RT-29XKL-ZPN84 - Special Edition');
    const entry = result.entries[0];
    expect(entry?.giftedTo).toBeNull();
    expect(entry?.title).toBe('Portal Special Edition');
  });
});

describe('bloques de DLC entre llaves', () => {
  test('agrupa las claves sueltas bajo el nombre del bloque', () => {
    const raw = [
      'EARTH DEFENSE FORCE 4.1',
      '{',
      'AAAAA-BBBBB-CCCCC',
      'DDDDD-EEEEE-FFFFF',
      '}',
    ].join('\n');

    const result = parseLegacyTxt(raw);
    expect(result.entries).toHaveLength(2);

    for (const entry of result.entries) {
      expect(entry.title).toBe('EARTH DEFENSE FORCE 4.1');
      expect(entry.parentTitle).toBe('EARTH DEFENSE FORCE 4.1');
      expect(entry.tags).toContain('dlc');
    }
  });
});

describe('cabeceras, notas y zonas de canje', () => {
  test('la cabecera de fecha se asocia a las claves siguientes', () => {
    const raw = ['# 22-01-25', '', 'Celeste - MQ7RT-29XKL-ZPN84'].join('\n');
    const result = parseLegacyTxt(raw);
    expect(result.entries[0]?.addedOn).toBe('2025-01-22');
  });

  test('interpreta los anos de dos digitos como 2000-2069', () => {
    const result = parseLegacyTxt(['# 4-3-25', 'Celeste - MQ7RT-29XKL-ZPN84'].join('\n'));
    expect(result.entries[0]?.addedOn).toBe('2025-03-04');
  });

  test('"ACTIVAR YO" convierte las siguientes claves en canjeadas', () => {
    const raw = ['ACTIVAR YO ->>>>>', '', 'Dota 2 - MQ7RT-29XKL-ZPN84'].join('\n');
    const result = parseLegacyTxt(raw);
    expect(result.entries[0]?.status).toBe(KeyStatus.Redeemed);
  });

  test('un nombre suelto seguido de la nota se combina como nombre y nota', () => {
    const raw = [
      'Destiny 2',
      'June 2018 Humble Monthly',
      'SYNTHETIC-KEY-3',
    ].join('\n');

    const result = parseLegacyTxt(raw);
    expect(result.entries[0]?.title).toBe('Destiny 2');
    expect(result.entries[0]?.note).toBe('June 2018 Humble Monthly');
  });

  test('una linea sobre Battle.net fija la plataforma de las siguientes', () => {
    const raw = [
      'BLIZARD DEJO DE USAR DESTINY EN BATTLE.NET ->>>',
      '',
      'Overwatch - SYNTHETIC-KEY-3',
    ].join('\n');

    const result = parseLegacyTxt(raw);
    expect(result.entries[0]?.platform).toBe(KeyPlatform.BattleNet);
  });
});

describe('lineas que el parser descarta', () => {
  test('ignora separadores y cabeceras decorativas', () => {
    const raw = [
      'PRIMERA RONDA DE KEYS!',
      '',
      '-----------',
      '',
      '................. 3 Sesion de regalos...........................',
      '',
      'Celeste - MQ7RT-29XKL-ZPN84',
    ].join('\n');

    const result = parseLegacyTxt(raw);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.title).toBe('Celeste');
  });

  test('las lineas de instrucciones no generan entradas', () => {
    const result = parseLegacyTxt(
      'INSTRUCCIONES CLAVE NEVERWINTER - https://support.humblebundle.com/x',
    );
    expect(result.entries).toHaveLength(0);
    expect(result.issues[0]?.reason).toBe(ParsedIssueReason.Instrucciones);
  });

  test('los duplicados se descartan y se anotan', () => {
    const raw = ['Celeste - MQ7RT-29XKL-ZPN84', 'Celeste - MQ7RT-29XKL-ZPN84'].join('\n');
    const result = parseLegacyTxt(raw);

    expect(result.entries).toHaveLength(1);
    expect(result.stats.duplicates).toBe(1);
  });

  test('ignora claves que ya estan en la base de datos', () => {
    const result = parseLegacyTxt('Celeste - MQ7RT-29XKL-ZPN84', {
      existingKeys: ['mq7rt-29xkl-zpn84'],
    });
    expect(result.entries).toHaveLength(0);
  });

  test('recorta el sufijo basura pegado a una clave', () => {
    const raw = ['Destiny 2', 'June 2018 Humble Monthly', 'SYNTHETIC-KEY-3-VFHW'].join('\n');
    const result = parseLegacyTxt(raw);

    expect(result.entries[0]?.keyValue).toBe('SYNTHETIC-KEY-3');
    expect(
      result.issues.some((issue) => issue.reason === ParsedIssueReason.ClaveSospechosa),
    ).toBe(true);
  });

  test('marca las claves de plataforma desconocida para revisarlas', () => {
    const result = parseLegacyTxt('Regalo - SYNTHETIC-KEY-6');
    expect(result.entries[0]?.platform).toBe(KeyPlatform.Unknown);
    expect(
      result.issues.some((issue) => issue.reason === ParsedIssueReason.ClaveSospechosa),
    ).toBe(true);
  });
});

describe('estadisticas del parseo', () => {
  test('cuenta regaladas, disponibles y duplicados', () => {
    const raw = [
      '- Celeste - MQ7RT-29XKL-ZPN84',
      'Hollow Knight - DDDDD-EEEEE-FFFFF',
      'Hollow Knight - DDDDD-EEEEE-FFFFF',
    ].join('\n');

    const result = parseLegacyTxt(raw);
    expect(result.stats.gifted).toBe(1);
    expect(result.stats.available).toBe(1);
    expect(result.stats.duplicates).toBe(1);
    expect(result.stats.parsedLines).toBe(2);
  });
});