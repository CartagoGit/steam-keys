import { describe, expect, test } from 'bun:test';

import { SteamError, resolveSteamId } from './steam.service';

describe('averiguar el ID de Steam', () => {
  // El numero de ejemplo es el del perfil publico de Valve, no el de ninguna
  // persona: un test que depende de la cuenta de alguien se rompe si esa
  // persona renombra el perfil, y ademas pone un nombre real en el historial de
  // git sin querer.
  const ID_DE_EJEMPLO = '76561197960287930';

  test('un numero de 17 cifras se acepta tal cual', async () => {
    expect(await resolveSteamId(ID_DE_EJEMPLO)).toBe(ID_DE_EJEMPLO);
  });

  test('los espacios alrededor no estorban', async () => {
    expect(await resolveSteamId(`  ${ID_DE_EJEMPLO}  `)).toBe(ID_DE_EJEMPLO);
  });

  test('un SteamID de 32 digitos se pasa sin tocar', async () => {
    const id32 = '79614873091234567890123456789012';

    expect(await resolveSteamId(id32)).toBe(id32);
  });

  /**
   * Se comprueba el **codigo**, no el texto.
   *
   * El mensaje del error es ahora la clave de traduccion —`steam.idInvalido`—
   * y el texto sale al final, en el idioma que este la interfaz. Mirar el texto
   * seria atar el test a una traduccion; el codigo es lo que decide **que**
   * pasa, y eso es lo que hay que fijar.
   */
  async function codigoDe(promise: Promise<unknown>): Promise<string> {
    try {
      await promise;
    } catch (error) {
      if (error instanceof SteamError) return error.codigo;

      throw error;
    }

    throw new Error('se esperaba un SteamError y no llego ninguno');
  }

  test('algo que no es ni ID ni nombre da un error legible', async () => {
    // No se llega a hacer ninguna peticion: se rechaza antes, y sin red.
    expect(await codigoDe(resolveSteamId('no es un id!!'))).toBe('idInvalido');
  });

  test('un nombre con espacios de mas se limpia antes de buscarlo', async () => {
    await expect(resolveSteamId('   ')).rejects.toThrow();
  });

  test('un texto sin forma de ID se rechaza sin llamar a nadie', async () => {
    expect(await codigoDe(resolveSteamId('a b c'))).toBe('idInvalido');
  });

  test('el mensaje del error es la clave, no un texto en castellano', async () => {
    /**
     * Esta es la garantia que hace que el castellano no vuelva a colarse por
     * aqui: si alguien pinta el error sin pasar por el traductor, en pantalla
     * sale `steam.idInvalido` y se nota a la primera. Con el castellano dentro
     * de la clase —como estaba— era el ultimo sitio por el que entraba y no
     * habia forma de traducirlo, porque el texto ya venia hecho.
     */
    try {
      await resolveSteamId('no es un id!!');
    } catch (error) {
      expect((error as SteamError).message).toBe('steam.idInvalido');
      return;
    }

    throw new Error('se esperaba un SteamError');
  });
});
