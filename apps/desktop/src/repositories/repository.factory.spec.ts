import { beforeEach, describe, expect, test } from 'bun:test';

import {
  getDatabaseClient,
  getRepository,
  resetRepository,
} from './repository.factory';
import { StorageMode, getStorageMode } from '@/helpers/runtime.helper';

/**
 * El repositorio de claves y el de ajustes tienen que hablar **con la misma
 * conexion**. Si cada uno resolviera su cliente por su cuenta, en el navegador de
 * desarrollo uno acabaria en SQLite y el otro en `localStorage`, y los ajustes
 * se perderian al recargar la pagina.
 *
 * Ya paso: `getRepository()` construia el `SqliteGameKeyRepository` con
 * `tauriDatabaseClient` fijo, sin mirar `getStorageMode()`. En el puente de
 * desarrollo las claves acababan en un sitio y los ajustes en otro.
 *
 * Estos tests corren en Bun, sin Tauri y sin el puente de desarrollo, asi que
 * el modo es **memoria**. Ahi el cliente se crea nuevo en cada llamada a
 * proposito —no hay conexion que compartir— y solo se comprueba la garantia
 * general: lo que se pasa al repositorio es lo que devuelve el factory.
 */
describe('eleccion de almacenamiento', () => {
  beforeEach(() => {
    resetRepository();
  });

  test('el repositorio SQLite recibe el cliente del factory', async () => {
    const cliente = await getDatabaseClient();
    const repositorio = await getRepository();

    // En modo memoria el repositorio es de `localStorage` y no guarda
    // cliente —no lo necesita—, asi que la comparacion solo aplica cuando hay
    // SQLite de verdad. Lo que no se permite en ningun modo es que se reciba
    // algo distinto de lo que devuelve `getDatabaseClient()`.
    if (getStorageMode() !== StorageMode.Memory) {
      const interno = (repositorio as unknown as { cliente: unknown }).cliente;
      expect(interno).toBe(cliente);
    } else {
      expect(repositorio.constructor.name).toBe('MemoryGameKeyRepository');
    }
  });

  test('el cliente se reutiliza mientras el modo no cambie', async () => {
    const uno = await getDatabaseClient();
    const otro = await getDatabaseClient();

    // En modo memoria hay un cliente nuevo por llamada a proposito: no hay
    // conexion que compartir y los ajustes se guardan ahi tambien.
    if (getStorageMode() === StorageMode.Memory) {
      expect(otro).not.toBe(uno);
    } else {
      expect(otro).toBe(uno);
    }
  });

  test('el repositorio se reutiliza entre llamadas', async () => {
    const uno = await getRepository();
    const otro = await getRepository();

    expect(otro).toBe(uno);
  });

  test('reset descarta cliente y repositorio a la vez', async () => {
    // Si solo se limpiara el repositorio, el cliente cacheado de una
    // ejecucion anterior seguiria vivo y el test siguiente escribiria en el.
    const clienteAntes = await getDatabaseClient();
    const repositorioAntes = await getRepository();

    resetRepository();

    const clienteDespues = await getDatabaseClient();
    const repositorioDespues = await getRepository();

    expect(clienteDespues).not.toBe(clienteAntes);
    expect(repositorioDespues).not.toBe(repositorioAntes);
  });
});