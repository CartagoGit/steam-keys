import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MANEJADORES } from '../../tools/scripts/support/bridge-handlers';

/**
 * El cliente y el servidor tienen que hablar el mismo idioma.
 *
 * `MANEJADORES` cubre todas las operaciones porque es `BridgeHandlers`, y ese
 * tipo obliga a que esten todas y con la firma correcta: si falta una fila, el
 * objeto no lo cumple y no compila. Eso es lo que protege al **servidor**.
 *
 * Lo que no protege nadie es lo contrario: que el navegador pida una operacion
 * que el servidor no tiene. El contrato tipado deja que se escriba —`pedir` es
 * generica— y el fallo aparece al ejecutarla, en el navegador, con un 404 que
 * no senala ni el fichero ni la linea. Este guard lo ve antes.
 *
 * ## Que mira
 *
 * Las llamadas a `pedir('...')` en los repositorios HTTP, y las claves de
 * `MANEJADORES`. Los dos conjuntos tienen que ser el mismo.
 */

/** Raiz del repositorio. */
const RAIZ = join(import.meta.dir, '..', '..');

/** Repositorios del navegador que llaman al puente. */
const REPOSITORIOS = [
  'repositories/http-game-key.repository.ts',
  'repositories/http-settings.repository.ts',
  'repositories/http-backup.repository.ts',
];

describe('el puente: cliente y servidor hablan el mismo idioma', () => {
  const enElServidor = new Set(Object.keys(MANEJADORES));

  const enElCliente = new Set<string>();

  for (const relativo of REPOSITORIOS) {
    const codigo = readFileSync(
      join(RAIZ, 'apps/desktop/src', relativo),
      'utf8',
    );

    for (const coincidencia of codigo.matchAll(/pedir\(\s*'([^']+)'/g)) {
      enElCliente.add(coincidencia[1]);
    }
  }

  test('el cliente pide alguna operacion', () => {
    // Si este test falla, el grep de arriba dejo de encontrar llamadas y todo lo
    // de abajo estaria comprobando una lista vacia: un verde falso.
    expect(enElCliente.size).toBeGreaterThan(20);
  });

  test('el servidor tiene todas las operaciones que pide el cliente', () => {
    const faltantes = [...enElCliente].filter((nombre) => !enElServidor.has(nombre));

    expect(faltantes).toEqual([]);
  });

  test('al cliente no se le escapa ninguna operacion del servidor', () => {
    /*
     * Al reves de lo anterior: una fila en el servidor que nadie llama es
     * codigo que hay que mantener sin que nada lo use. Puede ser legitimo —una
     * operacion que se reserva para un caso raro—, asi que el fallo dice el
     * nombre en vez de fallar a ciegas.
     */
    const huerfanas = [...enElServidor].filter((nombre) => !enElCliente.has(nombre));

    expect(huerfanas).toEqual([]);
  });

  test('ninguna operacion lleva SQL dentro', () => {
    /*
     * La razon de existir del puente. El SQL vive en `apps/desktop/src`, en el
     * repositorio; aqui solo hay una delegacion.
     *
     * Se miran **las cadenas**, no el texto entero: un manejador tiene
     * `ctx.claves.insert(input)` en su fuente, y `insert` ahi es un metodo, no
     * una sentencia. Buscar la palabra suelta marcaria media tabla.
     */
    for (const [nombre, manejador] of Object.entries(MANEJADORES)) {
      const literales = manejador.toString().match(/(['"`])(?:(?!\1).)*\1/g) ?? [];

      for (const literal of literales) {
        expect(literal).not.toMatch(
          /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|BEGIN|COMMIT|ROLLBACK|CREATE\s+TABLE|PRAGMA)\b/i,
        );
      }

      // Y todos tienen que delegar en el contexto, no hacer otra cosa.
      expect(manejador.toString()).toMatch(/ctx\.|Promise\.resolve/);
      expect(nombre.length).toBeGreaterThan(0);
    }
  });

  test('no queda ninguna mencion al tunel de SQL', () => {
    /*
     * La forma de que esto vuelva a colarse sin que nadie se entere es que
     * alguien copie el cliente viejo y le ponga `?op=exec`. Las tres cosas que
     * lo sostenian tienen que haber desaparecido del codigo de la app.
     *
     * **Sin comentarios**, y por el mismo motivo que el guard del barril: el
     * contrato y el servidor explican en su documentacion lo que el tunel era,
     * y buscar la cadena entera los marcaria a ellos. Lo que se busca es codigo
     * que lo use, no texto que lo mencione.
     */
    const raices = [join(RAIZ, 'apps/desktop/src'), join(RAIZ, 'tools/scripts')];

    const hallazgos: string[] = [];

    for (const raiz of raices) {
      for (const ruta of new Bun.Glob('**/*.ts{,x}').scanSync({ cwd: raiz })) {
        if (ruta.endsWith('.spec.ts')) continue;

        const codigo = readFileSync(join(raiz, ruta), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '');

        if (/op=(exec|select)|dev-bridge-database|operationFrom/.test(codigo)) {
          hallazgos.push(ruta);
        }
      }
    }

    expect(hallazgos).toEqual([]);
  });
});