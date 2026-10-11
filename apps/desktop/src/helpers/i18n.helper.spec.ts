import { describe, expect, test } from 'bun:test';

import {
  browserLocale,
  detectLocale,
  interpolate,
  translate,
} from './i18n.helper';
import { AppLocale, APP_LOCALE_VALUES, DEFAULT_LOCALE } from '@/contracts/enums/app-locale.enum';
import { TRANSLATIONS } from '@/contracts/constants/i18n.constants';
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

  test('cada idioma traducido sale en su idioma', () => {
    // La razon de ser de los diccionarios: al elegir el idioma, todo lo que hay
    // en pantalla cambia. Si esto falla, ese idioma esta a medio traducir.
    for (const locale of APP_LOCALE_VALUES) {
      // Se compara contra el idioma vecino y no contra el castellano: si
      // `translate` devolviera el castellano, la comparacion fallaria aqui, que
      // es justo lo que se quiere comprobar.
      const vecino = locale === AppLocale.En ? AppLocale.Es : AppLocale.En;

      expect(translate(locale, 'action.save')).not.toBe(translate(vecino, 'action.save'));
    }
  });

  test('una clave que no existe en ningun idioma devuelve la clave', () => {
    // `translate` cae al espanol cuando el idioma pedido no tiene la clave, y
    // devuelve la propia clave cuando tampoco el espanol la tiene. Lo segundo
    // es una prueba de que el primero ocurre de verdad: si no existiera el
    // espanol, la clave se devolveria tal cual.
    expect(translate(AppLocale.Fr, 'no.existe.esta.clave')).toBe('no.existe.esta.clave');
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

  test('un idioma que no soportamos cae en ingles', () => {
    expect(detectLocale(['ja-JP', 'it'])).toBe(DEFAULT_LOCALE);
    expect(DEFAULT_LOCALE).toBe(AppLocale.En);
  });

  test('un idioma de la lista se detecta por su idioma base', () => {
    // El navegador manda 'pt-BR' o 'de-AT', no 'pt' ni 'de' a secas.
    expect(detectLocale(['pt-BR'])).toBe(AppLocale.Pt);
    expect(detectLocale(['de-AT'])).toBe(AppLocale.De);
    expect(detectLocale(['fr-CA'])).toBe(AppLocale.Fr);
  });

  test('sin candidatos sale ingles', () => {
    expect(detectLocale([])).toBe(DEFAULT_LOCALE);
  });

  test('en un entorno sin navigator no rompe', () => {
    expect(browserLocale()).toBeTruthy();
  });
});

describe('cobertura de las traducciones', () => {
  test('todo lo que se usa en espanol esta en todos los idiomas', () => {
    // Si esto falla, hay un texto nuevo en la interfaz sin traducir, y saldra en
    // espanol dentro de la version de ese idioma. Un idioma a medio traducir se
    // ve como un idioma que no hace nada.
    const faltan = APP_LOCALE_VALUES.flatMap((locale) =>
      baseKeys()
        .filter((clave) => !(clave in TRANSLATIONS[locale]))
        .map((clave) => `${locale}:${clave}`),
    );

    expect(faltan).toEqual([]);
  });

  test('ningun idioma tiene claves que el espanol ignore', () => {
    // Una clave de mas no rompe nada, pero es texto muerto que alguien
    // tradujo siniexistiendo, y hace creer que el idioma cubre mas de lo que
    // cubre.
    const sobran = APP_LOCALE_VALUES.flatMap((locale) =>
      Object.keys(TRANSLATIONS[locale])
        .filter((clave) => !baseKeys().includes(clave))
        .map((clave) => `${locale}:${clave}`),
    );

    expect(sobran).toEqual([]);
  });

  test('ningun idioma repite el texto del espanol', () => {
    // Copiar y pegar el castellano es como no haber traducido, y es un fallo
    // que no se ve leyendo el diccionario: la clave esta, asi que el test de
    // cobertura pasa. Este lo pilla.
    //
    // Hay coincidencias legitimas y no son pocas: los cognados (el portugues
    // comparte media pantalla con el castellano), los nombres propios, los
    // codigos de tecla y las siglas. Se listan una a una porque una lista
    // razonada obliga a decidir clave por clave, que es justo lo que hay que
    // hacer al traducir; una lista a ojo deja pasar lo que se cuela.
    const LEGITIMO: Record<string, readonly string[]> = {
      en: [
        // Nombres de juegos, codigo de tecla y sigla.
        'sort.alpha', 'editor.titlePlaceholder', 'editor.keyPlaceholder',
        'editor.parentPlaceholder', 'editor.tagsPlaceholder', 'owned.dlc',
      ],
      fr: [
        // Cognados con el castellano, mas lo mismo que en ingles.
        'sort.alpha', 'status.available', 'import.available',
        'editor.titlePlaceholder', 'editor.keyPlaceholder',
        'editor.parentPlaceholder', 'editor.tagsPlaceholder', 'owned.dlc',
      ],
      pt: [
        // El portugues y el castellano son lo bastante parecidos para que mas
        // de un tercio de la interfaz coincida palabra por palabra. Es correcto
        // siempre que sea la palabra portuguesa, no la castellana: `Ajustes`,
        // `Importar` o `Etiquetas` estan bien porque son las de alli.
        'action.save', 'action.cancel', 'action.confirm', 'action.edit', 'action.copy',
        'toolbar.sort', 'toolbar.export', 'toolbar.import', 'toolbar.settings',
        'sort.alpha', 'sort.status', 'sort.platform',
        'filter.platform', 'filter.status', 'filter.scope.label',
        'filter.kind.label', 'filter.kind.all',
        'select.tags', 'select.groupOrganize', 'tags.title',
        'editor.platform', 'editor.status', 'editor.note', 'editor.tags',
        'editor.titlePlaceholder', 'editor.keyPlaceholder',
        'editor.parentPlaceholder', 'editor.tagsPlaceholder',
        'import.title', 'row.forRecipient',
        'settings.title', 'settings.theme', 'settings.language', 'owned.dlc',
        // El portugues y el castellano comparten tambien estas del panel de
        // datos: "Restaurar", "App de escritorio" y "Restaurar {0}" son la
        // misma palabra en los dos idiomas, escrita igual.
        'storage.restore', 'storage.restoreTitle', 'storage.mode.desktop',
      ],
      de: ['sort.alpha', 'editor.titlePlaceholder', 'editor.keyPlaceholder',
        'editor.parentPlaceholder', 'editor.tagsPlaceholder', 'owned.dlc'],
    };

    // `app.title` tampoco se comprueba aqui: es una marca y tiene su test.
    const pegados = APP_LOCALE_VALUES.filter((locale) => locale !== AppLocale.Es).flatMap((locale) =>
      baseKeys()
        .filter(
          (clave) =>
            clave !== 'app.title' &&
            TRANSLATIONS[locale][clave] === TRANSLATIONS[AppLocale.Es][clave] &&
            !LEGITIMO[locale]?.includes(clave),
        )
        .map((clave) => `${locale}:${clave}`),
    );

    expect(pegados).toEqual([]);
  });

  test('el nombre de la app no se traduce', () => {
    // Es una marca. Se deja igual en todos los idiomas a proposito.
    for (const locale of APP_LOCALE_VALUES) {
      expect(TRANSLATIONS[locale]['app.title']).toBe('Steam Keys');
    }
  });
});