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
const BARRA = fuente('components/toolbar.component.tsx');
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
   * El icono entra por la prop, no dentro del boton.
   */
  test('el icono entra por la prop, no dentro del boton', () => {
    expect(SELECTOR).toContain('icon?: IconName');
    expect(SELECTOR).toContain('option.icon');
  });

  /**
   * El contador va en el tooltip, no en el texto del boton.
   *
   * Al meterlo en la etiqueta —`Claves (5)` en vez de `Claves`— el selector
   * crecio lo suficiente para que la fila de la cabecera se partiera en dos,
   * con el buscador bajar a su propia linea. El `flex-wrap` de ahi es
   * intencionado y esta documentado, asi que no se quita: lo que no puede
   * cambiar es cuanta anchura gasta el selector.
   *
   * El contador se ve igual, pero donde corresponde: al pasar por encima.
   */
  test('el contador de la vista no ensancha la etiqueta', () => {
    // El texto del boton es el nombre pelado.
    expect(VISTAS).toContain("label: t('view.keys')");
    expect(VISTAS).toContain("label: t('view.games')");

    // Y el numero va por separado, en el tooltip.
    expect(VISTAS).toContain('title:');
    expect(VISTAS).toContain('${claves}');
    expect(VISTAS).toContain('${cuenta.juegos}');

    // `Segmented` tiene que admitir un tooltip propio por opcion para eso.
    expect(SELECTOR).toContain('title?: string');
    expect(SELECTOR).toContain('option.title');
  });

  /**
   * «Claves / Mis juegos», rectas. Los filtros, redondeadas.
   *
   * Una capsula casi redonda en un selector de palabras dobla tanto el borde que
   * no se ve donde empieza el boton. Los filtros si son etiquetas, y su forma
   * de pastilla es lo que los distingue a primera vista.
   *
   * Solo se mira el selector de vistas porque es el unico que se pidio recto.
   * Las pestanas de Ajustes se dejan redondeadas: tambien son palabras, pero
   * cambiar su forma sin haberlo pedido seria rehacer algo que no ha molestado.
   */
  test('el selector de vistas va recto y los filtros redondeados', () => {
    expect(VISTAS).toContain('forma="recta"');

    // Los filtros de la barra no lo dicen, asi que se quedan con la redonda.
    expect(BARRA).not.toContain('forma="recta"');

    // Y el componente tiene que ofrecer las dos formas de verdad.
    expect(SELECTOR).toContain('CURVAS');
    expect(SELECTOR).toContain("redonda: 'rounded-full'");
    expect(SELECTOR).toContain("recta: 'rounded-md'");

    // Y la forma se aplica a los tres sitios: pista, pompa y botones. Si la
    // pompa se quedase redondeada sobre una pista recta se ve el desconcierto.
    const usosDeCurva = (SELECTOR.match(/curva\b/g) ?? []).length;
    expect(usosDeCurva).toBeGreaterThanOrEqual(4);
  });

  /**
   * Deseleccionar tambien se ve.
   *
   * Al marcar tres de siete plataformas ninguna de las dos opciones del par
   * encaja ya. Antes de esto la pompa se quedaba **puesta y opaca** con el
   * texto en gris encima —el relleno sigue ahi, solo el color se ha ido—, que
   * es el peor de los dos mundos: ni se ve que hay pompa ni se lee el texto.
   *
   * La pompa se desvanece en su sitio y el texto vuelve a su gris, y los dos
   * tardan lo mismo para que se lean como un gesto unico.
   */
  test('al dejar de estar marcada ninguna, la pompa se desvanece', () => {
    expect(FILTRO).toContain("parcial={alcance === 'parcial'}");

    /*
     * Y el valor tiene que ser una de las dos opciones, siempre.
     *
     * Esto se rompio de verdad: se pasaba `value={alcance}` y con tres de siete
     * marcadas el valor era `'parcial'`, que no es ninguna de las dos opciones.
     * `medir()` busca el boton que coincide con el valor y no encontraba
     * ninguno, con lo que la pompa se quedaba **clavada encima de «Ninguna»**
     * y lo unico que la tapaba era el `opacity`. Al volver a un estado con
     * opcion elegida tenia que recolocarse desde cero, y el salto se notaba.
     *
     * `value` real + `parcial` aparte: la pompa siempre sabe donde esta, y el
     * estado a medias es una propiedad, no un valor que no existe.
     */
    expect(FILTRO).toMatch(/value=\{alcance === 'todas' \? 'todas' : 'ninguna'\}/);
    expect(FILTRO).not.toMatch(/value=\{alcance\}/);

    // Se desvanece con `opacity`, no desapareciendo: si se desmontase al volver
    // a un estado con opcion elegida tendria que medirse otra vez, y como
    // entonces no hay boton activo `medir` no hace nada y la pompa saltaria
    // desde la esquina del grupo durante un fotograma.
    expect(SELECTOR).toContain("parcial ? 'opacity-0' : ''");
    expect(SELECTOR).toContain('activo && !parcial');

    // Y la opacidad tiene que estar en la transicion, o no se desvanece.
    expect(SELECTOR).toMatch(/TRANSICION\s*=\s*'[^']*opacity/);
  });

  /**
   * Un selector sin titulo no se estira; uno desplegado, si.
   *
   * `w-full` venia heredado de `sinTitulo`, y al usarlo «Claves / Mis juegos»
   * en la cabecera pidio el ancho entero del contenedor: un selector de dos
   * palabras de 120 px que se iba a su propia fila y dejaba el resto de la
   * barra repartido alrededor.
   *
   * La cabecera debe seguir siendo **una fila** en cuanto hay sitio, y solo
   * partirse cuando de verdad no cabe —el buscador baja a su propia linea por
   * debajo de 900 px, que es lo que hace el `max-[900px]` de ahi—.
   */
  test('el ancho completo es opt-in, no se hereda de sinTitulo', () => {
    // La raiz solo se estira si alguien lo pide.
    expect(SELECTOR).toMatch(/completo\s*\?\s*'flex w-full'/);
    expect(SELECTOR).toMatch(/:\s*sinTitulo\s*\n?\s*\?\s*'flex'\s*\n?\s*:\s*'flex shrink-0/);

    // Y lo pide uno solo: el desplegable, que vive dentro de un panel con su
    // propia medida.
    expect(FILTRO).toContain('completo');

    // El selector de vistas, en la cabecera, no lo pide.
    expect(VISTAS).not.toContain('completo');
  });
});

/**
 * El teclado de los desplegables tiene que vivir fuera del boton.
 *
 * `Popover` se monta en `document.body` con un portal, asi que en cuanto la
 * lista esta abierta el elemento con el foco es un hermano del boton, no un
 * descendiente. Con el `onKeyDown` en el `<div>` que envuelve al boton, el
 * evento subia hasta `body` y se paraba ahi: **Enter no abria la lista**. Con el
 * raton no se notaba, porque el clic va directo al `onClick` del boton, pero con
 * el teclado no habia forma de llegar a las opciones.
 */
describe('teclado de los desplegables', () => {
  test('el listener esta en window, no en un onKeyDown del boton', () => {
    expect(FILTRO).toContain("window.addEventListener('keydown'");
    expect(FILTRO).toContain('window.removeEventListener');

    // Y en fase de captura, como el de Escape en `Popover`, para que se coja
    // antes que cualquier otro.
    expect(FILTRO).toMatch(/addEventListener\('keydown',\s*\w+,\s*true\)/);

    expect(FILTRO).not.toContain('onKeyDown');
  });

  /**
   * El listener se crea una vez y lee el estado por un ref.
   *
   * Si dependiera de `abierto`, `options` o `resaltada` habria que volver a
   * registrarlo en cada cambio —tres veces cada vez que se mueve el resaltado—
   * y eso es trabajo en el camino que mas se nota: el del teclado.
   */
  test('el estado va por ref, para no registrar el listener en cada cambio', () => {
    expect(FILTRO).toContain('estadoRef');
    expect(FILTRO).toContain('estadoRef.current');
  });

  /**
   * Las flechas de un desplegable no mueven el del de al lado.
   *
   * Con el listener en `window` cualquier par de teclas tocaria todos los
   * desplegables a la vez. Solo acta si el foco esta en su boton o en una de sus
   * opciones.
   */
  test('solo responde si el foco esta en este desplegable', () => {
    expect(FILTRO).toContain('botonRef.current?.contains(activo)');
    expect(FILTRO).toContain("getAttribute('role') === 'option'");
  });
});

/**
 * Nada se pinta hasta que esta todo cargado.
 *
 * Con el cartel de espera solo en el hueco de las claves, la cabecera salia ya
 * montada sobre una lista vacia y a los pocos milisegundos se le cambiaban los
 * numeros debajo de los ojos: el titulo pasaba de «0 de 0» a «403 de 403» y los
 * filtros se recolocaban al aparecer las opciones que dependen de los datos. Un
 * salto de maquetacion en cada arranque.
 *
 * El telon va **antes de la barra**, y espera a los ajustes **y** a las claves:
 * hasta que no se lean los ajustes, el idioma, el tema y el filtro son los de
 * fabrica.
 */
/**
 * Lo marcado se ve, o no esta marcado.
 *
 * Una opcion marcada solo con `aria-selected` es invisible: en un filtro de
 * seleccion multiple eso deja a quien lo usa sin forma de saber que ha marcado
 * ya, y obliga a abrir el menu para recordarlo. Y en el boton, un numero suelto
 * («3») dice cuantos hay marcados pero no cuales, que es una cuenta atras sin
 * contexto.
 */
describe('lo marcado se ve', () => {
  /**
   * El check de la marcada, y un fondo distinto del de las demas.
   *
   * Tres fondos y no dos porque son tres estados —marcada, resaltada por el
   * teclado, y las dos— y colapsarlos hacia dos era justo lo que hacia que
   * marcar no dejara rastro.
   */
  test('la opcion marcada tiene check y fondo propio', () => {
    expect(FILTRO).toContain('name="check"');

    // El check solo cuando esta marcada.
    expect(FILTRO).toMatch(/\{marcada \? \(/);

    // Y el fondo: tres ramas, no dos.
    expect(POPOVER).toMatch(/resaltada\s*\?\s*'bg-surface-3 text-t1'\s*:\s*activa\s*\?\s*'bg-surface-2/);
  });

  /**
   * El boton dice cuales son, no cuantos.
   *
   * Con un tope, porque sin el marcar las siete plataformas ocupa el ancho de
   * media barra y empuja a los demas filtros fuera de la vista: el problema que
   * vino a resolver este desplegable en el primer sitio.
   */
  test('el boton enseña los marcados como chips, con tope', () => {
    expect(FILTRO).toContain('TOPE_CHIPS');
    expect(FILTRO).toContain('slice(0, TOPE_CHIPS)');
    expect(FILTRO).toContain('sobran');

    // El chip lleva icono o punto de color, para reconocerlo sin leerlo.
    expect(FILTRO).toContain('option.dot');
    expect(FILTRO).toContain('option.icon');

    // Y el boton tiene un ancho maximo, para que el tope sea el que manda y no
    // el ancho disponible.
    expect(FILTRO).toMatch(/max-w-\[22rem\]/);
  });

  /**
   * Lo que no cabe en los chips se ve en el tooltip.
   *
   * El «+3» no dice cuales son. El `title` del boton es donde uno se para un
   * momento a leer, asi que tiene que llevar la lista entera.
   */
  test('el tooltip lleva la lista entera, no solo lo que cabe', () => {
    expect(FILTRO).toContain('resumen');
    expect(FILTRO).toMatch(/title=\{disabled \? disabledTitle : `\$\{label\}: \$\{resumen\}`\}/);
  });
});

describe('arranque sin salto de estilos', () => {
  const APP = fuente('app.component.tsx');

  test('el cartel espera a los ajustes y a las claves', () => {
    expect(APP).toContain('todoListo');
    expect(APP).toMatch(/todoListo\s*=\s*ajustesListos\s*&&\s*clavesCargadas/);

    // El flag sale del estado derivado, no de ponerlo en los dos sitios: asi no
    // se queda a medias si uno de los dos falla.
    expect(APP).toContain('setListoParaPintar(todoListo)');
    expect(APP).not.toContain('setListoParaPintar(true)');
  });

  test('el cartel envuelve toda la ventana, no solo el hueco de las claves', () => {
    /**
     * El cartel tiene que estar **antes** que `<Toolbar`.
     *
     * Comparando posiciones: si se pinta despues, la cabecera sale montada
     * mientras carga y el arreglo no hace nada. Es la unica forma de
     * comprobarlo leyendo el fuente, y mira justo lo que hay que mirar.
     */
    const cartel = APP.indexOf('!listoParaPintar ?');
    const barra = APP.indexOf('<Toolbar');

    expect(cartel).toBeGreaterThan(-1);
    expect(barra).toBeGreaterThan(-1);
    expect(cartel).toBeLessThan(barra);

    // Y ya no queda un segundo cartel mas abajo, que era el que dejaba la
    // cabecera al descubierto.
    expect(APP.split('app.loadingCollection').length - 1).toBe(1);
  });

  test('las claves marcan su carga aunque fallen', () => {
    // En el `finally`, no en el `try`: si la lectura falla, la pantalla tiene
    // que ensenar el error, no quedarse esperando para siempre.
    expect(APP).toMatch(/finally\s*\{\s*setClavesCargadas\(true\)/);
  });
});