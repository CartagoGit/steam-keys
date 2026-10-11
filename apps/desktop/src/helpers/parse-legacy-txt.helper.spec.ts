import { describe, expect, test } from 'bun:test';
import { parseLegacyTxt } from './parse-legacy-txt.helper';
import { KeyPlatform, KeyStatus, ParsedIssueReason } from '@/contracts';

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
      'INK _ https://www.humblebundle.com/downloads?key=QwErTy12uIoP3aSd',
    );
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.keyValue).toBe('QWERTY12UIOP3ASD');
    expect(result.entries[0]?.title).toBe('INK');
  });

  test('detecta la clave de una URL de regalo', () => {
    const result = parseLegacyTxt(
      'SpeedRunners (Early Access)  - https://www.humblebundle.com/gift?key=T7XbN2pLqW9mK4cR',
    );
    expect(result.entries[0]?.keyValue).toBe('T7XBN2PLQW9MK4CR');
  });

  test('detecta una clave de Battle.net con formato 3-3-3', () => {
    const result = parseLegacyTxt('Destiny 2 - A7T-9KX-R4Z');
    expect(result.entries[0]?.platform).toBe(KeyPlatform.BattleNet);
    expect(result.entries[0]?.keyValue).toBe('A7T-9KX-R4Z');
  });

  test('detecta una clave alfanumerica larga de otra tienda', () => {
    const result = parseLegacyTxt('Blade & Soul Giveaway Pack - 8XkLm39pQrTv2wZn');
    expect(result.entries[0]?.keyValue).toBe('8XKLM39PQRTV2WZN');
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

describe('rondas de regalos', () => {
  const cabecera = (n: number): string =>
    `................. ${n} Sesion de regalos...........................`;

  const cierre = (n: number): string =>
    `.................FIN ${n} Sesion de regalos...........................`;

  test('las claves de una ronda quedan como regaladas', () => {
    const raw = [cabecera(3), '', 'Skyward Collapse - MQ7RT-29XKL-ZPN84', cierre(3)].join('\n');

    const result = parseLegacyTxt(raw);
    expect(result.entries[0]?.status).toBe(KeyStatus.Gifted);
  });

  test('la ronda lleva su numero en la etiqueta', () => {
    const raw = [cabecera(4), '', 'Celeste - MQ7RT-29XKL-ZPN84', cierre(4)].join('\n');

    const result = parseLegacyTxt(raw);
    expect(result.entries[0]?.tags).toContain('sesion-regalos-4');
  });

  test('la ronda acaba en su FIN y lo siguiente vuelve a disponible', () => {
    const raw = [
      cabecera(5),
      '',
      'Celeste - MQ7RT-29XKL-ZPN84',
      cierre(5),
      '',
      'Hollow Knight - B4KMD-58RQW-LNCT3',
    ].join('\n');

    const result = parseLegacyTxt(raw);
    const porTitulo = Object.fromEntries(
      result.entries.map((e) => [e.title, e.status]),
    );

    expect(porTitulo['Celeste']).toBe(KeyStatus.Gifted);
    expect(porTitulo['Hollow Knight']).toBe(KeyStatus.Available);
  });

  test('una clave repetida dentro de la ronda tambien se marca', () => {
    // Es el caso real del TXT: la clave se lista primero como parte de la
    // coleccion y se repite dentro del bloque de la ronda. La segunda vez es
    // la que dice que se regaló.
    const raw = [
      'Celeste - MQ7RT-29XKL-ZPN84',
      '',
      cabecera(3),
      '',
      'Celeste - MQ7RT-29XKL-ZPN84',
      cierre(3),
    ].join('\n');

    const result = parseLegacyTxt(raw);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.status).toBe(KeyStatus.Gifted);
    expect(result.entries[0]?.tags).toContain('sesion-regalos-3');
  });

  test('una clave canjeada no se degrada a regalada por estar en una ronda', () => {
    const raw = [
      'ACTIVAR YO ->>>>>',
      '',
      'Celeste - MQ7RT-29XKL-ZPN84',
      cierre(9),
    ].join('\n');

    const result = parseLegacyTxt(raw);
    expect(result.entries[0]?.status).toBe(KeyStatus.Redeemed);
  });

  test('la ronda no pisa el destinatario que ya hubiera', () => {
    const raw = [cabecera(3), '', 'Celeste - MQ7RT-29XKL-ZPN84', cierre(3)].join('\n');

    const result = parseLegacyTxt(raw);
    expect(result.entries[0]?.giftedTo).toBeNull();
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

  test('una seccion de canjeadas termina cuando empieza otra nota', () => {
    // Regresion del TXT real: tras "ACTIVAR YO" no hay ninguna clave, y lo
    // que viene despues pertenece ya a la seccion siguiente.
    const raw = [
      'Dota 2 - MQ7RT-29XKL-ZPN84',
      '',
      'ACTIVAR YO ->>>>>',
      '',
      'Celeste - B4KMD-58RQW-LNCT3',
    ].join('\n');

    const result = parseLegacyTxt(raw);
    const porTitulo = Object.fromEntries(
      result.entries.map((e) => [e.title, e.status]),
    );

    expect(porTitulo['Dota 2']).toBe(KeyStatus.Available);
    expect(porTitulo['Celeste']).toBe(KeyStatus.Redeemed);
  });

  test('"ACTIVAR Con el juego base" NO marca como canjeada', () => {
    // Esta linea del TXT original empieza por ACTIVAR pero **no** significa
    // que las claves esten canjeadas: es una instruccion de como activar las
    // DLC ("con el juego base"). Marcarlas como canjeadas dejaba 19 DLCs de
    // Earth Defense Force en el estado equivocado.
    const raw = [
      'ACTIVAR Con el juego base - TODAS SON DLCS ->>>',
      '',
      'EARTH DEFENSE FORCE 4.1',
      '{',
      'B4KMD-58RQW-LNCT3',
      '}',
      '',
      'Desperados 3 - ZR92N-7JDMK-QPW45',
    ].join('\n');

    const result = parseLegacyTxt(raw);

    const dlc = result.entries.find((e) => e.keyValue === 'B4KMD-58RQW-LNCT3');
    expect(dlc?.status).toBe(KeyStatus.Available);
  });

  test('"ACTIVAR Con el juego base" apaga una seccion de canjeadas anterior', () => {
    // El TXT real tiene "ACTIVAR YO" y luego, sin ninguna clave entre medias,
    // "ACTIVAR Con el juego base". Lo que viene despues de la segunda linea
    // no debe heredar el estado de la primera.
    const raw = [
      'ACTIVAR YO ->>>>>',
      '',
      'ACTIVAR Con el juego base - TODAS SON DLCS ->>>',
      '',
      'EARTH DEFENSE FORCE 4.1',
      '{',
      'B4KMD-58RQW-LNCT3',
      '}',
    ].join('\n');

    const result = parseLegacyTxt(raw);
    expect(result.entries[0]?.status).toBe(KeyStatus.Available);
  });

  test('el estado canjeada no se desborda al terminar el bloque de DLC', () => {
    // Este es el fallo que motivo el arreglo. En el TXT original el bloque
    // `{ ... }` va justo despues de un `ACTIVAR ...`, y al no apagarse el
    // estado alli, *todo* lo que venia despues salia como canjeado.
    const raw = [
      'ACTIVAR Con el juego base - TODAS SON DLCS ->>>',
      '',
      'EARTH DEFENSE FORCE 4.1',
      '{',
      'B4KMD-58RQW-LNCT3',
      '}',
      '',
      'Desperados 3 - ZR92N-7JDMK-QPW45',
      'Superhot - A7T-9KX-R4Z',
    ].join('\n');

    const result = parseLegacyTxt(raw);

    const despues = result.entries.filter((e) => e.title !== 'EARTH DEFENSE FORCE 4.1');

    expect(despues.length).toBeGreaterThan(0);
    for (const entrada of despues) {
      expect(entrada.status).toBe(KeyStatus.Available);
    }
  });

  test('un nombre suelto seguido de la nota se combina como nombre y nota', () => {
    const raw = [
      'Destiny 2',
      'June 2018 Humble Monthly',
      'A7T-9KX-R4Z',
    ].join('\n');

    const result = parseLegacyTxt(raw);
    expect(result.entries[0]?.title).toBe('Destiny 2');
    expect(result.entries[0]?.note).toBe('June 2018 Humble Monthly');
  });

  test('una linea sobre Battle.net fija la plataforma de las siguientes', () => {
    const raw = [
      'BLIZARD DEJO DE USAR DESTINY EN BATTLE.NET ->>>',
      '',
      'Overwatch - A7T-9KX-R4Z',
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
    const raw = ['Destiny 2', 'June 2018 Humble Monthly', 'A7T-9KX-R4Z-VFHW'].join('\n');
    const result = parseLegacyTxt(raw);

    expect(result.entries[0]?.keyValue).toBe('A7T-9KX-R4Z');
    expect(
      result.issues.some((issue) => issue.reason === ParsedIssueReason.ClaveSospechosa),
    ).toBe(true);
  });

  test('marca las claves de plataforma desconocida para revisarlas', () => {
    const result = parseLegacyTxt('Regalo - 8XkLm39pQrTv2wZn');
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