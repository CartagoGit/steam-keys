import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { APP_IDENTIFIER, APP_NAME } from './app.constants';

/**
 * `tauri.conf.json` manda.
 *
 * El identificador y el nombre del producto estan ahi porque es lo que Tauri
 * lee de verdad: es el que va al ejecutable, al registro de Windows y a la
 * carpeta de datos. Las constantes del front son una copia, y una copia sin
 * vigilancia se desincroniza sin ruido — ella consecuenciauencia es que la app se
 * instala con un identificador y escribe sus datos con otro.
 *
 * Que no se usen en el front es lo de menos: estan aqui justamente para poder
 * compararlas con la fuente.
 */

/** Raiz del repositorio: desde `apps/desktop/src/contracts/constants/`. */
const RAIZ = join(import.meta.dir, '../../../../..');

const CONF = join(RAIZ, 'apps/desktop/src-tauri/tauri.conf.json');

describe('la identidad de la app', () => {
  const config = JSON.parse(readFileSync(CONF, 'utf8')) as {
    productName: string;
    version: string;
    identifier: string;
  };

  test('el nombre coincide con el de Tauri', () => {
    expect(APP_NAME).toBe(config.productName);
  });

  test('el identificador coincide con el de Tauri', () => {
    expect(APP_IDENTIFIER).toBe(config.identifier);
  });

  test('el identificador tiene forma de dominio invertido', () => {
    // Tauri lo usa para el bundle de macOS y el registro de Windows. Un valor
    // con espacios o sin puntos produce un ejecutable que no se instala.
    expect(APP_IDENTIFIER).toMatch(/^[a-z0-9]+(\.[a-z0-9-]+)+$/);
  });

  test('la version del front es la de Tauri', () => {
    // Sin constante propia no hay nada que comparar: se lee del `package.json`,
    // que es donde la publica el gestor de paquetes.
    const pkg = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as {
      version: string;
    };

    expect(pkg.version).toBe(config.version);
  });
});

describe('la pantalla vacia', () => {
  const APP = readFileSync(
    join(RAIZ, 'apps/desktop/src/app.component.tsx'),
    'utf8',
  );

  /**
   * Los dos botones de la pantalla vacia abren algo.
   *
   * Es la primera pantalla que ve quien instala la app y la unica con dos
   * botones que no son filtros. Si «Importar» no abre el selector de ficheros
   * o «Anadir» no abre el editor, lo que queda es una pantalla con dos botones
   * que no hacen nada —que es como se veia: el texto estaba bien puesto y los
   * botones no tenian manejador—.
   *
   * Se comprueba que los dos reciben la accion **de verdad**, no una funcion
   * vacia: el fallo de este boton es silencioso, porque el texto y el aspecto
   * son correctos y lo unico que falta es la ultima linea.
   */
  test('importar y anadir estan cableados a la accion real', () => {
    expect(APP).toMatch(/<EmptyState[\s\S]{0,300}?onCreate=\{handleCreate\}/);
    expect(APP).toMatch(/<EmptyState[\s\S]{0,300}?onImport=\{handleImport\}/);

    // Y las dos acciones hacen algo de verdad, no solo existen.
    expect(APP).toMatch(/const handleCreate = \(\): void => \{[\s\S]{0,160}?setEditorOpen\(true\)/);

    /**
     * La ventana es de 1000 y no de 600 a proposito.
     *
     * `handleImport` tiene que pasar por el selector de ficheros nativo y
     * comprobar el resultado antes de abrir la previsualizacion, y con el
     * codigo y los comentarios que lleva eso ocupa mas de seiscientas
     * caracteres. Con una ventana mas corta el guard pasaria a fallar en
     * cuanto se anadiera un comentario, que es justo cuando no esta mirando
     * nadie: un guard que se rompe solo es peor que no tener guard.
     */
    expect(APP).toMatch(/const handleImport = async \(\): Promise<void> => \{[\s\S]{0,1000}?setStagedImport\(/);
  });
});