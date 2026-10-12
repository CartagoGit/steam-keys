import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lo que tienen que cumplir los desplegables y los selectores.
 *
 * No prueba que la interfaz se vea bien —eso no se puede medir leyendo el
 * codigo—; prueba que no se rompa de las formas que ya se han roto una vez.
 *
 * Por que leer el fuente y no renderizar. No hay `happy-dom` ni
 * `testing-library` en el proyecto, y anadirlos para unas comprobaciones de
 * estructura sale mas caro que el fallo que previenen. El resto de guardas del
 * proyecto (`no-spanish-in-ui`, `no-dead-code`, `no-inline-sql`) leen el fuente
 * igual, asi que esto no introduce una manera nueva de probar: usa la que ya
 * hay.
 *
 * **Se comparan los ficheros sin comentarios**, y no por casualidad. La
 * primera version de esta guarda busco `overflow-y-auto` en el desplegable de
 * filtros y lo encontro — en el parrafo que explica que ese scrool se habia
 * quitado. Los tres tests fallaban contra la propia documentacion: un guard que
 * se lee a si mismo no comprueba el codigo, comprueba que el codigo hable de
 * lo que el guard busca.
 *
 * Lo que se comprueba, y por que:
 *
 * - **Un solo scroll.** El panel se desplazaba y ademas su contenido tambien:
 *   dos barras de scroll a la vez en el mismo menu. Es el fallo mas visible de
 *   los cuatro, y el mas facil de reintroducir: basta con volver a poner un
 *   `max-h-* overflow-y-auto` en la lista de dentro «para que no sea enorme».
 * - **El cierre se ve.** Con `if (!abierto) return null` el menu se
 *   teletransporta al abrir y desaparece de golpe al cerrar.
 * - **`role="option"` con caja.** Con `display: contents` el elemento no
 *   genera caja, `offsetTop` da 0 y el ajuste de scroll con teclado no hace
 *   nada.
 * - **Un solo `listbox`.** El panel del filtro lleva arriba el par «Ninguna /
 *   Todas» y abajo una nota, asi que no puede declararse lista.
 * - **Los selectores usan el componente comun.** Sin esto, cada uno vuelve a
 *   dibujarse por su cuenta y la pompa se pierde en el camino.
 */

const RAIZ = join(new URL('.', import.meta.url).pathname, '..');

/**
 * El fichero sin comentarios: bloque `/** ... *\/` y lineas `//`.
 *
 * Es lo que hay que comparar, porque un `overflow-y-auto` escrito en un
 * comentario no crea ninguna barra de scroll, pero haria fallar el test.
 */
function fuente(relativa: string): string {
  return readFileSync(join(RAIZ, relativa), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const POPOVER = fuente('components/popover.component.tsx');
const FILTRO = fuente('components/filter-menu.component.tsx');
const SELECTOR = fuente('components/segmented.component.tsx');
const VISTAS = fuente('components/view-switch.component.tsx');
const AJUSTES = fuente('components/settings-dialog.component.tsx');
const CSS = fuente('styles/index.css');

describe('desplegables', () => {
  test('el panel es el unico que se desplaza', () => {
    /**
     * Ni el filtro ni ningun otro pone su propio desplazamiento dentro.
     *
     * Se mira tambien `max-h-` seguido de `overflow`, que es como se
     * describia el problema: un `max-h-64 overflow-y-auto` en la lista de
     * opciones, con el panel desplazandose tambien.
     */
    expect(FILTRO).not.toMatch(/max-h-[\w[\]/.]+\s+overflow/);
    expect(FILTRO).not.toContain('overflow-y-auto');
    expect(FILTRO).not.toContain('overflow-auto');

    // El que se desplaza es el panel.
    expect(POPOVER).toContain('overflow-y-auto');
  });

  test('cerrar tambien se ve, no solo abrir', () => {
    /**
     * La salida tiene que existir y tener su propia animacion.
     *
     * Con una sola clase de animacion, abrir desliza el menu y cerrar lo
     * borra en el mismo fotograma: se ve el acierto pero no la respuesta, y el
     * programa parece que reacciona de golpe.
     */
    expect(CSS).toContain('@keyframes popover-in');
    expect(CSS).toContain('@keyframes popover-out');

    expect(POPOVER).toContain('animate-popover-in');
    expect(POPOVER).toContain('animate-popover-out');

    // El panel se desmonta al **terminar** la animacion, no al cerrarse.
    expect(POPOVER).toContain('onAnimationEnd');
    expect(POPOVER).toContain('terminarSalida');
  });

  test('la opcion resaltada tiene caja, para poder medirla', () => {
    /**
     * `display: contents` es el fallo silencioso del teclado.
     *
     * El panel ajusta el `scrollTop` leyendo `offsetTop` y `offsetHeight` de la
     * opcion resaltada. Un elemento con `display: contents` no genera caja, asi
     * que los dos valen 0, la comparacion es 0 contra 0 y el scroll no se
     * mueve. Con siete opciones no se nota; con veinte, bajar con las flechas
     * sale de la vista sin poder ver donde estas.
     */
    expect(POPOVER).not.toMatch(/['"]contents['"]/);

    // El rol va en el boton, que si es una caja.
    expect(POPOVER).toMatch(/role="option"[\s\S]{0,200}tabIndex/);
  });

  test('el panel del filtro no se declara lista', () => {
    /**
     * Lleva el par de arriba y la nota de abajo: no es una lista de opciones.
     *
     * Con `role="listbox"` ahi, el lector de pantalla anuncia «lista de N
     * elementos» y se encuentra con dos botones y un parrafo mas.
     */
    expect(FILTRO).toContain('esLista={false}');
  });

  test('la cabecera y el pie se quedan fijos al recorrer las opciones', () => {
    expect(FILTRO).toContain('sticky top-0');
    expect(FILTRO).toContain('sticky bottom-0');
  });
});

describe('selectores con pompa', () => {
  /**
   * El par de «todo» del desplegable y el selector de fuera, mismo componente.
   *
   * Eran dos botones con `aria-pressed` dentro del menu mientras fuera habia
   * una pompa que se desliza. Dos criterios para lo mismo en la misma pantalla.
   */
  test('el par de ninguna y todas usa el mismo selector que los de fuera', () => {
    expect(FILTRO).toContain('<Segmented');

    // El par conmutivo viejo, con los dos botones pintados a mano.
    expect(FILTRO).not.toContain('aria-pressed={todas}');
    expect(FILTRO).not.toContain('aria-pressed={todasTodas}');
  });

  /**
   * Que el selector de dentro y el de fuera hagan lo mismo no basta con que
   * usen el mismo componente: tiene que ser **el** componente con pompa, no
   * una variante sin ella.
   */
  test('el componente comun tiene pompa de verdad', () => {
    // Se mueve con `transform`, que es lo que la transicion nombra. Con
    // `left` habria un salto y ninguna animacion, que es como se rompio.
    expect(SELECTOR).toContain('translateX');
    expect(SELECTOR).toContain('transition: TRANSICION');
  });

  test('claves y mis juegos, y las pestanas de ajustes, usan el selector comun', () => {
    expect(VISTAS).toContain('<Segmented');
    expect(AJUSTES).toContain('<Segmented');

    // Ni un boton pulsable hecho a mano que se quede sin pompa.
    expect(VISTAS).not.toContain('aria-pressed');

    /**
     * En Ajustes solo se miran las pestanas, no los otros selectores: la
     * rejilla de temas y la de estados del dialogo en bloque son conjuntos de
     * tarjetas con su icono y su explicacion, no una fila de dos o tres
     * opciones. Una pompa en una rejilla de seis no significa nada, asi que
     * `aria-pressed` sigue siendo lo correcto ahi.
     */
    expect(AJUSTES).not.toContain('role="tab"');
  });

  /**
   * El selector se mide solo, asi que sus botones no pueden llevar el icono
   * metido dentro a mano: si el ancho lo midiera el boton entero, con el icono
   * dentro el texto se descuadra respecto a la pompa.
   */
  test('el icono entra por la prop, no dentro del boton', () => {
    expect(SELECTOR).toContain('icon?: IconName');
    expect(SELECTOR).toContain('option.icon');
  });
});