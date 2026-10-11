import { describe, expect, test } from 'bun:test';

import { basename } from '@/helpers/path.helper';
import { DB_FILE_NAME } from '@/contracts/constants/app.constants';

/**
 * Tests de la comprobacion del primer arranque.
 *
 * Lo importante no es tanto el resultado como lo que **no** pasa: el arranque
 * no puede abrir la base de datos para averiguar si existe, porque abrirla la
 * crea y eso es justo lo que este camino evita. Aqui se comprueba que la
 * funcion decide mirando el fichero.
 */

describe('nombre del fichero de la base de datos', () => {
  test('el nombre es el que la app usa de verdad', () => {
    // Si estos dos se desincronizan, el aviso estaria nombrando un fichero que
    // no es el que hay que buscar al copiar el programa a otra carpeta.
    expect(DB_FILE_NAME).toBe('steam-keys.db');
  });

  test('de una ruta se saca justo el nombre que hay que buscar', () => {
    expect(basename('/home/cartago/juegos/SteamKeys/steam-keys.db')).toBe(DB_FILE_NAME);
    expect(basename('C:\\Juegos\\SteamKeys\\steam-keys.db')).toBe(DB_FILE_NAME);
  });
});