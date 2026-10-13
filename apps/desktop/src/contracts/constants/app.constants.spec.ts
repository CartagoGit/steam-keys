import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  APP_IDENTIFIER,
  APP_NAME,
  PERFIL_URL,
  PROYECTO_URL,
} from './app.constants';

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

describe('los enlaces del pie', () => {
  /**
   * El enlace del codigo tiene que ser el repositorio de verdad.
   *
   * Apuntaba a `cartagogit/steam-key`: en singular y en minusculas. GitHub
   * redirige los dos —no son dos repositorios, es el mismo— asi que el enlace
   * funcionaba y no se notaba. Lo que si es un fallo es el nombre, que es lo
   * que ve el visitante antes de pinchar: un boton que dice «el codigo» y
   * lleva a una direccion que no es la del proyecto.
   *
   * Se compara con `origin` y no contra una copia de la direccion: la copia es
   * justamente lo que se desincroniza. Las mayusculas tambien van, porque
   * `CartagoGit` y `cartagogit` son el mismo sitio pero no la misma direccion.
   */
  test('el enlace del codigo es el remoto de origen', () => {
    const config = readFileSync(join(RAIZ, '.git/config'), 'utf8');

    const url = config
      .split('\n')
      .map((linea) => linea.trim())
      .find((linea) => linea.startsWith('url ='))
      ?.slice('url ='.length)
      .trim();

    expect(url).toBeDefined();

    const remoto =
      url
        ?.replace(/^git@github\.com:/, 'https://github.com/')
        .replace(/\.git$/, '') ?? '';

    expect(PROYECTO_URL).toBe(remoto);
  });

  test('el enlace del perfil es una direccion entera', () => {
    // Lo de LinkedIn se dedujo del nombre y nadie lo ha confirmado. Al menos
    // que tenga forma de enlace completo, para que un cambio se note.
    expect(PERFIL_URL).toMatch(/^https:\/\/[a-z.]+\/in\/[a-z0-9-]+$/);
  });
});

describe('la pantalla vacia', () => {
  const APP = readFileSync(
    join(RAIZ, 'apps/desktop/src/app.component.tsx'),
    'utf8',
  );

  /**
   * Abrir el editor son ahora dos lineas dentro de `useModals`, no en el
   * componente: quien decide que clave se edita y si se abre es el hook, para
   * que el par no se pueda dejar a medias. El guard mira los dos ficheros
   * porque lo que vigila es que el boton llegue a la accion de verdad, no que
   * este en un sitio concreto.
   */
  const MODALS = readFileSync(
    join(RAIZ, 'apps/desktop/src/helpers/use-modals.helper.ts'),
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
    expect(APP).toMatch(/const handleCreate = \(\): void => openEditor\(\)/);

    expect(MODALS).toMatch(
      /const openEditor = useCallback\(\(entrada\?: IGameKey \| null\): void => \{[\s\S]{0,160}?setEditorAbierto\(true\)/,
    );

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
    expect(APP).toMatch(/const handleImport = async \(\): Promise<void> => \{[\s\S]{0,1000}?stageImport\(/);
  });
});