import { beforeEach, describe, expect, test } from 'bun:test';

import {
  AppView,
  KeyKind,
  KeyScope,
  TABLE_APP_SETTINGS,
  type IAppSettings,
} from '@/contracts';
import { memoryDatabaseClient } from '@/repositories/memory-database.client';
import { resetRepository } from '@/repositories/repository.factory';
import { setManyStatement } from '@/repositories/sqlite-settings.repository';
import { settingsService } from '@/services/settings.service';

/**
 * Guardar varios ajustes: una sentencia, y todos los valores dentro.
 *
 * Guardar es lo que mas se hace —cada vez que se toca un filtro se escriben el
 * ambito, el tipo y la vista— y eran tres viajes para escribir tres celdas de
 * una tabla de tres filas.
 *
 * Y hay una segunda cosa, mas importante: **la sentencia lleva los tres
 * valores**, no solo el primero. El cliente en memoria leia un unico par de
 * marcadores, de modo que se guardaba el ambito y se perdian el tipo y la
 * vista. En SQLite —donde la sentencia la ejecuta el motor— funcionaba, y en
 * el navegador no: el mismo cambio de filtro se guardaba a medias segun donde
 * se abriera la app, sin un solo error.
 *
 * Los tests corren en Bun sin `localStorage`, asi que se le da el almacen que
 * espera el cliente en memoria.
 */
describe('guardar varios ajustes', () => {
  let almacen: Record<string, string>;

  beforeEach(() => {
    almacen = {};

    /*
     * Asignacion y no `Object.defineProperty`.
     *
     * Con `defineProperty` y sin `writable`, la propiedad queda de solo lectura
     * para el resto del proceso: los specs que se ejecuten despues fallan al
     * sustituirla, y el fallo sale en el fichero de otro test, que es justo
     * donde mas cuesta de ver de donde viene.
     */
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (clave: string) => almacen[clave] ?? null,
      setItem: (clave: string, valor: string) => {
        almacen[clave] = valor;
      },
      removeItem: (clave: string) => {
        delete almacen[clave];
      },
    };

    resetRepository();
  });

  describe('la sentencia', () => {
    test('una fila son dos marcadores', () => {
      const sentencia = setManyStatement(1);

      expect(sentencia).toContain('VALUES ($1, $2)');
    });

    test('tres filas son seis marcadores, sin repetir', () => {
      const sentencia = setManyStatement(3);

      expect(sentencia).toContain('($1, $2), ($3, $4), ($5, $6)');
      expect(sentencia).toContain(TABLE_APP_SETTINGS);
    });

    test('los valores no van dentro del texto', () => {
      /*
       * El `no-inline-sql` deja pasar el nombre `placeholders` justamente porque
       * lo que va ahi dentro son marcadores. Si esto metiera un dato, el guard
       * lo veria en cuanto se escribiera la sentencia.
       */
      const sentencia = setManyStatement(2);

      expect(sentencia).not.toContain('available');
      expect(sentencia).not.toContain('undefined');
    });
  });

  describe('lo que llega a la base', () => {
    test('los tres ajustes se guardan, no solo el primero', async () => {
      await settingsService.setMany({
        lastScope: KeyScope.Available,
        lastKind: KeyKind.Dlc,
        lastView: AppView.Games,
      });

      const guardados = await settingsService.load();

      expect(guardados.lastScope).toBe(KeyScope.Available);
      expect(guardados.lastKind).toBe(KeyKind.Dlc);
      expect(guardados.lastView).toBe(AppView.Games);
    });

    test('un solo ajuste tambien se guarda', async () => {
      await settingsService.setMany({ lastScope: KeyScope.All });

      expect((await settingsService.load()).lastScope).toBe(KeyScope.All);
    });

    test('un parche vacio no deja nada a medias', async () => {
      const antes = Object.keys(almacen).length;

      await settingsService.setMany({});

      expect(Object.keys(almacen).length).toBe(antes);
    });

    test('un valor ausente no se escribe como si fuera undefined', async () => {
      /*
       * `Partial<IAppSettings>` admite `undefined`, y sin filtrarlo el `INSERT`
       * metia la cadena «undefined» en la tabla: una fila que existe y vale mas
       * de lo que deberia.
       */
      await settingsService.setMany({ lastScope: undefined });

      const guardados = await settingsService.load();

      // Lo que no se ha escrito se queda en el valor por defecto, no en texto.
      expect(guardados.lastScope).toBe(KeyScope.Available);
    });

    test('volver a guardar lo mismo deja los mismos valores', async () => {
      const patch: Partial<IAppSettings> = {
        lastScope: KeyScope.Available,
        lastView: AppView.Keys,
      };

      await settingsService.setMany(patch);
      await settingsService.setMany(patch);

      const guardados = await settingsService.load();

      expect(guardados.lastScope).toBe(KeyScope.Available);
      expect(guardados.lastView).toBe(AppView.Keys);
    });
  });

  test('el cliente en memoria guarda todos los pares, no solo el primero', async () => {
    /*
     * El fallo, comprobado en el lado que lo sufria y no en el que lo emitia:
     * la sentencia estaba bien, y lo que se perdia era el receptor. Se escribe
     * con `execute` a proposito, saltandose el servicio, porque lo que se
     * comprueba es que el cliente entienda una sentencia con varias filas —
     * que es lo que recibe desde que `setMany` las manda juntas.
     */
    const cliente = memoryDatabaseClient();

    await cliente.execute(setManyStatement(3), [
      'lastScope',
      KeyScope.Available,
      'lastKind',
      KeyKind.Dlc,
      'lastView',
      AppView.Games,
    ]);

    const guardados = await settingsService.load();

    expect(guardados.lastScope).toBe(KeyScope.Available);
    expect(guardados.lastKind).toBe(KeyKind.Dlc);
    expect(guardados.lastView).toBe(AppView.Games);
  });
});
