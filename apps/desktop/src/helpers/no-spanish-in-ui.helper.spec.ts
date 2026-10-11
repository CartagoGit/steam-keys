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
];

/** Atributos cuyo valor es codigo, no texto de pantalla. */
const ATRIBUTOS_DE_CODIGO = new Set(['className', 'id', 'name', 'type', 'key', 'href', 'role']);

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
  const ficheros = componentes(join(RAIZ, 'components'));

  test('se ha encontrado alguna componente que revisar', () => {
    // Si el recorrido fallara, el test pasaria sin comprobar nada, que es la
    // peor forma de fallar.
    expect(ficheros.length).toBeGreaterThan(10);
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