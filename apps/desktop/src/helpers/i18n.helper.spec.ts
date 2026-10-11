import { describe, expect, test } from 'bun:test';

import {
  browserLocale,
  detectLocale,
  interpolate,
  translate,
} from './i18n.helper';
import { AppLocale } from '@/contracts/enums/app-locale.enum';
import { EN } from '@/contracts/constants/i18n.constants';
import { baseKeys } from './i18n.helper';

describe('interpolar valores', () => {
  test('sustituye los marcadores por su posicion', () => {
    expect(interpolate('{0} de {1}', ['3', '10'])).toBe('3 de 10');
  });

  test('deja el marcador si no hay argumento', () => {
    expect(interpolate('{0} y {1}', ['uno'])).toBe('uno y {1}');
  });

  test('un texto sin marcadores no se toca', () => {
    expect(interpolate('Hola', ['x'])).toBe('Hola');
  });
});

describe('traducir', () => {
  test('en ingles sale el texto traducido', () => {
    expect(translate(AppLocale.En, 'action.save')).toBe('Save');
  });

  test('en espanol sale el texto original', () => {
    expect(translate(AppLocale.Es, 'action.save')).toBe('Guardar');
  });

  test('un idioma sin traduccion cae en espanol, no en blanco', () => {
    // El frances esta vacio a proposito: debe leerse en espanol.
    expect(translate(AppLocale.Fr, 'action.save')).toBe('Guardar');
  });

  test('interpola los argumentos en el idioma pedido', () => {
    expect(translate(AppLocale.En, 'select.many', [7])).toBe('7 selected');
  });

  test('una clave que no existe en ningun sitio devuelve la clave', () => {
    expect(translate(AppLocale.En, 'no.existe.esta.clave')).toBe('no.existe.esta.clave');
  });
});

describe('detectar el idioma', () => {
  test('el navegador pide ingles y sale ingles', () => {
    expect(detectLocale(['en-GB', 'es'])).toBe(AppLocale.En);
  });

  test('el navegador pide espanol y sale espanol', () => {
    expect(detectLocale(['es-ES', 'en'])).toBe(AppLocale.Es);
  });

  test('un idioma que no soportamos cae en espanol', () => {
    expect(detectLocale(['ja-JP', 'de'])).toBe(AppLocale.Es);
  });

  test('sin candidatos sale espanol', () => {
    expect(detectLocale([])).toBe(AppLocale.Es);
  });

  test('en un entorno sin navigator no rompe', () => {
    expect(browserLocale()).toBeTruthy();
  });
});

describe('cobertura de las traducciones', () => {
  test('todo lo que se usa en espanol esta tambien en ingles', () => {
    // Si esto falla, hay un texto nuevo en la interfaz que no se ha
    // traducido y que saldra en espanol dentro de la version inglesa.
    const faltan = baseKeys().filter((clave) => !(clave in EN));

    expect(faltan).toEqual([]);
  });

  test('ingles no tiene claves que el espanol ignore', () => {
    const sobran = Object.keys(EN).filter((clave) => !baseKeys().includes(clave));

    expect(sobran).toEqual([]);
  });
});