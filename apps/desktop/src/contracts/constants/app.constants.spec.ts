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
 * vigilancia se desincroniza sin ruido — el后果uencia es que la app se
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