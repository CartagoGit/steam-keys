import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Que ningun `<button>` se quede sin `type`.
 *
 * Un boton sin `type` dentro de un `<form>` es de tipo `submit`. Hoy solo hay
 * un formulario en la app —el editor de claves— y ningun boton cae dentro, asi
 * que no hay ninguno que dispare el guardado por accidente. Pero el defecto es
 * invisible: depende de donde se ponga el boton, no de lo que parezca el boton.
 *
 * El fallo cuando se manifiesta es de los que se ven raro: el formulario se
 * envia, la pagina recarga y los cambios se pierden. En una app de escritorio
 * sin URL que recargar, ademas, deja la ventana en blanco.
 *
 * Poner `type="button"` por omision es la opcion segura; el que quiere enviar
 * pone `type="submit"` y se ve en el codigo.
 */

const RAIZ = join(new URL('.', import.meta.url).pathname, '..');

function componentes(): { ruta: string; codigo: string }[] {
  const salida: { ruta: string; codigo: string }[] = [];

  const visitar = (dir: string): void => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);

      if (statSync(ruta).isDirectory()) visitar(ruta);
      else if (ruta.endsWith('.tsx')) {
        salida.push({
          ruta: ruta.slice(`${RAIZ}/`.length),
          codigo: readFileSync(ruta, 'utf8'),
        });
      }
    }
  };

  visitar(RAIZ);

  return salida;
}

/** Quita los comentarios: un `<button` de ejemplo no es un boton. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Los atributos de una etiqueta JSX, desde `<button` hasta su `>` de cierre.
 *
 * Cuenta llaves y comillas para no salir antes de tiempo. Un patron del tipo
 * `<button([^>]*)>` se corta en el primer `>` que encuentra, y en JSX ese puede
 * ser el de una flecha —`onClick={() => f()}`— en la linea siguiente: el boton
 * sale como si no tuviera tipo cuando si lo tiene, y el guard deja de ser de
 * fiar. Por eso se lee caracter a caracter y no con un regex.
 *
 * Devuelve `null` si la etiqueta no se cierra.
 */
function atributosDe(codigo: string, desde: number): string | null {
  let llaves = 0;
  let comillas = '';

  for (let i = desde; i < codigo.length; i += 1) {
    const c = codigo[i] ?? '';

    if (comillas !== '') {
      if (c === comillas) comillas = '';
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      comillas = c;
      continue;
    }

    if (c === '{') llaves += 1;
    else if (c === '}') llaves -= 1;
    else if (c === '>' && llaves === 0) return codigo.slice(desde, i);
  }

  return null;
}

const todos = componentes();

describe('botones con tipo declarado', () => {
  test('ningun boton se queda sin type', () => {
    const sinTipo: string[] = [];

    for (const { ruta, codigo } of todos) {
      const limpio = sinComentarios(codigo);

      for (const m of limpio.matchAll(/<button\b/g)) {
        const atributos = atributosDe(limpio, m.index + '<button'.length);

        if (atributos === null) continue;
        if (/\btype\s*=/.test(atributos)) continue;

        sinTipo.push(`${ruta}:${limpio.slice(0, m.index).split('\n').length}`);
      }
    }

    expect(sinTipo).toEqual([]);
  });

  test('el editor de claves es el unico que pide un form', () => {
    // Un `<form>` sin `onSubmit` controlado recarga la pagina. Con el boton de
    // guardar marcado como `submit` y el `preventDefault` en el manejador, el
    // guardado va por JavaScript; sin lo uno de los dos, recarga.
    //
    // El `<form>` no esta escrito en el editor sino en `Modal`, con `as="form"`:
    // asi el editor hereda el Escape, la trampa de foco y la animacion de
    // salida, que antes no tenia porque montaba su propio fondo.
    //
    // Se excluye `modal.component.tsx`, que es donde vive la etiqueta y donde
    // la palabra aparece en el tipo de la prop.
    const piden = todos
      .filter(({ ruta }) => ruta !== 'components/modal.component.tsx')
      .filter(({ codigo }) => /<Modal[\s\S]{0,400}?as="form"/.test(codigo))
      .map((f) => f.ruta);

    expect(piden).toEqual(['components/key-editor.component.tsx']);
  });

  test('Modal declara el form y su onSubmit', () => {
    const modal = todos.find((f) => f.ruta === 'components/modal.component.tsx');

    expect(modal?.codigo).toContain('<form');
    expect(modal?.codigo).toContain('onSubmit');
  });

  test('el editor previene el envio por defecto', () => {
    // Complemento: `type="submit"` sin `preventDefault` recarga igual.
    const editor = todos.find((f) => f.ruta === 'components/key-editor.component.tsx');

    expect(editor).toBeDefined();
    expect(editor?.codigo).toContain('preventDefault');
  });
});