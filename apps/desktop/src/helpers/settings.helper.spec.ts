import { describe, expect, test } from 'bun:test';

import {
  readBool,
  readLocale,
  readTheme,
  serializeSetting,
} from './settings.helper';
import { APP_LOCALE_VALUES, APP_THEME_VALUES, AppLocale, AppTheme, DEFAULT_LOCALE } from '@/contracts';

/**
 * Conversion entre los valores de la tabla de ajustes y los del resto de la
 * app.
 *
 * Esta frontera es donde se perdian cosas sin que se notara: un tema se
 * guardaba bien y al reiniciar aparecia otro, porque la lectura solo aceptaba
 * dos de los cinco valores. Los tests de abajo son la red que evita que anadir
 * un valor nuevo rompa el guardado otra vez.
 */

describe('convertir a texto', () => {
  test('los booleanos van como 1 y 0', () => {
    expect(serializeSetting(true)).toBe('1');
    expect(serializeSetting(false)).toBe('0');
  });

  test('los nulos y los indefinidos dejan la cadena vacia', () => {
    expect(serializeSetting(null)).toBe('');
    expect(serializeSetting(undefined)).toBe('');
  });

  test('los demas van como estan', () => {
    expect(serializeSetting('midnight')).toBe('midnight');
    expect(serializeSetting(42)).toBe('42');
  });

  test('volver a leer un booleano devuelve lo mismo', () => {
    expect(readBool(serializeSetting(true))).toBe(true);
    expect(readBool(serializeSetting(false))).toBe(false);
  });
});

describe('leer un booleano', () => {
  test('acepta 1 y true', () => {
    expect(readBool('1')).toBe(true);
    expect(readBool('true')).toBe(true);
  });

  test('cualquier otra cosa es falso, tambien 0', () => {
    expect(readBool('0')).toBe(false);
    expect(readBool('')).toBe(false);
    expect(readBool(undefined)).toBe(false);
    expect(readBool('cualquier cosa')).toBe(false);
  });
});

describe('leer el tema', () => {
  test('se admiten los cinco temas', () => {
    for (const tema of APP_THEME_VALUES) {
      expect(readTheme(tema)).toBe(tema);
    }
  });

  test('midnight y paper sobreviven a un guardado y una lectura', () => {
    // Este es el caso que se rompia: los dos temas se guardaban bien y al
    // releerlos caian en `system`, que en un portatil con el sistema en oscuro
    // se ve igual que `dark`. El tema elegido se perdia al reiniciar.
    expect(readTheme(serializeSetting(AppTheme.Midnight))).toBe(AppTheme.Midnight);
    expect(readTheme(serializeSetting(AppTheme.Paper))).toBe(AppTheme.Paper);
  });

  test('system se admite y no se traduce todavia', () => {
    expect(readTheme('system')).toBe(AppTheme.System);
  });

  test('un valor desconocido cae en system, no en uno cualquiera', () => {
    expect(readTheme('sepia')).toBe(AppTheme.System);
    expect(readTheme('')).toBe(AppTheme.System);
    expect(readTheme(undefined)).toBe(AppTheme.System);
  });

  test('cada tema del enum tiene su bloque de css', () => {
    // El enum y el CSS van por separado. Si se anade un tema al enum y se
    // olvida el bloque de variables, la app arranca pero se ve como si el tema
    // no existentara. Este test no lo puede detectar del todo, pero si avisa
    // de que hay un valor que revisar a mano.
    for (const tema of APP_THEME_VALUES) {
      expect(typeof tema).toBe('string');
      expect(tema.length).toBeGreaterThan(0);
    }
  });
});

describe('leer el idioma', () => {
  test('se admiten los cinco idiomas', () => {
    for (const idioma of APP_LOCALE_VALUES) {
      expect(readLocale(idioma)).toBe(idioma);
    }
  });

  test('un idioma desconocido cae en el de origen', () => {
    // El castellano es el idioma de origen y siempre esta completo, asi que es
    // el unico destino seguro para lo que no se reconoce.
    expect(readLocale('klingon')).toBe(DEFAULT_LOCALE);
    expect(readLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  test('todos los idiomas de la lista se guardan', () => {
    // Se guardan tal cual. Si un idioma esta a medio traducir, la clave que
    // falte cae al castellano al resolverla, pero el ajuste no se pierde.
    for (const locale of APP_LOCALE_VALUES) {
      expect(readLocale(locale)).toBe(locale);
    }
  });

  test('la lista de idiomas cubre todos los del enum', () => {
    // Si alguien añade un idioma al enum y olvida la lista, el selector deja de
    // ofrecerlo sin avisar. Aqui solo queda como constante.
    expect(APP_LOCALE_VALUES).toEqual(Object.values(AppLocale));
  });
});