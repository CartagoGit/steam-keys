import { describe, expect, test } from 'bun:test';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Exportaciones que nadie usa.
 *
 * Sin esto, el codigo muerto se acumula sin ruido: un helper escrito para una
 * idea que luego se implemento de otra manera se queda, con sus tests, dando la
 * impresion de que trabaja. En esta app habia veinte, entre ellas una funcion
 * de emparejado con la biblioteca de Steam entera y sus cinco tests, que desde
 * hacia tiempo no llamaba nadie porque la pantalla resolvia lo mismo con una
 * comparacion de igualdad.
 *
 * Que se pueda fiar depende de **que se cuenta como uso**. Un nombre que solo
 * aparece en su declaracion y en el barril no lo usa nadie. Uno que aparece en
 * un `import`, en una llamada o como prop de JSX si.
 *
 * Lo que este guard NO puede ver, y por eso no lo declara muerto:
 * - **Interfaces y tipos**: se exportan a menudo para dejar escrito un
 *   contrato aunque el consumidor aun no exista.
 * - **Nombres de tres letras o menos**: `t` casa con media aplicacion.
 * - **Lo que se pasa por indireccion** (una funcion recibida como prop).
 */

const RAIZ = join(new URL('.', import.meta.url).pathname, '..');

interface IFuente {
  ruta: string;
  /** Sin comentarios: un nombre que solo aparece en uno no es un uso. */
  limpio: string;
  /** `true` si es un barril, donde los nombres son referencias y no codigo. */
  esBarril: boolean;
}

/** Todo el codigo de la app: `.ts` y `.tsx`, tests incluidos. */
function fuentes(): IFuente[] {
  const salida: IFuente[] = [];

  const visitar = (dir: string): void => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);

      if (statSync(ruta).isDirectory()) visitar(ruta);
      else if (ruta.endsWith('.ts') || ruta.endsWith('.tsx')) {
        const relativa = ruta.slice(`${RAIZ}/`.length);
        salida.push({
          ruta: relativa,
          limpio: readFileSync(ruta, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, ''),
          esBarril: relativa.endsWith('index.ts'),
        });
      }
    }
  };

  visitar(RAIZ);

  return salida;
}

/**
 * Declaraciones que exportan un valor con nombre.
 *
 * Una linea por declaracion. Los `export function` con la firma partida en
 * varias lineas no se detectan: preferible tolerar un falso negativo a montar
 * un analizador de AST dentro de un test.
 */
const DECLARA = /^\s*export\s+(?:async\s+)?(function|const|class)\s+([A-Za-z_$][\w$]*)/gm;

/**
 * Las mismas declaraciones, pero **sin `export`**.
 *
 * El `\s*` inicial y el grupo que empieza por `(?!\s*export)` de `DECLARA` son lo
 * que separa las dos listas: `DECLARA` exige `export` justo despues de los
 * espacios, y aqui se exige que **no** haya. Un `export` detras —`export default`,
 * `export { X }` en el barrel— no cuela porque el patrón exige un identificador
 * justo a continuacion.
 *
 * Sin el `(?!\s*export)` un nombre exportado se contaria dos veces, una por cada
 * lista, y el test privado lo daria por muerto.
 */
const PRIVADO =
  /^\s*(?!export\b)(?:async\s+)?(function|const|class)\s+([A-Za-z_$][\w$]*)/gm;

/**
 * Metodos de un objeto exportado.
 *
 * Antes esto era un agujero: el guard miraba `export function`, `export
 * const` y `export class`, y un metodo de un literal —`async getStoreApp(`,
 * `async search(`— no casa con ninguno de los tres. En `steam.service.ts`
 * se acumulaban tres metodos sin llamar, mas de cien lineas con la tienda
 * de Steam —precio, metacritic, resenas— escritas para una pantalla de
 * detalle que no llego a existir, y el guard en verde.
 *
 * Solo se miran los metodos del objeto **exportado**: un objeto local
 * puede pasarse entero a otra funcion, y ahi el patron `\bnombre\b` no
 * distingue una llamada de una propiedad.
 *
 * Se excluyen los nombres de tres letras o menos, por lo mismo que mas
 * arriba: `run` o `map` colisionarian con media aplicacion.
 */
const METODO = /^\s{2}(?:async\s+)?([A-Za-z_$][\w$]*)\s*[(<]/gm;

/** El nombre del objeto exportado al que pertenece el metodo, si lo hay. */
/**
 * Con anotacion de tipo opcional: `export const cliente: IDatabaseClient = {`
 * es tan normal como `export const cliente = {`, y sin el los tres
 * archivos que lo llevan quedaban fuera de la comprobacion entera.
 */
const EXPORTADO =
  /^\s*export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*\{/gm;

/**
 * Cuantas veces sale el nombre en el codigo, **sin contar su declaracion ni el
 * barril**.
 *
 * Un `export { X }` del indice es una referencia, no un uso: reexportar algo
 * que nadie llama deja igual de muerto al simbolo, pero con mas codigo alrededor.
 */
function usosFueraDeLaDeclaracion(nombre: string, en: readonly IFuente[]): number {
  const patron = new RegExp(`\\b${nombre}\\b`, 'g');

  return en.reduce((total, fuente) => {
    // El barril solo mueve el nombre de sitio; no lo llama nadie.
    if (fuente.esBarril) return total;

    const apariciones = (fuente.limpio.match(patron) ?? []).length;

    /**
     * Una aparicion es la propia declaracion.
     *
     * El `async` va aqui por una razcon concreta: sin el, el patron pedia
     * `export function X` donde el fuente pone `export async function X`,
     * no casaba, la declaracion se contaba como un uso y **todo** export
     * asincrono pasaba el guard sin comprobar. Once en el proyecto, entre
     * ellos `steamGet` y `resolveSteamId`.
     */
    const esSuPropiaDeclaracion = new RegExp(
      `export (?:async )?(?:const|function|class) ${nombre}\\b`,
    ).test(fuente.limpio)
      ? 1
      : 0;

    return total + apariciones - esSuPropiaDeclaracion;
  }, 0);
}

describe('codigo muerto', () => {
  const todos = fuentes();

  test('no hay constantes ni funciones exportadas sin usar', () => {
    const muertas: string[] = [];

    for (const fuente of todos) {
      if (fuente.esBarril) continue;

      DECLARA.lastIndex = 0;

      let encontrado: RegExpExecArray | null;

      while ((encontrado = DECLARA.exec(fuente.limpio)) !== null) {
        const tipo = encontrado[1];
        const nombre = encontrado[2];

        if (!nombre) continue;

        // Con tres letras o menos el patron `\\bnombre\\b` colisiona con media
        // aplicacion: `t` es la funcion de traduccion, no cualquier letra suelta.
        if (nombre.length <= 3) continue;

        // Un hook se llama desde JSX, donde aparece como `<useLocale>` y el
        // patron `\bnombre\b` no casa porque va pegado a la etiqueta. Es codigo
        // vivo y no hay forma de distinguirlo por el nombre: se acepta el
        // prefijo de React como senal de que hay un consumidor.
        if (nombre.startsWith('use') && tipo === 'function') continue;

        if (usosFueraDeLaDeclaracion(nombre, todos) === 0) {
          muertas.push(`${fuente.ruta}: ${nombre} (${tipo})`);
        }
      }
    }

    expect(muertas).toEqual([]);
  });

  /**
   * Metodos de un objeto exportado que no se llaman nunca.
   *
   * Van aparte del test anterior porque se cuentan de otra manera: el uso
   * tiene que ser `objeto.metodo` o `.metodo(`, no el nombre suelto. Un
   * metodo que solo se menciona en un comentario —los comentarios ya estan
   * fuera de `limpio`— o en el propio fichero sigue sin estar vivo.
   */
  test('no hay metodos de un objeto exportado sin usar', () => {
    const muertos: string[] = [];

    for (const fuente of todos) {
      if (fuente.esBarril) continue;

      EXPORTADO.lastIndex = 0;

      /**
       * **Todos** los objetos exportados del archivo, no solo el primero.
       *
       * Con un `exec` y ya, un archivo con dos objetos exportados solo
       * comprobaba el primero y los metodos del segundo pasaban sin mirar.
       * No lo hace hoy ninguno, pero nada lo impide y es justo el tipo de
       * agujero por el que este guard deja de servir sin que se note.
       */
      let objeto: RegExpExecArray | null;

      while ((objeto = EXPORTADO.exec(fuente.limpio)) !== null) {
        const nombre = objeto[1];

        if (!nombre) continue;

        const desde = objeto.index + objeto[0].length;

        /**
         * El objeto se cierra con su llave al principio de linea; los
         * metodos van indentados con dos espacios. Cortar en el cierre evita
         * que `METODO` se lleve por delante una funcion suelta de mas abajo.
         *
         * Si el cierre no aparece —llave indentada, o el objeto es lo
         * ultimo del archivo— el recorte llega al final. Se acepta: en ese
         * caso lo que se revisa de mas son metodos de otros objetos, que
         * tambien viven en objetos exportados y tambien harian falta
         * revisar. El error va en un sentido: codigo muerto que no se ve.
         */
        const hasta = fuente.limpio.indexOf('\n};', desde);
        const cuerpo = fuente.limpio.slice(
          desde,
          hasta < 0 ? undefined : hasta,
        );

        METODO.lastIndex = 0;

        let encontrado: RegExpExecArray | null;

        while ((encontrado = METODO.exec(cuerpo)) !== null) {
          const metodo = encontrado[1];

          if (!metodo) continue;

          if (metodo.length <= 3) continue;

          // `constructor`, `get x` y demas palabras reservadas no son la API
          // del objeto.
          if (metodo === 'constructor' || metodo === 'if' || metodo === 'for')
            continue;

          /**
           * Cuenta **cualquier** acceso por punto, no solo la llamada.
           *
           * Un metodo se puede usar como valor —`gameKeyService.repository`
           * que se pasa a otro sitio— y exigirle unos parentesis lo daria
           * por muerto. Aqui el error posible va en un sentido: que otro
           * objeto con un metodo del mismo nombre lo llame y este parezca
           * vivo. Eso solo puede hacer que el guard **no** vea codigo
           * muerto, nunca que se queje de algo que si se usa, que es la
           * direccion en la que conviene equivocarse.
           */
          const acceso = new RegExp(`\\.${metodo}\\b`);

          const usos = todos.reduce(
            (total, f) =>
              total +
              (f.esBarril ? 0 : (f.limpio.match(acceso) ?? []).length),
            0,
          );

          if (usos === 0) {
            muertos.push(`${fuente.ruta}: ${nombre}.${metodo}`);
          }
        }
      }
    }

    expect(muertos).toEqual([]);
  });

  /**
   * Declaraciones **sin exportar** que no se usan ni en su fichero.
   *
   * Los dos tests anteriores solo miran lo exportado, asi que todo lo privado
   * se les escapaba. No es teoria: al reescribir `segmented.component.tsx` se
   * dejaron un mapa de glifos y su funcion, con la prop `icon` que los alimentaba,
   * y los tres se Cairon el guard en verde porque no uno solo se exporta. El
   * boton no llevaba icono desde antes: el codigo estaba muerto desde el primer dia
   * y solo habia que mirar el fichero para verlo.
   *
   * Solo se comprueba el **ambito del modulo**, no el de bloque: dentro de una
   * funcion, un `const` declarado justo ahi y usado dos lineas mas abajo cuesta
   * mas de medir que de mantener, y los que sobran los ense\u00f1a el compilador.
   */
  test('no hay constantes ni funciones privadas sin usar', () => {
    const muertas: string[] = [];

    for (const fuente of todos) {
      if (fuente.esBarril) continue;

      PRIVADO.lastIndex = 0;

      let encontrado: RegExpExecArray | null;

      while ((encontrado = PRIVADO.exec(fuente.limpio)) !== null) {
        const nombre = encontrado[2];

        if (!nombre) continue;

        // Igual que mas arriba: `t`, `id` y `map` colisionarian con todo.
        if (nombre.length <= 3) continue;

        const patron = new RegExp(`\\b${nombre}\\b`, 'g');

        /**
         * Una aparicion es la propia declaracion; el resto son usos. Se cuenta
         * **dentro del mismo fichero**: lo privado no se puede usar fuera, asi que
         * buscarlo en la aplicacion entera solo daria falsos positivos por nombres
         * repetidos.
         */
        const usos = (fuente.limpio.match(patron) ?? []).length;

        if (usos <= 1) muertas.push(`${fuente.ruta}: ${nombre}`);
      }
    }

    expect(muertas).toEqual([]);
  });

  test('los barrels no reexportan nada que ya no exista', () => {
    const rotos: string[] = [];

    for (const fuente of todos) {
      if (!fuente.esBarril) continue;
      if (!/^export\s*\{/m.test(fuente.limpio)) continue;

      for (const [, nombre] of fuente.limpio.matchAll(/^\s*([A-Za-z_$][\w$]*),?$/gm)) {
        if (!nombre) continue;

        const existe = todos.some(
          (otro) =>
            !otro.esBarril &&
            new RegExp(
              `export (?:const|function|class|interface|type|enum) ${nombre}\\b`,
            ).test(otro.limpio),
        );

        if (!existe) rotos.push(`${fuente.ruta}: ${nombre}`);
      }
    }

    expect(rotos).toEqual([]);
  });
});