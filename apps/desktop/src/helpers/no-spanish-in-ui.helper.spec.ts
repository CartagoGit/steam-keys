import { describe, expect, test } from 'bun:test';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { APP_LOCALE_VALUES, AppLocale, TRANSLATIONS } from '@/contracts';

/**
 * Que no se cuele texto en castellano dentro de los componentes.
 *
 * Los tests de cobertura miran los diccionarios: que las claves existan y que
 * esten traducidas. No miran el otro lado, que es donde estan los fallos de
 * verdad. Un componente puede usar el diccionario para casi todo y tener el
 * castellano escrito a mano en cuatro sitios; esa app pasa los tests de
 * cobertura y se ve medio en castellano, que es justo lo que se queja el
 * usuario.
 *
 * Aqui se lee el codigo y se busca castellano escrito donde se pinta.
 */

const RAIZ = join(new URL('.', import.meta.url).pathname, '..');

/** Todos los `.tsx` por debajo de un directorio. */
function componentes(dir: string): string[] {
  const salida: string[] = [];

  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);

    if (statSync(ruta).isDirectory()) salida.push(...componentes(ruta));
    else if (nombre.endsWith('.tsx')) salida.push(ruta);
  }

  return salida;
}

/**
 * Palabras que aparecen en castellano y casi nunca en codigo.
 *
 * Solo unas cuantas, y no una lista enorme: el objetivo es pillar texto de
 * interfaz, no prohibir el castellano en comentarios ni en identificadores.
 * Todas empiezan por mayuscula y en ningun idioma distinto del castellano
 * significan lo mismo, que es lo que las hace candidatas.
 *
 * **Por que hay mas ahora.** Con veinticuatro, el guard daba falsa confianza:
 * trece textos en castellano convivian con el en tres dialogos —la
 * previsualizacion de importacion, las etiquetas y el de regalar— y el test
 * pasaba porque ninguna de sus frases empezaba por una de las veinticuatro.
 * Un guard que solo ve una lista cerrada solo dice que nadie ha escrito esas
 * veinticuatro palabras.
 *
 * Cada vez que aparezca un texto nuevo, la palabra se anade aqui con el
 * comentario de **que pantalla** era. El coste de olvidarlo es que el
 * siguiente texto en castellano pasa sin que nadie entere.
 */
const SOSPECHOSAS = [
  'Cancelar',
  'Guardar',
  'Cerrar',
  'Aceptar',
  'Borrar',
  'Eliminar',
  'Buscar',
  'Sin determinar',
  'Sin seleccion',
  'No hay nada seleccionado',
  'Key actualizada',
  'Key anadida',
  'Key eliminada',
  'Clave eliminada',
  'Clave anadida',
  'Copias de seguridad',
  'Comprobando',
  'Importadas',
  'Exportadas',
  'Marcar como',
  'Sin guardar',
  'Cargando',
  'Restaurar',
  // El mensaje de confirmacion de borrado estaba entero escrito a mano:
  // `message={`Se eliminara "${title}" de tu coleccion…`}. No lo pilla una
  // palabra suelta porque el texto entero es una frase; anadido tal cual.
  'Se eliminara',
  'Se podria eliminar',

  // --- previsualizacion de importacion ---
  'Importar desde',
  'No hay ninguna clave nueva',
  'linea(s) sin interpretar',
  'Son lineas que el parser',
  'Antes de escribir se crea',

  // --- dialogo de etiquetas ---
  'Etiquetas',
  'Anadir',
  'Aplicar',
  'Todavia no hay etiquetas',
  'Las claves que no tengan la etiqueta',

  // --- dialogo de regalar ---
  'quien se lo has regalado',
  'Se guarda con cada clave',

  // --- errores de Steam, que llegan a pantalla a traves del dialogo de ajustes ---
  'Eso no parece un ID de Steam',
  'No se pudo consultar Steam',
  'No se pudo contactar con Steam',
  'No hay ningun perfil con el nombre',
  'No se pudo leer el ID del perfil',
  'Ese perfil ahora se llama',
  'La biblioteca vino vacia',
  'La clave de la API no es valida',
  'Steam no ha contestado',
  'Sincronizacion cancelada',
  'Steam respondio con el estado',
];

/**
 * Castellano que el detector tiene que ver aunque este en un `.ts`.
 *
 * En un `.ts` no hay etiquetas donde mirar, asi que la heuristica de
 * `esVisible` —que exige el texto pegado a un `>` o dentro de un atributo— no
 * sirve. Para los servicios se busca por **palabra**, dentro de una cadena: un
 * error de Steam se pinta tal cual llega, y todos van en castellano.
 */
const SOSPECHOSAS_DE_SERVICIO = SOSPECHOSAS.filter((palabra) =>
  [
    'No se pudo',
    'No hay ningun perfil',
    'No hay ninguna clave nueva',
    'La biblioteca vino vacia',
    'La clave de la API',
    'Steam no ha contestado',
    'Sincronizacion cancelada',
    'Steam respondio con el estado',
    'Eso no parece un ID',
    'Ese perfil ahora se llama',
    'Se guardara con',
    'Se eliminara',
    'Se podria eliminar',
    'Anadir',
    'Aplicar',
    'Etiquetas',
    'Guardar',
    'Cancelar',
    'Cerrar',
    'Eliminar',
    'Buscar',
    'Restaurar',
    'Cargando',
  ].includes(palabra),
);

/** Atributos cuyo valor es codigo, no texto de pantalla. */
const ATRIBUTOS_DE_CODIGO = new Set(['className', 'id', 'name', 'type', 'key', 'href', 'role']);

/** Helpers `.ts`, donde un texto tambien acaba en pantalla si alguien lo pinta. */
function helpers(): string[] {
  const salida: string[] = [];

  for (const nombre of readdirSync(join(RAIZ, 'helpers'))) {
    const ruta = join(RAIZ, 'helpers', nombre);

    if (statSync(ruta).isDirectory()) salida.push(...helpers());
    else if (nombre.endsWith('.ts') && !nombre.endsWith('.spec.ts')) salida.push(ruta);
  }

  return salida;
}

/**
 * Servicios `.ts`, donde pasa lo mismo que en los helpers.
 *
 * Un servicio devuelve el texto de un error y el componente lo pinta tal cual.
 * De ahi vinieron los ultimos castellano que se colaron: el mensaje de error
 * de la base, que se enseñas sin traducir cuando la excepcion no es un
 * `Error`.
 */
function servicios(): string[] {
  const salida: string[] = [];

  for (const nombre of readdirSync(join(RAIZ, 'services'))) {
    const ruta = join(RAIZ, 'services', nombre);

    if (statSync(ruta).isDirectory()) salida.push(...servicios());
    else if (nombre.endsWith('.ts') && !nombre.endsWith('.spec.ts')) salida.push(ruta);
  }

  return salida;
}

/** Quita comentarios, que describen el problema pero no lo causan. */
function sinComentariosDe(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Si el indice cae dentro de una cadena.
 *
 * Mirar el caracter anterior y el siguiente es suficiente para lo que se busca
 * aqui: las palabras sospechosas empiezan por mayuscula, y en el codigo de un
 * helper nunca son la primera letra de un identificador.
 */
function enCadena(codigo: string, indice: number): boolean {
  const antes = codigo.slice(0, indice);
  const comillas = (antes.match(/['"`]/g) ?? []).length;

  return comillas % 2 === 1;
}

/**
 * Comprueba si un texto es de verdad lo que se pinta.
 *
 * Se busca por **contexto** y no contando llaves, porque contar llaves sobre
 * TSX real se descuadra en cuanto hay una llave dentro de una cadena o de un
 * comentario, y a partir de ahi el detector se traga el resto del fichero sin
 * mirar nada. Un fallo silencioso asi es peor que no tener el test.
 *
 * Un texto se pinta si:
 * - va en el valor de un atributo que se ve (`title`, `label`, `placeholder`,
 *   `aria-label`), o
 * - va entre `>` y `<`, aunque el texto este partido en varias lineas y lo que
 *   siga sea una expresion (`>Cancelar\n {t('...')}`).
 */
function esVisible(antes: string, despues: string): boolean {
  const atributo = antes.match(/([\w-]+)\s*=\s*"\s*$/);

  if (atributo) return !ATRIBUTOS_DE_CODIGO.has(atributo[1] ?? '');

  // Delimitador de la izquierda: el ultimo `>` sin texto en medio.
  if (!/>\s*$/.test(antes)) return false;

  // Delimitador de la derecha: lo primero que venga, aunque haya un salto.
  return /^\s*[<{]/.test(despues);
}

/** Textos sospechosos que hay en un trozo de codigo, con su linea. */
function sospechososDe(codigo: string): string[] {
  // Los comentarios describen el problema, no lo causan.
  const sinComentarios = codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const hallados: string[] = [];

  for (const palabra of SOSPECHOSAS) {
    let i = sinComentarios.indexOf(palabra);

    while (i !== -1) {
      const antes = sinComentarios.slice(0, i);
      const despues = sinComentarios.slice(i + palabra.length);

      if (esVisible(antes, despues)) {
        const linea = antes.split('\n').length;

        hallados.push(`linea ${linea}: ${palabra}`);
      }

      i = sinComentarios.indexOf(palabra, i + palabra.length);
    }
  }

  return hallados;
}

function sospechosos(fichero: string): string[] {
  return sospechososDe(readFileSync(fichero, 'utf-8'));
}

describe('nada de castellano escrito a mano en la interfaz', () => {
  /**
   * `app.component.tsx` va aparte del recorrido por `components/`: no esta
   * dentro de ese directorio, y es el fichero con mas JSX del proyecto. Quedarse
   * fuera era el agujero por el que colaron cuatro textos, entre ellos
   * «Cargando la coleccion…» y el boton «Marcar caducadas», que solo se
   * veian en espanol.
   */
  const ficheros = [
    ...componentes(join(RAIZ, 'components')),
    join(RAIZ, 'app.component.tsx'),
  ];

  test('se ha encontrado alguna componente que revisar', () => {
    // Si el recorrido fallara, el test pasaria sin comprobar nada, que es la
    // peor forma de fallar.
    expect(ficheros.length).toBeGreaterThan(10);
    expect(ficheros).toContain(join(RAIZ, 'app.component.tsx'));
  });

  test('el detector ve un texto partido en varias lineas', () => {
    // Como esta de verdad: se abre la etiqueta en una linea y se cierra en la
    // siguiente. Sin comprobar esto, el test de abajo podria pasar sin mirar.
    const dePrueba = `<Button variant="ghost" onClick={cancelar}>Cancelar
            {t('action.cancel')}
          </Button>`;

    expect(sospechososDe(dePrueba)).toEqual(['linea 1: Cancelar']);
  });

  test('el detector ve el valor de un atributo', () => {
    expect(sospechososDe('<button title="Eliminar clave" />')).toEqual([
      'linea 1: Eliminar',
    ]);
  });

  test('el detector no mira donde no se pinta', () => {
    // Comentarios, claves de traduccion y clases de Tailwind no son texto de
    // pantalla. Darlos por buenos haria que el test chillara sin motivo.
    const falso = `// TODO: revisar el boton Cancelar
      <p className="Cancelar">{t('action.cancel')}</p>
      {t('footer.games')}
      {/* Cerrar */}`;

    expect(sospechososDe(falso)).toEqual([]);
  });

  test('ningun componente escribe castellano en pantalla', () => {
    const fallos = ficheros.flatMap((f) =>
      sospechosos(f).map((texto) => `${f.split('/').pop()} ${texto}`),
    );

    expect(fallos).toEqual([]);
  });

  test('ningun helper devuelve castellano al que se lo pinte', () => {
    // El recorrido anterior solo miraba `.tsx`. Un helper es un `.ts`, asi que
    // quedaba fuera **por construccion**, y sus textos se colaban igual: el
    // texto que devuelve acaba pintado por el componente que lo llama, y quien
    // lo ve es el usuario.
    //
    // Aqui el problema es distinto: en un `.ts` no hay etiquetas donde mirar, asi
    // que lo que se busca es el castellano que sale de una funcion, en una
    // cadena, y no en un identificador ni en un comentario.
    const fallos: string[] = [];

    for (const f of helpers()) {
      const codigo = sinComentariosDe(readFileSync(f, 'utf-8'));

      for (const palabra of SOSPECHOSAS) {
        let i = codigo.indexOf(palabra);

        while (i !== -1) {
          // Solo dentro de una cadena: un identificador o una clave de
          // traduccion no se pintan.
          if (enCadena(codigo, i)) {
            fallos.push(`${f.split('/').pop()} linea ${codigo.slice(0, i).split('\n').length}: ${palabra}`);
          }

          i = codigo.indexOf(palabra, i + palabra.length);
        }
      }
    }

    expect(fallos).toEqual([]);
  });

  test('ningun servicio devuelve castellano al que se lo pinte', () => {
    // El mismo criterio que los helpers: en un `.ts` no hay etiquetas, asi que
    // lo que se busca es el castellano dentro de una cadena. Un servicio es
    // donde vive el texto de los errores, y el componente lo enseña tal cual.
    //
    // Se usa la lista corta y no la grande porque la grande esta llena de
    // palabras que salen en el JSX —«Etiquetas», «Aplicar»— y en un servicio
    // serian falsos positivos.
    const fallos: string[] = [];

    for (const f of servicios()) {
      const codigo = sinComentariosDe(readFileSync(f, 'utf-8'));

      for (const palabra of SOSPECHOSAS_DE_SERVICIO) {
        let i = codigo.indexOf(palabra);

        while (i !== -1) {
          if (enCadena(codigo, i)) {
            fallos.push(`${f.split('/').pop()} linea ${codigo.slice(0, i).split('\n').length}: ${palabra}`);
          }

          i = codigo.indexOf(palabra, i + palabra.length);
        }
      }
    }

    expect(fallos).toEqual([]);
  });

  test('la plataforma sin nombre esta en los cinco idiomas', () => {
    // `platformLabel()` cae al castellano cuando la clave no existe. Con la
    // clave en todos, la lista de plataformas sale entera traducida.
    for (const locale of APP_LOCALE_VALUES) {
      expect(TRANSLATIONS[locale]['platform.unknown']).toBeTruthy();
    }

    expect(TRANSLATIONS[AppLocale.Es]['platform.unknown']).not.toBe(
      TRANSLATIONS[AppLocale.De]['platform.unknown'],
    );
  });
});