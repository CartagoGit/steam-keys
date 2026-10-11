import { describe, expect, test } from 'bun:test';

import { STORAGE_MODE_LABEL, STORAGE_MODE_NOTICE, StorageMode } from './runtime.helper';
import { APP_LOCALE_VALUES, AppLocale, TRANSLATIONS } from '@/contracts';
import { translate } from './i18n.helper';

/**
 * Los textos del modo donde se guardan las claves.
 *
 * Son el aviso mas visible de los cinco idiomas: aparece en una barra fija
 * encima de la lista, en todas las pantallas y siempre. Antes eran texto
 * castellano escrito a mano en `runtime.helper.ts`, asi que con la app puesta
 * en frances o en portugues se leia "App de escritorio" en medio de la
 * interfaz francesa. Estos tests existem para que eso no vuelva.
 */

const TODOS = Object.values(StorageMode);

describe('textos del modo de almacenamiento', () => {
  test('cada modo tiene etiqueta y aviso', () => {
    for (const modo of TODOS) {
      expect(STORAGE_MODE_LABEL[modo]).toBeTruthy();
      expect(STORAGE_MODE_NOTICE[modo]).toBeTruthy();
    }
  });

  test('las etiquetas y los avisos estan traducidos en los cinco idiomas', () => {
    // Si aqui aparece un `undefined`, la clave existe en castellano pero no en
    // el resto, y `t()` devolveria el texto de la clave en pantalla.
    const sinTraducir = APP_LOCALE_VALUES.flatMap((locale) =>
      TODOS.flatMap((modo) => {
        const pares: readonly (readonly [string, string])[] = [
          ['etiqueta', STORAGE_MODE_LABEL[modo]],
          ['aviso', STORAGE_MODE_NOTICE[modo]],
        ];

        return pares
          .filter(([, clave]) => !(clave in TRANSLATIONS[locale]))
          .map(([que, clave]) => `${locale}:${que}:${clave}`);
      }),
    );

    expect(sinTraducir).toEqual([]);
  });

  test('cada modo se distingue de los otros dos', () => {
    // Si dos modos compartieran etiqueta, el usuario no sabria donde esta
    // guardando sus claves, que es justo lo que dice este aviso.
    const etiquetas = TODOS.map((modo) => translate(AppLocale.Es, STORAGE_MODE_LABEL[modo]));

    expect(new Set(etiquetas).size).toBe(TODOS.length);
  });

  test('el aviso de la vista previa avisa de que los datos se pierden', () => {
    // Es el aviso que mas importa: aqui los datos no estan en disco y se van
    // al limpiar el navegador. Si se pierde, el usuario cree que ha perdido
    // sus claves guardadas de verdad.
    const aviso = translate(AppLocale.Es, STORAGE_MODE_NOTICE[StorageMode.Memory]);

    expect(aviso).toContain('localStorage');
    expect(aviso).not.toBe(STORAGE_MODE_NOTICE[StorageMode.Memory]);
  });

  test('el aviso del escritorio dice que las claves estan en disco', () => {
    const aviso = translate(AppLocale.Es, STORAGE_MODE_NOTICE[StorageMode.Tauri]);

    expect(aviso).toContain('SQLite');
  });
});