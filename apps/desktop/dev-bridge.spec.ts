import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DEV_TOKEN_GLOBAL,
  operacionDe,
  type IBridgeResponse,
} from './dev-bridge.contract';
import { sustituirToken } from './dev-bridge.vite-plugin';

/**
 * Tests del puente de desarrollo.
 *
 * Lo que se comprueba aqui es que el puente **atiende operaciones con nombre**
 * sobre una base de datos real de-temporal, y no que sepa ejecutar SQL.
 *
 * Antes estas pruebas mandaban sentencias sueltas y comprobaban que devolvian
 * filas. Ahora mandan `keys/list` y `keys/set-status`, que es lo unico que el
 * puente expone —y que el SQL que las ejecuta esta en `apps/desktop/src`, con
 * sus propias pruebas—.
 *
 * La razon de que siga habiendo un fichero de este tipo es la misma de antes: el
 * proceso del puente y su protocolo de linea son lo unico que no se puede
 * probar sin levantarlo. Que las consultas salgan bien lo prueban los tests
 * del repositorio.
 *
 * Ninguna clave real aparece en este fichero.
 */

/** Ruta al script del puente. */
const SCRIPT = join(
  import.meta.dir,
  '..',
  '..',
  'tools',
  'scripts',
  'dev-bridge.serve.ts',
);

/** Crea una base de datos aislada y vacia. */
function crearBdTemporal(): { ruta: string; limpiar: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'steam-keys-bridge-'));
  const ruta = join(dir, 'test.db');

  return { ruta, limpiar: () => rmSync(dir, { recursive: true, force: true }) };
}

/**
 * Ejecuta el puente en modo de una vez.
 *
 * El script lee `STEAM_KEYS_DB_PATH` para saber que fichero abrir, asi que
 * ningun test toca la base de datos real. Se invoca como proceso aparte, que es
 * exactamente lo que hara el middleware de Vite.
 */
async function ejecutarBridge(
  rutaBd: string,
  operacion: string,
  args?: unknown,
): Promise<IBridgeResponse> {
  const hijo = Bun.spawn(['bun', 'run', SCRIPT, operacion], {
    env: { ...process.env, STEAM_KEYS_DB_PATH: rutaBd },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (args !== undefined) hijo.stdin.write(JSON.stringify(args));

  // El stdin tiene que cerrarse, o el script se queda esperando la entrada.
  hijo.stdin.end();

  const salida = await new Response(hijo.stdout).text();
  const errores = await new Response(hijo.stderr).text();

  if (salida.length === 0) {
    return { ok: false, error: errores || 'El puente no contesto nada.' };
  }

  return JSON.parse(salida) as IBridgeResponse;
}

/**
 * Levanta el puente como worker y habla con el por su protocolo de linea.
 *
 * Es el modo que usa el servidor de desarrollo, y el unico que mantiene una
 * conexion abierta durante toda la sesion.
 */
function levantarWorker(rutaBd: string): {
  pedir: (operacion: string, args?: unknown) => Promise<IBridgeResponse>;
  cerrar: () => void;
} {
  const hijo = Bun.spawn(['bun', 'run', SCRIPT, '--server'], {
    env: { ...process.env, STEAM_KEYS_DB_PATH: rutaBd },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const esperas: ((linea: string) => void)[] = [];
  const decodificador = new TextDecoder();

  let acumulado = '';

  /*
   * La salida se parte a mano porque `hijo.stdout` de Bun es un
   * `ReadableStream`, no el `Readable` de Node, y `node:readline` no lo acepta.
   * El protocolo es de una linea por peticion, asi que partir por saltos de
   * linea es justo lo que hace falta.
   *
   * Y tiene que partir por lineas: los argumentos de una operacion pueden traer
   * saltos dentro —el texto de una nota, una etiqueta multilinea— y por eso el
   * puente los serializa dentro de un objeto en lugar de mandarlos sueltos.
   */
  void (async () => {
    for await (const trozo of hijo.stdout as unknown as AsyncIterable<Uint8Array>) {
      acumulado += decodificador.decode(trozo as Uint8Array, { stream: true });

      let corte = acumulado.indexOf('\n');

      while (corte !== -1) {
        const linea = acumulado.slice(0, corte);

        acumulado = acumulado.slice(corte + 1);
        esperas.shift()?.(linea);
        corte = acumulado.indexOf('\n');
      }
    }
  })();

  return {
    pedir(operacion, args) {
      return new Promise<IBridgeResponse>((cumplir) => {
        esperas.push((linea) => cumplir(JSON.parse(linea) as IBridgeResponse));

        hijo.stdin.write(`${JSON.stringify({ operacion, args: args ?? null })}\n`);
      });
    },
    cerrar() {
      hijo.kill();
    },
  };
}

describe('la operacion va en la ruta', () => {
  test('sale del path, y se lee de un vistazo', () => {
    // Esta es toda la gracia del cambio: `/keys/set-status` dice lo que hace,
    // y `?op=exec` con un UPDATE dentro no decia nada.
    expect(operacionDe('/__dev-bridge__/keys/set-status')).toBe('keys/set-status');
    expect(operacionDe('/__dev-bridge__/keys/list')).toBe('keys/list');
    expect(operacionDe('/__dev-bridge__/settings/load')).toBe('settings/load');
  });

  test('una ruta que no es del puente no es nuestra', () => {
    expect(operacionDe('/otra-cosa')).toBeNull();
    expect(operacionDe('/assets/index.js')).toBeNull();
  });

  test('sin nombre detras no hay operacion', () => {
    // `/__dev-bridge__` a secas no es una operacion, y devolver el prefijo
    // entero haria que el servidor buscara algo que no existe.
    expect(operacionDe('/__dev-bridge__')).toBeNull();
    expect(operacionDe('/__dev-bridge__/')).toBeNull();
  });

  test('una query suelta no cambia el nombre', () => {
    expect(operacionDe('/__dev-bridge__/keys/list?x=1')).toBe('keys/list');
  });
});

describe('el token llega al navegador', () => {
  const TOKEN = 'a1b2c3';

  test('el uso del identificador se sustituye por el token', () => {
    const codigo = `if (typeof ${DEV_TOKEN_GLOBAL} === 'string') return ${DEV_TOKEN_GLOBAL};`;

    expect(sustituirToken(codigo, TOKEN)).toBe(
      'if (typeof "a1b2c3" === \'string\') return "a1b2c3";',
    );
  });

  test('la definicion del contrato no se toca', () => {
    /*
     * Este es el fallo que dejo la pagina en blanco sin que nada fallara: al
     * sustituir a rajatabillo, el `'${DEV_TOKEN_GLOBAL}'` del contrato se
     * convertia en `""a1b2c3"`, que no es JavaScript. El navegador tiraba un
     * "Invalid or unexpected token" sin senalar el fichero, y lo unico que se
     * veia era la interfaz vacia.
     */
    const codigo = `export const DEV_TOKEN_GLOBAL = '${DEV_TOKEN_GLOBAL}';`;

    expect(sustituirToken(codigo, TOKEN)).toBe(codigo);
  });

  test('una mencion entre comillas —como en los comentarios— tampoco se toca', () => {
    // Los comentarios del codigo lo nombran siempre entre comillas invertidas.
    // Cambiarlo no daria error, pero ensuciaria el fichero servido sin ganar
    // nada, y Vite rehace el mapa de fuentes por cada byte que cambia.
    const codigo = `// el token es \`${DEV_TOKEN_GLOBAL}\`\nconst a = 1;`;

    expect(sustituirToken(codigo, TOKEN)).toBe(codigo);
  });

  test('un codigo que no lo menciona se queda igual', () => {
    const codigo = 'export const otro = 1;';

    expect(sustituirToken(codigo, TOKEN)).toBe(codigo);
  });
});

describe('el puente ejecuta operaciones con nombre', () => {
  test('insertar y listar son dos llamadas con nombre', async () => {
    const { ruta, limpiar } = crearBdTemporal();

    try {
      const insertada = await ejecutarBridge(ruta, 'keys/insert', {
        input: { title: 'Celeste', keyValue: 'MQ7RT-29XKL-ZPN84' },
      });

      expect(insertada.ok).toBe(true);
      expect((insertada.result as { title: string }).title).toBe('Celeste');

      const listado = await ejecutarBridge(ruta, 'keys/list');

      expect(listado.ok).toBe(true);
      expect(listado.result).toHaveLength(1);
    } finally {
      limpiar();
    }
  });

  test('una operacion que no existe devuelve la lista de las que si', async () => {
    const { ruta, limpiar } = crearBdTemporal();

    try {
      const datos = await ejecutarBridge(ruta, 'keys/explotar-todo');

      expect(datos.ok).toBe(false);
      // No «operacion desconocida» a secas: si el navegador pide algo que el
      // servidor no tiene, lo que hace falta ver es la lista.
      expect(datos.error).toContain('keys/list');
    } finally {
      limpiar();
    }
  });

  test('sin argumentos se responde sin adivinar', async () => {
    const { ruta, limpiar } = crearBdTemporal();

    try {
      // `keys/get` necesita un id. Sin el, el repositorio falla y el error sale
      // del servidor, que es donde esta escrito el SQL.
      const datos = await ejecutarBridge(ruta, 'keys/get');

      expect(datos.ok).toBe(false);
      expect(datos.error?.length ?? 0).toBeGreaterThan(0);
    } finally {
      limpiar();
    }
  });
});

describe('el worker del puente', () => {
  test('responde una linea por peticion y respeta el orden', async () => {
    const { ruta, limpiar } = crearBdTemporal();
    const worker = levantarWorker(ruta);

    try {
      // Sin `await` entre medias: si el orden se respetase por casualidad, este
      // test no lo diria. Van las tres seguidas y se comprueba que salen en el
      // orden en que se pidieron.
      const pendientes = [
        worker.pedir('keys/insert', { input: { title: 'A', keyValue: 'AAAAA-BBBBB-CCCCC' } }),
        worker.pedir('keys/insert', { input: { title: 'B', keyValue: 'DDDDD-EEEEE-FFFFF' } }),
        worker.pedir('keys/count'),
      ];

      const [primera, segunda, tercera] = await Promise.all(pendientes);

      expect(primera.ok).toBe(true);
      expect(segunda.ok).toBe(true);
      expect(tercera.result).toBe(2);
    } finally {
      worker.cerrar();
      limpiar();
    }
  });

  test('los argumentos con saltos de linea no parten la peticion', async () => {
    const { ruta, limpiar } = crearBdTemporal();
    const worker = levantarWorker(ruta);

    try {
      await worker.pedir('keys/insert', { input: { title: 'A', keyValue: 'AAAAA-BBBBB-CCCCC' } });

      // Una nota con tres lineas. Si el protocolo no metiera los argumentos
      // dentro de un objeto serializado, esto se leeria como tres peticiones y
      // el worker responderia a la segunda con «no hay peticion que responder».
      const conSalto = await worker.pedir('keys/insert', {
        input: {
          title: 'B',
          keyValue: 'DDDDD-EEEEE-FFFFF',
          note: 'primera\nsegunda\ntercera',
        },
      });

      expect(conSalto.ok).toBe(true);

      const listado = await worker.pedir('keys/list');
      const claves = listado.result as { note: string | null }[];

      expect(claves.find((clave) => clave.note !== null)?.note).toBe(
        'primera\nsegunda\ntercera',
      );
    } finally {
      worker.cerrar();
      limpiar();
    }
  });
});

describe('la transaccion del puente es de verdad una transaccion', () => {
  test('si una operacion falla, no queda nada a medias', async () => {
    const { ruta, limpiar } = crearBdTemporal();
    const worker = levantarWorker(ruta);

    try {
      await worker.pedir('keys/insert', { input: { title: 'A', keyValue: 'AAAAA-BBBBB-CCCCC' } });

      /*
       * `setTagsForKeys` con una asignacion que no existe no falla —se lo
       * traga—, asi que se usa una que si falla: una clave repetida. El indice
       * unico la rechaza, la escritura se deshace, y lo que tiene que comprobar
       * este test es que **la clave anterior sigue ahi**, no que la segunda
       * no llegara a escribirse.
       *
       * Es el mismo requisito que antes llevaba el tunel de SQL y que ahora es
       * gratis: por HTTP la transaccion ocurre entera dentro del servidor, sin
       * depender de que aguante la conexion abierta entre tres peticiones.
       */
      const fallida = await worker.pedir('keys/insert', {
        input: { title: 'Duplicada', keyValue: 'AAAAA-BBBBB-CCCCC' },
      });

      expect(fallida.ok).toBe(false);

      const listado = await worker.pedir('keys/list');

      expect(listado.result).toHaveLength(1);
    } finally {
      worker.cerrar();
      limpiar();
    }
  });
});