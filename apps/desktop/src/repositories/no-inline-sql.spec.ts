import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Que ninguna consulta SQL monte texto con datos dentro.
 *
 * Las claves y las notas son texto que escribe la persona —y tambien el TXT
 * importado—, asi que una consulta con `${valor}` en vez de `$1` es una vía
 * directa a ejecutar lo que haya en la base. En una app personal la stakes no
 * son altas, pero el fichero de la base es portable y se puede abrir en otro
 * equipo.
 *
 * El patron no puede ser «nada de `${}`»: los nombres de tabla y de columna
 * salen de constantes, y eso es correcto — SQLite no admite parametrizar un
 * identificador. Lo que no vale es meter **valores** en la cadena.
 */

/** Raiz de `src/`. */
const RAIZ = join(new URL('.', import.meta.url).pathname, '..');

/** Repositorio de la raiz, para llegar a `tools/scripts/`. */
const REPO = join(RAIZ, '../../..');

/**
 * Constantes que SÍ pueden interpolarse: son identificadores, no valores.
 *
 * Se listan a mano porque `TABLE_*` y los `*_COLUMNS` cambian de nombre cuando
 * cambia el esquema, y un prefijo broad (`TABLE_`) seria menos claro que la
 * lista. Un valor nuevo hay que añadirlo aqui a proposito.
 */
const IDENTIFICADORES = /^(TABLE_[A-Z_]+|GAME_KEY[A-Z_]*|[A-Z_]*_COLUMNS|SELECCION|COLUMNAS_[A-Z_]+|ES_[A-Z_]+|ASSIGN[A-Z_]*)$/;

/**
 * Los `?` que no son parametros.
 *
 * Una variable `*Placeholders` viene de `sqlPlaceholders()`, que devuelve
 * `$1, $2, $3` a partir del numero de filas. `cases` es lo mismo para el
 * `CASE WHEN`: genera `WHEN 1 THEN $4 WHEN 2 THEN $5` con numeros de fila, no
 * con datos. Ambas son el patron correcto para lo que SQLite no acepta con un
 * array, y en las dos los valores siguen yendo por parametro.
 *
 * Se reconocen por el nombre, no por una lista: el sufijo dice lo que hace, y
 * anadir un sitio mas de escritura masiva no deberia obligar a tocar el guard.
 */
const MARCADORES_GENERADOS = /placeholders$/i;

/** `cases` es lo mismo para el `CASE WHEN`. */
const CASOS = /^cases$/;

/** Como se detecta que un texto es una consulta y no un mensaje. */
const CONSULTA =
  /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE|PRAGMA)\b/;

/** Plantillas `` `…${algo}…` ``. */
const PLANTILLA = /`([^`]*)`/g;

interface IFuente {
  ruta: string;
  codigo: string;
}

function fuentes(): IFuente[] {
  const salida: IFuente[] = [];

  const visitar = (dir: string, etiqueta: string): void => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);

      if (statSync(ruta).isDirectory()) visitar(ruta, etiqueta);
      else if (ruta.endsWith('.ts') && !ruta.endsWith('.spec.ts')) {
        salida.push({ ruta: `${etiqueta}/${nombre}`, codigo: readFileSync(ruta, 'utf8') });
      }
    }
  };

  visitar(join(RAIZ, 'repositories'), 'repositories');
  visitar(join(RAIZ, 'services'), 'services');
  visitar(join(RAIZ, 'contracts'), 'contracts');

  if (statSync(join(REPO, 'tools/scripts')).isDirectory()) {
    visitar(join(REPO, 'tools/scripts'), 'tools/scripts');
  }

  return salida;
}

/** Nombres que se interpolan dentro de una plantilla. */
function interpolados(plantilla: string): string[] {
  const salida: string[] = [];

  for (const m of plantilla.matchAll(/\$\{([^}]+)\}/g)) {
    const dentro = m[1];

    if (dentro === undefined) continue;

    // `${TABLA}.prefijo` y `${X}%` no son el nombre limpio.
    const nombre = dentro.split('.')[0]?.split('%')[0]?.trim() ?? '';

    if (nombre !== '') salida.push(nombre);
  }

  return salida;
}

describe('SQL parametrizado', () => {
  const todos = fuentes();

  test('las consultas no meten valores dentro del texto', () => {
    const sospechosos: string[] = [];

    for (const { ruta, codigo } of todos) {
      const sinComentarios = codigo
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      PLANTILLA.lastIndex = 0;

      let m: RegExpExecArray | null;

      while ((m = PLANTILLA.exec(sinComentarios)) !== null) {
        const cuerpo = m[1] ?? '';

        // No es una consulta: puede ser un mensaje o una ruta.
        if (CONSULTA.test(cuerpo) === false) continue;

        for (const nombre of interpolados(cuerpo)) {
          if (IDENTIFICADORES.test(nombre)) continue;

          // Los `IN (${placeholders})` llevan marcadores generados, no datos.
          if (MARCADORES_GENERADOS.test(nombre) || CASOS.test(nombre)) continue;

          sospechosos.push(`${ruta}: \${${nombre}} dentro de una consulta`);
        }
      }
    }

    expect(sospechosos).toEqual([]);
  });

  test('las consultas de la app usan parametros posicionales', () => {
    // `$1`, `$2`… es la unica forma que `tauri-plugin-sql` acepta. La otra es
    // `?` con `bind`, que obliga a pasar el array y se olvida en la mitad de
    // las llamadas.
    const sinParametros: string[] = [];

    for (const { ruta, codigo } of todos) {
      if (!ruta.startsWith('repositories') && !ruta.startsWith('services')) continue;

      for (const coincidencia of codigo.matchAll(/`([^`]*\b(?:WHERE|SET|VALUES)\b[^`]*)`/g)) {
        const consulta = coincidencia[1] ?? '';

        // `${placeholders}` y `${cases}` ya aportan sus propios `$1, $2…`.
        if (/\$\{[a-zA-Z_]*(?:placeholders|cases)\}/.test(consulta)) continue;

        if (/\$[1-9]/.test(consulta) || consulta.includes('?')) continue;

        // Un `SET col = col` de la propia sentencia, o un `WHERE` de texto.
        sinParametros.push(`${ruta}: ${consulta.replace(/\s+/g, ' ').slice(0, 70)}`);
      }
    }

    expect(sinParametros).toEqual([]);
  });
});