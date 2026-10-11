import { describe, expect, test } from 'bun:test';

import { DB_FILE_NAME, appConfigDir, databasePath, systemConfigDir } from './db-path.helper';

/**
 * Donde acaban los datos cuando se escriben desde la consola.
 *
 * La app los deja al lado del ejecutable, y eso lo decide Rust mirando donde
 * esta el binario. Los scripts de consola no pueden deducirlo, asi que miran
 * `dist/`. Si esto se equivoca, los scripts abren **otra** base de datos
 * distinta de la que usa la app: uno ve 403 claves y el otro ve cero, y el que
 * escribe borra las de verdad. Por eso hay tests.
 */

/** Corre el helper en un subproceso, porque el entorno ya esta fijado aqui. */
function conDirectorio(forzado: string): { dir: string; fichero: string } {
  const salida = Bun.spawnSync({
    cmd: [
      'bun',
      '-e',
      `import {appConfigDir, databasePath} from './tools/scripts/support/db-path.helper';
       console.log(appConfigDir());
       console.log(databasePath());`,
    ],
    env: { ...process.env, STEAM_KEYS_DATA_DIR: forzado },
  });

  const [dir, fichero] = salida.stdout.toString().trim().split('\n');

  return { dir: dir ?? '', fichero: fichero ?? '' };
}

describe('directorio de datos de los scripts', () => {
  test('el fichero se llama como el de la app', () => {
    // Si el nombre cambiara en un sitio y no en el otro, la app abriria un
    // fichero vacio en cada arranque.
    expect(databasePath().endsWith(DB_FILE_NAME)).toBe(true);
    expect(databasePath()).toBe(`${appConfigDir()}/${DB_FILE_NAME}`);
  });

  test('mira en dist, que es donde deja el ejecutable la compilacion', () => {
    expect(appConfigDir().endsWith('dist')).toBe(true);
  });

  test('la variable de entorno manda sobre todo', () => {
    // Para trabajar sobre otra copia sin tocar la de verdad. Se prueba en un
    // subproceso porque aqui el entorno ya quedo fijado al arrancar el test.
    const { dir, fichero } = conDirectorio('/mnt/usb/steam-keys');

    expect(dir).toBe('/mnt/usb/steam-keys');
    expect(fichero).toBe(`/mnt/usb/steam-keys/${DB_FILE_NAME}`);
  });

  test('una ruta relativa tambien se resuelve a absoluta', () => {
    // Sin esto, `STEAM_KEYS_DATA_DIR=./prueba` se interpretaria respecto al
    // directorio desde el que se lanzase el script, que no siempre es el
    // repositorio.
    const { dir } = conDirectorio('./prueba');

    expect(dir.startsWith('/')).toBe(true);
    expect(dir.endsWith('/prueba')).toBe(true);
  });

  test('el directorio del sistema lleva el identificador de la app', () => {
    // Es el modo de reserva, para cuando el ejecutable esta en un sitio sin
    // permisos de escritura. No se mira mucho, pero tiene que existir.
    expect(systemConfigDir()).toContain('com.relaxingcup.steamkeys');
  });
});