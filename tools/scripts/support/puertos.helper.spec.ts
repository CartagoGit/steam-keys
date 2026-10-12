import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUERTO_DEV, PUERTO_WEB, puertoVite } from './puertos.helper';

/**
 * Tests de los puertos de desarrollo.
 *
 * El test que importa de verdad es el ultimo. El puerto de Vite y el `devUrl`
 * de Tauri son dos ficheros que no se pueden enlazar entre si —uno es TypeScript
 * y el otro es JSON— pero tienen que decir lo mismo: si no, Tauri abre una
 * ventana en blanco y no hay ningun aviso en ninguna parte. El sintoma es
 * «la app no carga» y la causa esta a tres ficheros de distancia.
 *
 * Por eso los dos numeros estan aqui y el test compara. Si alguien cambia uno
 * y no el otro, esto falla en lugar de fallar en Tauri.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('los puertos de desarrollo', () => {
  test('dev y web usan puertos distintos', () => {
    // Si volvieran a coincidir, `web` no arrancaria con un `dev` vivo —con lo
    // que se puede perder de vista cual de los dos se esta usando.
    expect(PUERTO_DEV).not.toBe(PUERTO_WEB);
  });

  test('los dos puertos estan libres en el rango que el sistema permite', () => {
    for (const puerto of [PUERTO_DEV, PUERTO_WEB]) {
      expect(Number.isInteger(puerto)).toBe(true);
      expect(puerto).toBeGreaterThan(1023);
      expect(puerto).toBeLessThan(65536);
    }
  });

  describe('el puerto que le toca a Vite', () => {
    test('sin nada puesto, es el de dev', () => {
      expect(puertoVite()).toBe(PUERTO_DEV);
    });

    test('PUERTO_VITE manda, que es lo que usa el script de web', () => {
      const antes = process.env.PUERTO_VITE;
      process.env.PUERTO_VITE = String(PUERTO_WEB);

      try {
        expect(puertoVite()).toBe(PUERTO_WEB);
      } finally {
        if (antes === undefined) delete process.env.PUERTO_VITE;
        else process.env.PUERTO_VITE = antes;
      }
    });

    test('un valor que no es un puerto cae al de dev en vez de romper', () => {
      const antes = process.env.PUERTO_VITE;
      process.env.PUERTO_VITE = 'no-es-un-puerto';

      try {
        // Preferible a reventar: Vite no arrancaria con «port must be a
        // number» y sin ninguna pista de donde salio ese valor.
        expect(puertoVite()).toBe(PUERTO_DEV);
      } finally {
        if (antes === undefined) delete process.env.PUERTO_VITE;
        else process.env.PUERTO_VITE = antes;
      }
    });
  });

  test('el devUrl de Tauri apunta al mismo puerto que Vite', () => {
    const ruta = join(RAIZ, 'apps', 'desktop', 'src-tauri', 'tauri.conf.json');
    const conf = JSON.parse(readFileSync(ruta, 'utf8')) as {
      build: { devUrl: string };
    };

    expect(conf.build.devUrl).toBe(`http://127.0.0.1:${PUERTO_DEV}`);
  });

  test('el Vite de por defecto usa el puerto de dev', () => {
    // El `PUERTO_VITE` del entorno falsearia esta comprobacion, asi que se
    // lee el fichero y no el modulo: lo que importa es lo que dice el codigo.
    const ruta = join(RAIZ, 'apps', 'desktop', 'vite.config.ts');
    const codigo = readFileSync(ruta, 'utf8');

    expect(codigo).toContain('PUERTO_VITE');
    expect(codigo).toContain('puertoVite()');
  });
});