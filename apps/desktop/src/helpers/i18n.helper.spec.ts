import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  interpolate,
  pluralKey,
  translate,
} from './i18n.helper';
import { APP_LOCALE_VALUES, AppLocale, LOCALE_META, TRANSLATIONS } from '@/contracts';
import { baseKeys } from './i18n.helper';

/** Raiz de `src/`, para recorrer los ficheros que usan las claves. */
const RAIZ = `${import.meta.dir}/..`;

/** Raiz del repositorio, para llegar a `tools/scripts`. */
const REPO = `${RAIZ}/../../..`;

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

  test('ninguna clave esta muerta', async () => {
    // Una clave que nadie pinta es texto que hay que traducir a cinco idiomas,
    // mantener al dia y revisar, a cambio de nada. No se ve leyendo el
    // diccionario —la clave esta, y las pruebas de cobertura pasan— asi que
    // hace falta buscarla.
    //
    // Se buscan **todas** las apariciones de la clave como cadena en el codigo
    // de la app y de los scripts, y se descartan los propios diccionarios: las
    // claves aparecen en los cinco, y contarlas como uso es exactamente lo que
    // hacia que esto no encontrara nada.
    //
    // Asi aparecio `toast.*`: once claves duplicando `app.*`, que se quedaron
    // sin usar cuando se renombraron los avisos y nadie las boro.
    const DEFINEN = /contracts[\\/]constants[\\/]i18n.*\.constants\.ts$/;
    const GENERA = /tools[\\/]scripts[\\/]build-i18n\.py$/;

    const fuentes = [
      ...new Bun.Glob('**/*.{ts,tsx}').scanSync({ cwd: RAIZ }),
      ...new Bun.Glob('tools/scripts/**/*.{ts,tsx}').scanSync({ cwd: REPO }),
    ].filter((ruta) => !DEFINEN.test(ruta) && !GENERA.test(ruta));

    const codigo = await Promise.all(
      fuentes.map(async (ruta) => {
        const base = ruta.startsWith('tools/') ? REPO : RAIZ;

        return Bun.file(`${base}/${ruta}`).text();
      }),
    );

    // Sin ficheros leidos no se puede concluir nada: `every` sobre un array
    // vacio es `true` y el test daria todas las claves por muertas. Se avisa.
    expect(fuentes.length).toBeGreaterThan(50);

    /**
     * Prefijos cuyas claves se arman con una plantilla.
     *
     * `SteamError` no lleva el texto, lleva la clave, y la clave se construye
     * como ``steam.${error.codigo}``. Buscarla como cadena literal la hacia
     * parecer muerta a las doce, y la unica manera de que el test pasara era
     * declararlas excepcion — con lo que volverian a ser invisibles para
     * siempre, que es justo lo que este test existe para evitar.
     *
     * Se comprueba que el **prefijo** aparezca construida en algun sitio. Es
     * mas débil que buscar cada clave, pero es lo que se puede hacer sin
     * inventar un analizador: si alguien construye las claves de otra forma,
     * el prefijo desaparece del codigo y el test avisa.
     */
    const PREFIJOS_DINAMICOS: readonly (readonly [string, string])[] = [
      ['steam.', 'clave de un error de Steam'],
    ];

    const textos = codigo.join('\n');

    /** El prefijo solo vale si aparece construido de verdad en algun sitio. */
    const construidoEnElCodigo = (prefijo: string) =>
      textos.includes(`\`${prefijo}\${`);

    const muertas = baseKeys().filter((clave) => {
      const prefijo = PREFIJOS_DINAMICOS.find(([p]) => clave.startsWith(p))?.[0];

      if (prefijo !== undefined) return !construidoEnElCodigo(prefijo);

      return !textos.includes(`'${clave}'`);
    });

    expect(muertas).toEqual([]);
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
        // "Manual" es la misma palabra en los dos idiomas.
        'storage.reason.manual',
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
        // El filtro de etiquetas dice lo mismo que el panel de bulk, que es
        // `select.tags`, y por eso va con el. Y «Todas» es la misma palabra:
        // el menu de seleccion multiple necesita distinguirla de «Nenhuma».
        'filter.tags', 'filter.menu.all',
        'select.tags', 'select.groupOrganize', 'tags.title',
        // «Aplicar» es la misma palabra en los dos. Como `action.confirm` y
        // `action.edit`, que ya estaban.
        'action.apply',
        'editor.platform', 'editor.status', 'editor.note', 'editor.tags',
        'editor.titlePlaceholder', 'editor.keyPlaceholder',
        'editor.parentPlaceholder', 'editor.tagsPlaceholder',
        'import.title', 'row.forRecipient',
        'settings.title', 'settings.theme', 'settings.language', 'owned.dlc',
        // El portugues y el castellano comparten tambien estas del panel de
        // datos: "Restaurar", "App de escritorio" y "Restaurar {0}" son la
        // misma palabra en los dos idiomas, escrita igual.
        'storage.restore', 'storage.restoreTitle', 'storage.mode.desktop',
        // "Manual", "Antes de importar" y "Antes de restaurar" son la misma
        // palabra en los dos idiomas, escrita igual.
        'storage.reason.manual', 'storage.reason.beforeImport',
        'storage.reason.beforeRestore',
        // Cognado: en portugues se dice «cancelar» igual que en castellano. No
        // es un descuido de traduccion, es la palabra correcta.
        'loading.cancel',
      ],
      de: ['sort.alpha', 'editor.titlePlaceholder', 'editor.keyPlaceholder',
        'editor.parentPlaceholder', 'editor.tagsPlaceholder', 'owned.dlc',
        // Cognado: en alemán es «Alle» y en castellano «Todas». No es un
        // descuido, es la palabra correcta en las dos — y en un filtro de
        // seleccion multiple la otra, «sin marcar ninguna», seria peor,
        // porque «Alle» y «Keine» se distinguen de un vistazo.
        'filter.menu.all'],
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

  /**
   * Los nombres de idioma llevan su grafia, tilde y enye.
   *
   * Son **nombres propios**, no mensajes: no les aplica la regla de los textos
   * sin tildes que sigue el resto de la interfaz. Y escribirlos «Espanol»,
   * «Francais» o «Portugues» los hace parecer los nombres de unos paises que
   * no existen —«Portugues» sin tilde es un nombre de persona, no el idioma.
   *
   * El catalogo no es el sitio para comprobarlo: el guarda de castellano se
   * aplica a `components/` y a `app.component.tsx`, no a `contracts/`, asi que
   * aqui no miraba nadie.
   */
  test('los nombres de idioma van escritos como se escriben', () => {
    expect(LOCALE_META[AppLocale.Es].label).toBe('Español');
    expect(LOCALE_META[AppLocale.Fr].label).toBe('Français');
    expect(LOCALE_META[AppLocale.Pt].label).toBe('Português');

    // Y ninguno ha vuelto a la forma sin tilde.
    for (const [locale, meta] of Object.entries(LOCALE_META)) {
      expect(`${locale}:${meta.label}`).not.toMatch(/Espanol|Francais|Portugues|Ingles|Deutsch[a-z]/);
    }
  });

  /**
   * Cada bandera tiene su fichero, y el SVG es suyo y no de otro.
   *
   * La de Espana es la unica con tres bandas: rojo, amarillo y rojo. Se
   * comprueba por el color de las bandas y no por una foto del resultado,
   * porque lo que importa es que el fichero que se pinta sea el que dice el
   * codigo de barras —una bandera dibujada a ojo puede parecerse a otra y
   * seguir siendo la de otro pais—.
   *
   * Y el escudo va **centrado**: en la oficial esta en el centro y en el
   * astil, que es donde antes estaba, la bandera se leia como un manchon.
   */
  test('la bandera de espana son tres bandas con el escudo en el centro', () => {
    const bandera = readFileSync(join(RAIZ, '../public/flags/es.svg'), 'utf8');

    // Tres bandas, en la proporcion oficial 1:2:1 sobre 16 de alto.
    expect(bandera).toMatch(/<rect width="24" height="16" fill="#[a-f0-9]{6}"\/>/);
    expect(bandera).toMatch(/<rect y="4" width="24" height="8"/);

    // Y el escudo desplazado al centro de la bandera, no al astil.
    expect(bandera).toContain('<g transform="translate(12 0)">');

    // Las otras cuatro banderas no tienen por que parecerse a esta.
    for (const otro of ['en', 'fr', 'pt', 'de']) {
      const svg = readFileSync(join(RAIZ, `../public/flags/${otro}.svg`), 'utf8');

      expect(`${otro}:${svg.includes('translate(12 0)')}`).toBe(`${otro}:false`);
    }
  });

  test('ningun recuento lleva el numero escrito dentro', () => {
    // «1 seleccionada» con el uno pegado al texto no se puede pluralizar: si
    // el recuento cambia a dos, el texto sigue diciendo uno. Es la mitad del
    // motivo por el que existe `pluralKey()`, y la otra mitad es que el
    // numero escrito no se traduce — en arabe o en japones el uno se coloca
    // distinto y el texto queda mal escrito en cuanto se copia.
    //
    // Solo se miran las claves con su pareja `…Many`: las que son un numero
    // de otra cosa (un appId, un tamaño) no son un recuento.
    const cocidas: string[] = [];

    for (const clave of baseKeys()) {
      if (!clave.endsWith('One')) continue;

      const texto = TRANSLATIONS[AppLocale.Es][clave] ?? '';

      if (/\b[12]\s+\w/.test(texto)) cocidas.push(`${clave}: ${texto}`);
    }

    expect(cocidas).toEqual([]);
  });
});

describe('elegir la forma de un recuento', () => {
  test('uno toma el singular y el resto el plural', () => {
    expect(pluralKey(1, 'footer.countOne', 'footer.countMany')).toBe('footer.countOne');
    for (const cuenta of [0, 2, 3, 11, 21, 100, 1001]) {
      expect(pluralKey(cuenta, 'footer.countOne', 'footer.countMany')).toBe('footer.countMany');
    }
  });

  test('las dos formas de cada recuento existen en todos los idiomas', () => {
    // Un par a medias no da error de tipos —`TranslationKey` es `string`— pero
    // deja la pantalla mostrando «undefined».
    const pares: readonly [string, string][] = [
      ['footer.countOne', 'footer.countMany'],
      ['bulk.doneOne', 'bulk.doneMany'],
      ['storage.backups.keysOne', 'storage.backups.keysMany'],
    ];

    for (const [singular, plural] of pares) {
      for (const locale of APP_LOCALE_VALUES) {
        expect(TRANSLATIONS[locale][singular]).toBeTruthy();
        expect(TRANSLATIONS[locale][plural]).toBeTruthy();
      }
    }
  });

  test('«1 clave» sale en singular en los cinco idiomas', () => {
    // El fallo que motivaba el helper: con una sola clave salia «1 keys»,
    // y ninguna prueba lo detectaba porque el texto existia y era traducible.
    //
    // No se comprueba contra un literal por idioma —en ingles «1 key» es
    // justamente la forma buena— sino que las dos formas tienen que existir y
    // ser distintas. El helper elige la forma, no el numero: quien llama sigue
    // pasando el recuento a interpolar, y por eso se compara con el mismo
    // numero en las dos formas.
    for (const locale of APP_LOCALE_VALUES) {
      const uno = translate(locale, 'footer.countOne', [1, 9]);
      const varios = translate(locale, 'footer.countMany', [1, 9]);

      expect(uno).toContain('1');
      expect(varios).toContain('1');
      expect(uno).not.toBe(varios);

      // Y que el helper elige la que toca segun el numero que recibe.
      expect(translate(locale, pluralKey(1, 'footer.countOne', 'footer.countMany'), [1, 9])).toBe(uno);
      expect(translate(locale, pluralKey(3, 'footer.countOne', 'footer.countMany'), [1, 9])).toBe(varios);
    }
  });

  test('con filtro activo decide por el total, no por lo que se ve', () => {
    // El pie dice «1 de 200 claves» con un filtro puesto: si la forma la
    // eligiese `visible.length`, saldria «1 clave», que parece que solo hay una
    // en la coleccion. El singular es solo para cuando hay exactamente una.
    const conFiltro = translate(
      AppLocale.Es,
      pluralKey(200, 'footer.countOne', 'footer.countMany'),
      [1, 200],
    );
    expect(conFiltro).toBe(translate(AppLocale.Es, 'footer.countMany', [1, 200]));
    expect(conFiltro).toContain('1');
    expect(conFiltro).toContain('200');

    // Y sin filtro, una sola clave: ahi si el singular sin total.
    expect(
      translate(AppLocale.Es, pluralKey(1, 'footer.countOne', 'footer.countMany'), [1, 1]),
    ).toBe(translate(AppLocale.Es, 'footer.countOne', [1, 1]));
  });
});