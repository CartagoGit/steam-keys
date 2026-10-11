import { describe, expect, test } from 'bun:test';

import {
  isPersistent,
  STORAGE_MODE_LABEL,
  STORAGE_MODE_NOTICE,
  StorageMode,
  supportsBackups,
} from './runtime.helper';
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

describe('que se puede hacer en cada modo', () => {
  test('las copias dependen de tener una base de datos, no de estar en Tauri', () => {
    // Las copias son filas de la tabla `backups`, no ficheros ni comandos de
    // Rust. Mientras fueron ficheros, `supportsBackups()` era `isTauri()` y todo
    // fue coherente; al pasar a la tabla el predicado se quedo como estaba y
    // empezo a deshabilitar el boton de copia en el puente de desarrollo —que
    // es justo donde se prueba la interfaz— con el texto de "solo en la app de
    // escritorio".
    //
    // Este test ata las dos cosas: hay motor de verdad, hay copias. Si alguien
    // vuelve a atar las copias a Tauri, falla aqui y no en la pantalla.
    expect(supportsBackups()).toBe(isPersistent());
  });

  test('sin motor de verdad no hay copias en ningun idioma', () => {
    // En el navegador sin Tauri los datos viven en `localStorage`, que no tiene
    // tablas. El texto tiene que decirlo por lo que falta —una base de datos—
    // y no por quien la puede leer, que es lo que decia antes y ya no era
    // cierto con el puente abierto.
    const sinBase = APP_LOCALE_VALUES.flatMap((locale) =>
      ['storage.desktopOnly', 'storage.backups.desktopOnly']
        .filter((clave) => {
          const texto = translate(locale, clave).toLowerCase();

          return (
            texto.includes('escritorio') ||
            texto.includes('desktop') ||
            texto.includes('bureau') ||
            texto.includes('ambiente de trabalho') ||
            texto.includes(' Arbeitsplatz')
          );
        })
        .map((clave) => `${locale}:${clave}`),
    );

    expect(sinBase).toEqual([]);
  });

  test('el aviso de las copias no habla de una carpeta que ya no existe', () => {
    // `storage.backups.keep` describia una carpeta `backups/` al lado de la base
    // de datos. Ese almacenamiento se cambio por la tabla `backups` y el texto
    // se quedo: un usuario que buscase sus copias ahi no las encontraria, y
    // pensaria que se habian perdido.
    const Wrong = APP_LOCALE_VALUES.flatMap((locale) => {
      const texto = translate(locale, 'storage.backups.keep').toLowerCase();

      const hablaDeCarpeta = ['carpeta', 'dossier', 'pasta', 'ordner'].some((p) =>
        texto.includes(p),
      );

      return hablaDeCarpeta ? [`${locale}:storage.backups.keep`] : [];
    });

    expect(Wrong).toEqual([]);
  });
});