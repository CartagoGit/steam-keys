import { describe, expect, test } from 'bun:test';

import {
  buildOwnershipIndex,
  ownershipCandidates,
  palabraInicial,
} from './match-owned.helper';
import { bestCandidate, cuentaComoPropio, similarity } from '@/services/steam.service';
import type { ISteamOwnedGame } from '@/contracts';

/**
 * `esPropio` decide si el badge «ya lo tienes» aparece, y lo que dice es «esta
 * clave sobra, no la regales». Un falso negativo es un badge que falta; un
 * falso positivo hace que el usuario regale la clave de un juego que aun no
 * tiene. Por eso los casos negativos importan mas que los positivos.
 *
 * Todos los titulos positivos salen de la coleccion real: se emparejaron mal
 * con el comparador de igualdad exacta que habia antes.
 */

function juego(appId: number, name: string, isDlc = false): ISteamOwnedGame {
  return {
    appId,
    name,
    playtimeForever: 0,
    lastPlayed: 0,
    isDlc,
    iconUrl: null,
  };
}

/** Lo que hace la app: exacto primero, parecido despues entre los candidatos. */
function esPropio(
  title: string,
  indice: ReadonlyMap<string, readonly ISteamOwnedGame[]>,
): boolean {
  const candidatos = ownershipCandidates(title, indice);

  if (candidatos.length === 0) return false;

  return cuentaComoPropio(bestCandidate(title, candidatos).confianza);
}

describe('emparejar la coleccion con la biblioteca de Steam', () => {
  test('el nombre exacto sigue funcionando', () => {
    const indice = buildOwnershipIndex([juego(1, 'Hollow Knight')]);

    expect(esPropio('Hollow Knight', indice)).toBe(true);
  });

  test('un juego que no esta en la biblioteca no se marca', () => {
    const indice = buildOwnershipIndex([juego(1, 'Hollow Knight')]);

    expect(esPropio('Celeste', indice)).toBe(false);
  });

  describe('nombres que el comparador exacto dejaba pasar', () => {
    // Los tres son de la coleccion real y los tres fallaban antes.
    const casos: readonly [string, string][] = [
      ['World War 3: Black Gold', 'World War III Black Gold'],
      [
        "Broken Sword 1: Shadow of the Templars - The Director's Cut",
        "Broken Sword: Shadow of the Templars - Director's Cut",
      ],
      ['Afterfall Insanity - Extended Edition', 'Afterfall Insanity'],
      ['Dead Island: Game of the Year Edition', 'Dead Island'],
      ['Risen 2: Dark Waters Gold Edition', 'Risen 2: Dark Waters'],
    ];

    for (const [enLaColeccion, enSteam] of casos) {
      test(`«${enLaColeccion}» lo reconoce como «${enSteam}»`, () => {
        const indice = buildOwnershipIndex([juego(1, enSteam)]);

        expect(esPropio(enLaColeccion, indice)).toBe(true);
      });
    }
  });

  describe('nombres parecidos que NO son el mismo juego', () => {
    // El fallo caro: decir «ya lo tienes» sobre una clave de la que el
    // usuario si necesita el juego.
    const casos: readonly [string, string][] = [
      ['Portal', 'Portal 2'],
      ['Half-Life', 'Half-Life 2'],
      ['Mass Effect', 'Mass Effect 2'],
      ['Dead Space', 'Dead Space 2'],
    ];

    for (const [enLaColeccion, enSteam] of casos) {
      test(`«${enLaColeccion}» no se toma por el «${enSteam}»`, () => {
        const indice = buildOwnershipIndex([juego(1, enSteam)]);

        expect(esPropio(enLaColeccion, indice)).toBe(false);
      });
    }
  });

  test('con varios candidatos elige el que encaja de verdad', () => {
    // Tener «Portal» y «Portal 2» en la biblioteca: la clave de «Portal» es
    // propia, la de «Portal 2» tambien, y la de un juego que no esta no.
    const indice = buildOwnershipIndex([juego(1, 'Portal'), juego(2, 'Portal 2')]);

    expect(esPropio('Portal', indice)).toBe(true);
    expect(esPropio('Portal 2', indice)).toBe(true);
    expect(esPropio('Portal Stories', indice)).toBe(false);
  });

  test('sin biblioteca no marca nada', () => {
    expect(esPropio('Hollow Knight', buildOwnershipIndex([]))).toBe(false);
  });
});

describe('indice por palabra inicial', () => {
  test('salta los articulos para no perder las comparaciones', () => {
    // "The Witcher 3" y "Witcher 3" tienen que caer en el mismo sitio: si no,
    // nunca se comparan y nunca se reconocen como el mismo juego.
    expect(palabraInicial('The Witcher 3')).toBe(palabraInicial('Witcher 3'));
  });

  test('el grupo es solo de la biblioteca que se pasa', () => {
    const indice = buildOwnershipIndex([
      juego(1, 'The Witcher 3'),
      juego(2, 'Half-Life 2'),
    ]);

    expect(ownershipCandidates('Witcher 3', indice)).toHaveLength(1);
    expect(ownershipCandidates('Witcher 3', indice)[0]?.name).toBe('The Witcher 3');
  });

  test('los nombres repetidos se agrupan juntos', () => {
    // Una biblioteca tiene DLC y expansiones del mismo juego base.
    const indice = buildOwnershipIndex([
      juego(1, 'Cities: Skylines'),
      juego(2, 'Cities: Skylines - Deluxe'),
    ]);

    expect(ownershipCandidates('Cities Skylines', indice)).toHaveLength(2);
  });

  test('un nombre vacio no colisiona con todo', () => {
    const indice = buildOwnershipIndex([juego(1, '!!!'), juego(2, 'Celeste')]);

    expect(ownershipCandidates('Celeste', indice)).toHaveLength(1);
  });
});

describe('el umbral de «ya lo tienes»', () => {
  test('descarta el parecido que confunde con el juego siguiente', () => {
    // Portal / Portal 2 puntua en 0.75: por encima de 'loose' pero por debajo
    // de 'likely'. Este es exactamente el margen que protege el badge.
    const puntuacion = similarity('Portal', 'Portal 2');

    expect(puntuacion).toBeGreaterThanOrEqual(0.7);
    expect(puntuacion).toBeLessThan(0.85);
  });

  test('acepta las diferencias de escritura que si son el mismo juego', () => {
    expect(similarity('World War 3: Black Gold', 'World War III Black Gold')).toBe(
      1,
    );
  });

  test('los numeros romanos y los digitos son el mismo numero', () => {
    // Steam escribe «World War III» y el TXT «World War 3». Sin la conversion,
    // puntuan 0.84 y quedan por debajo del umbral.
    expect(similarity('Fallout 3', 'Fallout III')).toBe(1);
    expect(similarity('Civilization IV', 'Civilization 4')).toBe(1);
  });

  test('convertir numeros no rompe las palabras que empiezan igual', () => {
    // `i` a secas es la primera persona, no el numero uno. Si se tradujera,
    // «I Am Alive» y «I Am Alive Remastered» se emparejarian de mas.
    expect(similarity('I Am Alive', 'I Am Alive Remastered')).toBeLessThan(0.85);
  });
});