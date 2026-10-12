import { describe, expect, test } from 'bun:test';

import { formatHours } from './format-hours.helper';
import { AppLocale } from '@/contracts';

describe('las horas jugadas', () => {
  test('el separador decimal es el del idioma, no siempre un punto', () => {
    /**
     * El fallo que motivó el helper.
     *
     * Se pintaba con `toFixed(1)`, que escribe **siempre** con punto, en los
     * cinco idiomas. En castellano, frances y portugues el separador es la coma,
     * asi que se leia «2.5 h jugados» al lado de una fecha que si salia bien:
     * justo cuando una cosa delata que la otra no se ha mirado.
     */
    expect(formatHours(150, AppLocale.Es)).toBe('2,5');
    expect(formatHours(150, AppLocale.Fr)).toBe('2,5');
    expect(formatHours(150, AppLocale.Pt)).toBe('2,5');
    expect(formatHours(150, AppLocale.De)).toBe('2,5');

    // El ingles es el unico de los cinco con punto, y ese si es el suyo.
    expect(formatHours(150, AppLocale.En)).toBe('2.5');
  });

  test('con cinco cifras sale el separador de millares de cada idioma', () => {
    /**
     * El separador de millares no lo pone `toFixed`: sale del `Intl`, y cambia
     * con el pais. Con doce mil horas jugadas `toFixed` daria «12345.0» sin
     * ningun separador, que es justo lo que hace ilegible un numero de cinco
     * cifras.
     *
     * Y no es el mismo en los cuatro: punto en castellano y aleman, coma en
     * ingles Britainico —que agrupa con coma y separates el decimal con punto,
     * al reves que `en-US`— y espacio en frances. Con cuatro cifras en
     * castellano tampoco sale separador: el castellano agrupa a partir de cinco.
     */
    const horas = 740_700;

    expect(formatHours(horas, AppLocale.Es)).toBe('12.345,0');
    expect(formatHours(horas, AppLocale.De)).toBe('12.345,0');
    expect(formatHours(horas, AppLocale.En)).toBe('12,345.0');

    // El frances agrupa con un espacio, que es el que usa de verdad.
    expect(formatHours(horas, AppLocale.Fr).replace(/\s/g, ' ')).toBe('12 345,0');

    // Y con cuatro cifras, en castellano, no hay separador: se agrupa a partir
    // de cinco. En ingles si, porque agrupa a partir de cuatro.
    expect(formatHours(73_830, AppLocale.Es)).toBe('1230,5');
    expect(formatHours(73_830, AppLocale.En)).toBe('1,230.5');
  });

  test('siempre un decimal, tambien cuando sale entero', () => {
    // El numero va dentro de un texto con su unidad, en una columna de cifras a
    // la derecha. Si el entero saliera sin decimal, la columna daria un bote al
    // pasar de un juego de 2 horas a uno de 2 coma 5.
    expect(formatHours(120, AppLocale.Es)).toBe('2,0');
    expect(formatHours(121, AppLocale.Es)).toBe('2,0');
  });

  test('cero y lo que no es un numero no rompen nada', () => {
    // Steam devuelve -1 cuando no lo sabe, y una division por eso daria NaN
    // dentro del texto.
    expect(formatHours(0, AppLocale.Es)).toBe('0.0');
    expect(formatHours(-1, AppLocale.Es)).toBe('0.0');
    expect(formatHours(Number.NaN, AppLocale.Es)).toBe('0.0');
    expect(formatHours(Number.POSITIVE_INFINITY, AppLocale.Es)).toBe('0.0');
  });
});
