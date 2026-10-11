import { describe, expect, test } from 'bun:test';

import * as contratos from './index';
import * as constantes from './constants/index';
import * as enums from './enums/index';
import * as interfaces from './interfaces/index';

/**
 * Guardias de los contratos.
 *
 * Tres cosas que se rompen solas si nadie mira, y que aqui se comprueban:
 *
 * 1. Que el barril `@/contracts` exporta **lo mismo** que sus tres sub-barriles.
 *    Cuando le faltaba algo, lo unico que quedaba era importar por ruta
 *    profunda, y la regla de "los contratos se importan desde el barril" paso a
 *    ser una frase que el codigo incumplia en silencio.
 *
 * 2. Que ningun fichero de la app importe contratos por ruta profunda. Es la
 *    forma de que la regla se cumpla sola en vez de por costumbre.
 *
 * 3. Que el DDL y los nombres de tabla no se desincronicen.
 */

const SIN_CONTRACTS = /@\/contracts[^']*'/;
const RUTA_PROFUNDA = /@\/contracts\/(constants|enums|interfaces)\//;

/** Importar del barril, y solo del barril: `'@/contracts'`. */
const BARRIL_LIMPIO = /from '@\/contracts';/;

/** Carpeta que hay que recorrer: `apps/desktop/src`. */
const SRC = `${import.meta.dir}/..`;

/** Raiz del repositorio, dos niveles por encima de `src/contracts`. */
const REPO = `${SRC}/../../..`;

/** Los scripts de linea de comandos, que hablan con la misma base de datos. */
const TOOLS: readonly string[] = [
  ...new Bun.Glob('tools/scripts/**/*.ts').scanSync({ cwd: REPO }),
].sort();

/**
 * Ficheros de la app, ordenados, sin los del propio modulo de contratos.
 *
 * El modulo entero se excluye a proposito: los barrels hacen `export *` de si
 * mismos y los tests los comparan contra si mismos, asi que no son un caso que
 * pueda romperse.
 */
const FUENTES: readonly string[] = [...new Bun.Glob('**/*.ts').scanSync({ cwd: SRC })]
  .filter((ruta) => !ruta.startsWith('contracts/'))
  .filter((ruta) => !ruta.endsWith('.spec.ts'))
  .filter((ruta) => !ruta.endsWith('/index.ts'))
  .sort();

describe('el barril de contratos', () => {
  test('exporta todo lo que exportan sus tres sub-barriles', () => {
    const juntos = [
      ...Object.keys(constantes),
      ...Object.keys(enums),
      ...Object.keys(interfaces),
    ].sort();

    const desdeArriba = Object.keys(contratos).sort();

    // Los tipos no existen en tiempo de ejecucion, asi que aqui solo se
    // comprueban los valores. Los `export type` los cubre TypeScript.
    expect(desdeArriba).toEqual(juntos);
  });

  test('no exporta nada que no exista en los sub-barriles', () => {
    const Together = new Set([
      ...Object.keys(constantes),
      ...Object.keys(enums),
      ...Object.keys(interfaces),
    ]);

    const huerfan = Object.keys(contratos).filter((nombre) => !Together.has(nombre));

    expect(huerfan).toEqual([]);
  });
});

describe('los contratos se importan desde el barril', () => {
  test('ningun fichero importa contratos por ruta profunda', async () => {
    const culpables: string[] = [];

    for (const ruta of FUENTES) {
      const codigo = await Bun.file(`${SRC}/${ruta}`).text();

      if (RUTA_PROFUNDA.test(codigo)) culpables.push(ruta);
    }

    expect(culpables).toEqual([]);
  });

  test('y siempre por la raiz del barril, sin variantes', async () => {
    const derivados: string[] = [];

    for (const ruta of FUENTES) {
      const codigo = await Bun.file(`${SRC}/${ruta}`).text();

      // `@/contracts/index`, `@/contracts/` y `@/contracts` son el mismo modulo
      // escritos de tres maneras. Con tres formas, un `grep` por el barril
      // encuentra dos de las tres y da la impresion de que nadie importa de el.
      if (SIN_CONTRACTS.test(codigo) && !BARRIL_LIMPIO.test(codigo)) {
        derivados.push(ruta);
      }
    }

    expect(derivados).toEqual([]);
  });
  test('tampoco en los scripts de tools, que escriben SQL contra la misma base', async () => {
    // Los scripts de `tools/scripts/` llegan al codigo de la app por el alias
    // `@/`, que el `tsconfig.json` de la raiz ya declara para ellos. Durante
    // mucho tiempo fueron la excepcion: veintisiete imports por
    // `../../apps/desktop/src/...`, y un `import-txt.script.ts` que escribia su
    // propio `INSERT` y un `export-txt.script.ts` con su propio `SELECT` y su
    // propio mapeo de filas. Los dos habrian podido importar el repositorio y
    // no lo hacian, y a la app le anadia una columna sin que se enterara nadie.
    const culpables: string[] = [];

    for (const ruta of TOOLS) {
      const codigo = await Bun.file(`${REPO}/${ruta}`).text();

      if (codigo.includes('../../apps/desktop/')) culpables.push(ruta);
    }

    expect(culpables).toEqual([]);
  });});