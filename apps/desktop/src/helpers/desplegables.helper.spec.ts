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
const DIALOGO = fuente('components/modal.component.tsx');
const CLAVES_AJUSTES = fuente('components/settings-keys.component.tsx');
const I18N_ES = fuente('contracts/constants/i18n-es.constants.ts');
const FILTRO = fuente('components/filter-menu.component.tsx');
const SELECTOR = fuente('components/segmented.component.tsx');
const VISTAS = fuente('components/view-switch.component.tsx');
const AJUSTES = fuente('components/settings-dialog.component.tsx');
const BARRA = fuente('components/toolbar.component.tsx');
const CSS = fuente('styles/index.css');
const UI = fuente('components/ui.component.tsx');
const FILTRO_CLAVE = fuente('contracts/interfaces/key-filter.interface.ts');
const FILTRAR = fuente('helpers/filter-keys.helper.ts');
const UNICO = fuente('components/single-select.component.tsx');
const EDITOR = fuente('components/key-editor.component.tsx');
const PIE = fuente('components/app-footer.component.tsx');
const ATASJOS = fuente('helpers/use-shortcuts.helper.ts');
const PILA = fuente('helpers/dialogos.helper.ts');
const IDIOMA = fuente('components/locale-select.component.tsx');
const META = fuente('components/meta-select.component.tsx');
const APP = fuente('app.component.tsx');

describe('desplegables', () => {
  /**
   * Se desplaza **una sola** caja de toda la aplicacion.
   *
   * El «doble scroll» del filtro venia de que el panel entero se desplazaba
   * —cabecera, opciones y pie— y las dos barras `sticky` de los extremos
   * viajaban con el. Dos superficies moviendose por un solo gesto de la rueda,
   * sin saber cual de las dos mandaba.
   *
   * La solucion es que el panel sea una columna de tres y solo la del medio
   * tenga `overflow-y-auto`. Con eso la cabecera y el pie no necesitan ni
   * `sticky`: no se mueven.
   */
  test('solo se desplaza la lista de opciones, no el panel entero', () => {
    // Una sola caja con scroll en el filtro, y es la lista.
    const conScroll = FILTRO.match(/overflow-y-auto/g) ?? [];

    expect(conScroll).toHaveLength(1);
    expect(FILTRO).toContain('min-h-0 flex-1 overflow-y-auto overscroll-contain py-1');

    // Y el panel se lo pasa al filtro para que no se desplace el.
    expect(FILTRO).toContain('scrollCopia');
    expect(POPOVER).toContain('scrollCopia ?');
    expect(POPOVER).toContain("'flex flex-col overflow-hidden'");

    /**
     * Ni `sticky` ni `overscroll`.
     *
     * `overscroll-contain` va en la lista, no en el panel: es lo que impide
     * que al llegar al final de las opciones la rueda siga desplazando la
     * pagina de detras. Puesto en el panel haria lo contrario —conteneria el
     * scroll de la pagina entera desde el desplegable—.
     */
    expect(FILTRO).not.toContain('sticky');
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

  /**
   * El panel tiene ancho propio, y no el del boton que lo abre.
   *
   * Se ponia `minWidth: ancla.current?.offsetWidth`, asi que el menu tomaba el
   * ancho del ancla. En el filtro de etiquetas eso es mortal: el boton crece
   * con cada etiqueta marcada —chips dentro del propio boton—, de modo que el
   * menu se estiraba cada vez que se marcaba algo. Justo cuando mas se nota
   * es cuando mas se movia.
   *
   * Y en «Plataforma» el problema era el contrario: los nombres largos
   * («Sin determinar») empujaban el ancho y el menu se comia media pantalla.
   *
   * Con ancho fijo el menu es un menu: abre siempre igual, se lea el boton que
   * tenga detras lo que tenga.
   */
  test('el panel tiene ancho fijo, no el del boton que lo abre', () => {
    expect(POPOVER).toContain('const ANCHO = 280;');

    // Y lo aplica como ancho, no como minimo: en `minWidth` el panel se
    // estiraria igual con cualquier contenido ancho que metiera dentro.
    expect(POPOVER).toMatch(/^\s*width: ancho,$/m);
    expect(POPOVER).not.toContain('minWidth: ancla.current');

    // El calculo de la posicion usa ese mismo ancho, no el de la caja del
    // ancla: si el panel mide 280 y el boton 400, la caja se sale de la
    // ventana por la derecha y `MARGEN` deja de ser un margen.
    expect(POPOVER).toContain('caja.right - ancho');
    expect(POPOVER).toContain('window.innerWidth - ancho - MARGEN');
    expect(POPOVER).not.toContain('caja.right - caja.width');

    /**
     * Y `ancho` no es un atajo para volver a estirarlo.
     *
     * Lo que se guarda es un **numero**, no una clase ni una medida del boton:
     * el panel de color son diez discos de 26 y no cabe en 280 sin una caja
     * vacia alrededor, pero sigue siendo fijo. Con `minWidth` —o con
     * `ancho: 'max-content'`— volveria exactamente al fallo de antes.
     */
    expect(POPOVER).toContain('ancho = ANCHO');
    expect(POPOVER).not.toContain("ancho?: 'max-content'");
    expect(POPOVER).not.toContain('minWidth');
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
    // Con el scroll solo en la lista, cabecera y pie no se mueven. `sticky`
    // sobra y ademas estorba: con `position: sticky` dentro de un contenedor
    // que no se desplaza, el navegador aun reserva la capa y se ven dos
    // superficies animandose por el mismo gesto.
    expect(FILTRO).not.toContain('sticky');

    // Los dos se afinan para que el flex no les robe alto a las opciones.
    expect(FILTRO).toContain('shrink-0 border-b border-line bg-surface-1 p-1.5');
    expect(FILTRO).toContain('shrink-0 border-t border-line bg-surface-1');
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
   * Los tags van **a la derecha** del boton, no dentro.
   *
   * Se llegaron a meter dentro, y era un error por partida doble: el boton
   * media lo que midieran los tags, con lo que el desplegable se estira y empuja
   * a los demas filtros de la barra fuera de la vista —justo el problema que
   * vino a resolver este filtro—, y ademas el numero y el nombre del filtro
   * acababan en el mismo sitio, sin saber donde terminaba uno y empezaba el
   * otro.
   *
   * El boton vuelve a medir lo que media: «Todas» o el numero. Los tags ocupan
   * una columna de ancho fijo a su derecha, así que el ancho del desplegable no
   * depende de cuantos haya marcados.
   */
  test('los tags van a la derecha del boton y el boton no se estira', () => {
    // La columna de tags envuelve al boton.
    expect(FILTRO).toMatch(/<div className="flex shrink-0 items-start gap-1">\s*<button/);

    // El boton no lleva ancho maximo: eso era para que los tags de dentro no lo
    // partiesen, y ya no hace falta.
    expect(FILTRO).not.toContain('max-w-[22rem]');

    // Y solo pone el numero, como antes de los chips.
    expect(FILTRO).toContain(
      '{todas ? <span>{allLabel}</span> : <span className="tabular-nums">{marcadas.size}</span>}',
    );
  });

  /**
   * Los tags se reparten en dos columnas y caben todos.
   *
   * Con nombres largos —«Elder Scrolls Online»— en una sola fila habia que
   * recortar tanto que no se via nada. En dos columnas caben dos nombres
   * enteros y el tercero baja.
   *
   * **Y no hay tope de cuantos se ven.** Se puso uno y era un error de
   * criterio, no de espacio: con cuatro marcadas salia un «+1» en vez del tag.
   * Contar no es ver. Ocultar un filtro que el usuario acaba de marcar es
   * ademas lo contrario de lo que un filtro debe hacer, que es dar la sensacion
   * de que el conjunto marcado esta ahi entero.
   */
  test('los tags caben todos, apilados por columna, sin recorte', () => {
    expect(FILTRO).toContain('FILAS_POR_COLUMNA = 2');
    expect(FILTRO).toContain('ANCHO_MAX_TAG');

    // Ni un tope, ni el recuento de los que sobran, ni el recorte que los
    // escondia. Los tres son el mismo error contado de tres formas.
    expect(FILTRO).not.toContain('TOPE_TAGS');
    expect(FILTRO).not.toContain('sobran');
    expect(FILTRO).not.toMatch(/opcionesVisibles\s*=\s*options\.filter\([^)]*\)\.slice\(/);

    // Se filtered los marcados y se pintan tal cual.
    expect(FILTRO).toContain(
      'const opcionesVisibles = options.filter((option) => marcadas.has(option.value));',
    );

    // Las dos cajas —la que mide y la que se ve— llevan las mismas reglas de
    // rejilla, o medirian una cosa y pintarian otra.
    const flujos = FILTRO.match(/gridAutoFlow: 'column'/g);

    expect(flujos).toHaveLength(2);

    /**
     * Las columnas no se reservan enteras aunque no haya nada.
     *
     * Con las columnas fijas a `9rem`, una rejilla de dos columnas ocupa 18rem
     * **aunque este vacia**. Se vio: los filtros de plataforma y estado —que no
     * tienen ni un tag— dejaban un hueco de 292 px a la derecha de «Todas», y
     * el filtro de al lado no se movia nunca porque el hueco ya estaba ahi.
     *
     * Asi que se mide `max-content` y el tope se le pone al chip, no a la
     * columna. Si el tope estuviera en la columna, la columna ocuparia lo mismo
     * con cero tags que con veinte.
     */
    expect(FILTRO).toContain("gridAutoColumns: 'max-content'");
    expect(FILTRO).toContain('style={{ maxWidth: ANCHO_MAX_TAG, fontSize: TAMANO_CHIP }}');

    // Y ya no hay `grid-template-columns`: con `grid-auto-flow: column` las
    // columnas las abre el navegador hacia la derecha segun hagan falta.
    expect(FILTRO).not.toContain('gridTemplateColumns');
  });

  /**
   * La columna de tags **empuja** al filtro de al lado, y lo hace deslizando.
   *
   * Aqui no vale lo de antes. Cuando el hueco tenia un alto fijo, el filtro de
   * estado no se enteraba de nada; ahora los tags miden lo que ocupan y el
   * ancho sale de ahi, asi que el filtro de al lado **si** se mueve —que es lo
   * que tiene que hacer, para que se vea que el filtro se ha quedado estrecho—
   * pero no pega un salto.
   *
   * Por eso van dos cajas:
   *
   * - La de dentro lleva `width: max-content` y esta oculta. Sin eso mediria
   *   lo que le impone el ancho de fuera, que es justo el ancho viejo, y la
   *   medida no serviria para nada. Es la que `medir`.
   * - La de fuera lleva el ancho medido, en pixels, y es la que transiciona.
   *
   * Y por eso la transicion es de `width`/`height` y no de `transform`: el
   * ancho de un contenedor no se puede animar con `transform` sin deformar el
   * contenido.
   */
  test('la columna se mide de verdad y empuja al de al lado con animacion', () => {
    // Se mide en un efecto de layout, no en uno normal: en un `useEffect` normal
    // el navegador ya ha pintado la columna sin ancho, y eso es un salto.
    expect(FILTRO).toMatch(/useLayoutEffect\(\(\) => \{\s*\n\s*const caja = medidaRef\.current/);

    // Y se re-mide cuando cambian, porque los tags cambian de texto al cambiar
    // de idioma y el ancho tambien.
    expect(FILTRO).toContain('new ResizeObserver(leer)');

    // La caja que mide es invisible y no se pinte: si se viera, se veria dos
    // veces la misma lista.
    expect(FILTRO).toMatch(/ref=\{medidaRef\}[\s\S]{0,200}className="pointer-events-none invisible/);

    // Y mide lo que la rejilla pediria, no lo que hay recortado.
    expect(FILTRO).toMatch(/ref=\{medidaRef\}[\s\S]{0,400}width: 'max-content'/);

    // El ancho va en pixels, que es lo unico que el navegador sabe interpolar
    // entre dos medidas. El alto no: va fijo, y eso lo comprueba otro test.
    expect(FILTRO).toMatch(/className="absolute top-0 left-0 overflow-hidden"[\s\S]{0,160}width: `\$\{anchoTags\}px`/);
  });

  /**
   * El `title` del boton lleva la lista entera, no solo la primera fila.
   *
   * Los chips ya enseñan todos, pero cabe mas de una fila y en pantallas
   * estrechas la de abajo se sale. El `title` es donde uno se para un momento a
   * leer, asi que tiene que llevar la lista entera.
   */
  test('el tooltip lleva la lista entera, no solo lo que cabe', () => {
    expect(FILTRO).toContain('resumen');
    expect(FILTRO).toMatch(/title=\{disabled \? disabledTitle : `\$\{label\}: \$\{resumen\}`\}/);
  });
});

describe('el filtro de etiquetas', () => {
  /**
   * Las etiquetas se filtran, no se decoran.
   *
   * Los chips se pueden haber puesto por hermosura y no filtrar nada, que es lo
   * que paso la primera vez que se pintaron: se veian, se podian marcar y la
   * lista no cambiaba. Un filtro que no filtra es peor que no tener filtro,
   * porque hace creer que se esta mirando menos de lo que se mira.
   */
  test('las etiquetas entran en el filtro y hacen efecto', () => {
    // El contrato lleva la lista.
    expect(FILTRO_CLAVE).toMatch(/tags:\s*readonly string\[\]/);

    // Y el filtro vacio la deja vacia. Si se olvidara aqui, `filter.tags` seria
    // `undefined` y `.has` reventaria en la primera tecla.
    expect(FILTRAR).toMatch(/emptyFilter\([^)]*\)[^{]*\{[\s\S]{0,300}?tags:\s*\[\]/);

    /**
     * Se compara contra un conjunto, y **los dos lados normalizados**.
     *
     * El filtro guarda claves —«cumplidos»— y las claves guardan el texto tal
     * cual se escribio —«Cumplidos»—. Con `includes` y sin normalizar, marcar
     * una etiqueta en el filtro no filtraba nada: se abria, se marcaba y la
     * lista no se movia, sin error ni aviso. Es el mismo fallo que hacia que
     * la palabra se viera distinta en la fila y en el filtro, visto desde el
     * otro lado.
     *
     * Y la normalizacion de la clave se hace **una vez por clave**, en un
     * `Set` propio, y no dentro del comparador: con cinco marcadas y
     * cuatrocientas claves, normalizar por combinacion son veinte mil
     * normalizaciones.
     */
    expect(FILTRAR).toContain('const tags = new Set<string>(filter.tags.map(normalizeTag))');
    expect(FILTRAR).toContain('const propias = new Set(key.tags.map(normalizeTag))');
    expect(FILTRAR).not.toContain('key.tags.includes(tag)');

    // Y es una disyccion, no una conjunccion: con dos marcadas sale lo que
    // tenga cualquiera de las dos. Conjuncion seria «lo que tenga las dos», que
    // es un filtro que casi nunca devuelve nada y parece roto.
    expect(FILTRAR).toContain('![...propias].some((tag) => tags.has(tag))');
  });

  /**
   * El filtro solo aparece si hay etiquetas que filtrar.
   *
   * Con el catalogo vacio —una instalacion nueva, o una donde se han borrado
   * todas— un desplegable que se abre sobre nada es ruido. Y su `key` cambia
   * con la longitud del catalogo, asi que montar y desmontar en cada pulsacion
   * no es una perdida menor.
   */
  test('el filtro aparece en la barra solo cuando hay catalogo', () => {
    expect(BARRA).toMatch(/catalogo\.length > 0/);

    // Y el catalogo llega desde el componente raiz, que es quien lo tiene.
    expect(APP).toMatch(/<Toolbar[\s\S]{0,400}?catalogo=\{tags\}/);
    expect(BARRA).toMatch(/catalogo:\s*readonly ITag\[\]/);
  });

  /**
   * Cada dropdown lleva su tono, y el de las etiquetas no es uno de los otros.
   *
   * No es cosmetica del todo: el tono es lo que dice que filtro es cual cuando
   * hay cuatro seguidos y sin leer. Repetir el tono de otro seria como si no
   * hubiera filtro.
   */
  test('las etiquetas tienen tono propio en el desplegable y en la pompa', () => {
    expect(BARRA).toMatch(/<FilterMenu[\s\S]{0,600}?tone="violet"/);
    expect(FILTRO).toMatch(/violet:\s*\{\s*relleno: 'bg-accent',\s*sobreRelleno: 'text-on-accent',\s*titulo: 'text-accent'/);
    expect(SELECTOR).toMatch(/violet:\s*\{\s*pompa: 'bg-accent',\s*sobrePompa: 'text-on-accent',\s*titulo: 'text-accent'/);
  });

  /**
   * El chip que se ve y el que mide son **el mismo chip**.
   *
   * Estaba escrito dos veces y se separaron de dos formas, sin que nada
   * protestara:
   *
   * - El que mide no llevaba `text-[10px]`, de modo que media los tags a 16 px.
   *   La columna salia un 60 % mas ancha y se comia 71 px de aire a la derecha
   *   de los chips: el hueco fantasma.
   * - Solo el que media llevaba el tope de ancho.
   *
   * Dos copias de lo mismo siempre se separan tarde o temprano. Este test
   * ata las dos cajas al mismo renderizador, que es lo que lo hace imposible.
   */
  test('las dos cajas pintan el chip con el mismo codigo', () => {
    expect(FILTRO).toMatch(/const chip = \(option: IFilterOption<T>, visible: boolean\)/);

    // Y las dos cajas lo usan. Ni una tercera copia, ni el chip escrito a mano.
    expect(FILTRO).toContain('opcionesVisibles.map((option) => chip(option, false))');
    expect(FILTRO).toContain('opcionesVisibles.map((option) => chip(option, true))');
  });

  /**
   * Las dos cajas van a `max-content`, y la de fuera a `max-content` tambien.
   *
   * Ponerle a la visible el ancho medido parece lo natural —es el mismo
   * numero— y hace lo contrario: una rejilla con ancho definido reparte el
   * sobrante entre las columnas en vez de quedarse cada una con lo que pide.
   * Las columnas se acortan y el aire se queda a la derecha como un margen
   * invisible: media 243 px y ocupaba 172.
   *
   * El recorte lo pone la caja de fuera, que es la que tiene el ancho
   * transicionando.
   */
  test('ninguna caja fuerza un ancho: el recorte lo pone la de fuera', () => {
    // Las dos rejillas, identicas y a `max-content`.
    const anchos = FILTRO.match(/width: 'max-content'/g);

    expect(anchos).toHaveLength(2);

    // Y el ancho medido solo va en la caja que transiciona.
    expect(FILTRO).toContain('width: `${anchoTags}px`');
  });

  /**
   * El alto va **fijo**, y no sale de la medicion.
   *
   * Sale del alto del boton, no de lo que ocupan los chips. Con el alto
   * medido, cada tag que se marcase hacia el bloque del filtro mas alto, y con
   * el la fila entera: que es exactamente lo que no debe pasar, porque los
   * tags tienen que empujar en horizontal y en vertical nada.
   *
   * Y por eso la transicion es solo de `width`: animar tambien el alto
   * obligaria a volver a medirlo.
   */
  test('el alto de la columna es fijo y la transicion es solo de ancho', () => {
    expect(FILTRO).toContain("const ALTO_COLUMNA = '2.75rem'");

    // Ni una medida de alto que se pueda colar por ahi.
    expect(FILTRO).not.toContain('alto: altoTags');
    expect(FILTRO).not.toContain('altoTags');

    // Y las tres cajas que llevan el alto, las tres con la misma constante.
    const altos = FILTRO.match(/height: ALTO_COLUMNA/g);

    expect(altos).toHaveLength(3);

    expect(FILTRO).toContain(
      "const TRANSICION_TAGS = 'width 240ms cubic-bezier(0.34, 1.3, 0.64, 1)';",
    );
  });

  /**
   * Los tags se apilan **hacia abajo**, no hacia la derecha.
   *
   * Se llena una columna entera antes de abrir la siguiente. Con el flujo por
   * defecto de la rejilla pasaria al reves —uno en la primera fila, otro en la
   * segunda— que es lo que se hizo y no es lo pedido.
   */
  /**
   * La columna **cuelga**, no empuja.
   *
   * Dos filas de tags son 44 px y el boton 40. Si la columna ocupara su sitio
   * en el flujo, el bloque del filtro mediria 44, la fila entera creceria
   * cuatro pixeles y los titulos de al lado se descuadrarian —el descentrado que
   * se corrigio antes volviendo la fila a `items-start`—.
   *
   * En `absolute` ocupa ancho, que es lo que tiene que hacer para empujar, y no
   * ocupa alto. El envoltorio queda a la altura del boton.
   */
  test('la columna de tags cuelga del boton en vez de empujar la fila', () => {
    expect(FILTRO).toMatch(/<div className="relative shrink-0" style=\{\{ width: `\$\{anchoTags\}px` \}\}/);
    expect(FILTRO).toContain('className="absolute top-0 left-0 overflow-hidden"');
  });

  test('los tags llenan la columna antes de abrir la siguiente', () => {
    const flujos = FILTRO.match(/gridAutoFlow: 'column'/g);

    expect(flujos).toHaveLength(2);

    // Y las dos cajas fijan las mismas filas, que es lo que decide cuantas
    // caben por columna.
    const filas = FILTRO.match(/gridTemplateRows: `repeat\(\$\{FILAS_POR_COLUMNA\}, auto\)`/g);

    expect(filas).toHaveLength(2);
  });

  /**
   * Los controles de formulario heredan la fuente **dentro de una capa**.
   *
   * En CSS, lo que no esta en ninguna capa gana a todo lo que esta, por muy
   * especifica que sea la regla. La regla de heredar la fuente estaba fuera, y
   * como `font` es el atajo completo, `font: inherit` pisaba tambien el tamano:
   * **`text-xs` no hacia nada en ningun boton, input, select o textarea de la
   * aplicacion** y todos se veian a 16 px. Dentro de `@layer base`, las
   * utilidades vuelven a mandar.
   */
  test('heredar la fuente de los controles se queda fuera de las capas', () => {
    // Estuvo en `@layer base` para que las utilidades de tamano llegaran a los
    // botones, y fue un error de alcance: bajo todos los botones de la
    // aplicacion de 32 px a 24 sin que se pidiera. Vuelve a estar fuera. El
    // chip pone su tamano a mano y los demas se quedan como estaban.
    expect(CSS).not.toMatch(/@layer base \{\s*input,/);
    expect(CSS).toMatch(/input,\s*select,\s*textarea,\s*button \{\s*font: inherit;/);

    // Una sola vez, que duplicarla no arregla nada y descoloca la que queda.
    const reglas = CSS.match(/font: inherit/g);

    expect(reglas).toHaveLength(1);

    // Y como la regla se come el tamano, el chip no puede depender de una
    // utilidad: lo pone en el `style`, que es lo unico que gana.
    expect(FILTRO).toContain("const TAMANO_CHIP = '10px'");

    // Solo dentro del chip. El titulo del filtro es un `span`, no un boton, y
    // ahi la utilidad llega bien: alli `text-[10px]` si funciona.
    const chip = FILTRO.match(/const chip = [\s\S]*?\n  \);/);

    expect(chip?.[0]).not.toContain('text-[10px]');
  });

  /**
   * La fila de filtros se alinea arriba, no al centro.
   *
   * Con `items-center` cada bloque se centraba dentro de su linea, y mientras
   * todos median igual no se notaba. En cuanto un filtro cambia de alto —que es
   * lo que hace la columna de tags al crecer— la linea adopta su altura y los
   * demas se hunden: «Estado» y «Etiquetas» quedaban treinta y tantos pixeles
   * por debajo, con los titulos descentrados.
   */
  /**
   * Todos los controles de la fila miden lo mismo.
   *
   * El boton del pompa son 32 px por dentro, pero su pista lleva `p-1` y se ve
   * de 40. El desplegable no tiene pista —es un boton suelto—, asi que con el
   * mismo `py-1` que el pompa se quedaba en 32, ocho pixeles por debajo, y los
   * dos parecian cosas distintas siendo el mismo par. Los toggles son la
   * referencia: son los que ya estaban.
   *
   * Y el `border` de «Limpiar» tambien cuenta: con `py-2` se quedaba en 42.
   * Por eso ese va a `py-[7px]`, que es la cifra rara que deja los 40 justos.
   */
  /**
   * Los controles apagados se ven.
   *
   * Estaban con `bg-hover` —blanco al 5 %— y `text-t4`, que son 2,15:1 de
   * contraste en el tema oscuro. Por debajo del 4,5 que pide la norma, y por
   * debajo de lo que se necesita para que algo parezca pulsable: se leia como
   * un texto con una flecha pegada, no como un boton.
   *
   * Con superficie y borde son 6,4:1 en oscuro y 10,3:1 en claro. El borde es
   * la mitad del arreglo: sin el, el fondo no se distingue de la barra en la
   * que esta pegado por mucho que se le suba.
   *
   * Y el texto a `text-t1`, la tinta de la app. Con `text-t2` el boton se leia
   * bien pero la letra seguía pareciendose al fondo de lo que hay al lado: el
   * objetivo de un accionable es que se lea de un vistazo, no que se lea.
   */
  test('los controles apagados tienen superficie y borde, y texto de tinta', () => {
    expect(FILTRO).toMatch(/todas \? 'border border-borde bg-surface-2 text-t1'/);
    expect(FILTRO).not.toContain("todas ? 'bg-hover text-t4'");

    // Y la pista de los toggles, que estaba en el mismo estado.
    expect(SELECTOR).toContain("'relative flex items-center border border-borde bg-surface-2',");
    expect(SELECTOR).not.toContain("'relative flex items-center bg-hover',");

    // El texto de los no marcados tambien sube a la tinta mas alta.
    expect(SELECTOR).toContain("'text-t1 hover:text-t1'");
  });

  /**
   * El borde de los controles esta en `--borde`, no en `--line`.
   *
   * `--line` da 1,3:1 contra su propia superficie —medido en los nueve temas—,
   * y la WCAG 1.4.11 pide 3:1 para el contorno que identifica un control. Con
   * el texto en 7:1 y el borde en 1,5:1 lo unico que se notaba era la letra.
   *
   * `--line` no se toca porque para lo que sirve —separar la cabecera del
   * cuerpo, el filo de una tabla— un 1,3:1 es justo lo que debe ser: si no,
   * las separaciones gritan mas que los botones.
   */
  test('el borde de los controles usa --borde, y --line se queda para separar', () => {
    expect(CSS).toContain('--color-borde: var(--borde)');

    // Y cada `--borde` va pegado al `--line` de su tema, que es donde se
    // busca. Se comprueba hacia atras y no contando: que haya tantos pares
    // como `--borde` no dice nada si sobran dos `--borde` y faltan dos
    // `--line`.
    const lineas = CSS.split('\n');

    const huerfanos = lineas
        .map((linea, indice) => ({ linea, indice }))
        .filter(({ linea }) => linea.includes('--borde: #'))
        .filter(
            ({ indice }) =>
                !lineas
                    .slice(Math.max(0, indice - 40), indice)
                    .some((anterior) => anterior.includes('--line: #')),
        );

    expect(huerfanos.map(({ linea }) => linea.trim())).toEqual([]);

    // El boton, el desplegable y la pista de los toggles, los tres.
    expect(FILTRO).toContain('border border-borde bg-surface-2 text-t1');
    expect(SELECTOR).toContain('border border-borde bg-surface-2');
    expect(UI).toMatch(/border border-borde bg-surface-2/);

    // Y el input tambien, que tenia un `ring-1 ring-line` que no llegaba a 3:1.
    expect(UI).toContain('border border-borde bg-surface-2 px-3 py-2');
    expect(UI).not.toContain('ring-1 ring-line');
  });

  test('el desplegable y limpiar miden lo mismo que los toggles', () => {
    expect(FILTRO).toMatch(/justify-between gap-2 rounded-full px-3 py-2/);

    // Y la columna de tags, atada al alto de ese boton.
    expect(FILTRO).toContain("const ALTO_COLUMNA = '2.75rem'");
  });

  test('la fila de filtros arranca arriba', () => {
    expect(BARRA).toContain('flex flex-wrap items-start gap-x-5 gap-y-3');
    expect(BARRA).not.toContain('flex flex-wrap items-center gap-x-5 gap-y-3');
  });

  /**
   * «Limpiar» es un boton como los demas, no un enlace suelto.
   *
   * Era texto con subrayado y sin fondo en una fila de cinco botones
   * redondeados: se leia como una nota al pie de la barra. Y salia
   * descuadrado, porque el texto suelto mide 16 px y el boton 20.
   *
   * El hueco de arriba lleva un titulo invisible con las mismas clases que los
   * de los filtros, que es lo unico que alinea la fila sin un numero magico, y
   * `self-start` porque la fila ya no centra.
   */
  test('limpiar es un boton alineado con los demas y a la derecha', () => {
    expect(BARRA).toMatch(/<div className="ml-auto flex shrink-0 flex-col gap-1\.5 self-start">/);
    expect(BARRA).toMatch(/<span aria-hidden="true" className="invisible text-\[10px\] font-medium tracking-wide uppercase">/);

    /**
     * Misma caja que los botones del desplegable y que los del header: 42 px.
     *
     * Antes llevaba `py-[7px]`, la cifra rara que compensaba su `border` para
     * quedarse en 40. Era una medida para el boton solo: el de la derecha
     * quedaba dos pixeles mas bajo que todo lo demas de su fila, y se notaba
     * en el borde de abajo. Ahora `py-2`, y para que «Anadir» —que no lleva
     * borde— llegue tambien, `primary` y `danger` llevan borde transparente.
     */
    expect(BARRA).toMatch(/inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-3\.5 py-2/);

    // Y el tono que dice «esto tira algo». Con el neutro de antes no se
    // distinguia de un filtro mas, y «Limpiar» no es un filtro: deshace.
    // El borde va a /60: a /30 daba 1,3:1 contra el fondo, y un borde que no
    // se distingue del fondo no es un borde —la WCAG 1.4.11 pide 3:1—.
    expect(BARRA).toMatch(/border border-danger\/60 bg-danger\/10 text-danger-strong/);
    expect(BARRA).toMatch(/hover:border-danger hover:bg-danger hover:text-on-danger/);

    // Con una cruz, del mismo tamano y a la misma distancia que el «+» de
    // «Anadir»: a 12 px con 6 de separacion, los dos botones de la misma
    // barra se leian como de familias distintas.
    expect(BARRA).toMatch(/<Icon name="x" size=\{15\}/);

    // Y limpia las etiquetas tambien, o el filtro se queda puesto sin que lo
    // diga nadie.
    expect(BARRA).toMatch(/onFilterChange\(\{[\s\S]{0,400}?tags: \[\],/);
  });

  /**
   * Exportar, Importar y Datos viven en **Ajustes > Claves**.
   *
   * Estaban en la barra de arriba, que es comun a las dos tablas. Al cambiar a
   * «Mis juegos» seguian ahi: unas acciones para exportar, importar y abrir
   * los datos de una lista de claves, al lado de una biblioteca de Steam que
   * no es una lista de claves y que no se puede exportar ni importar.
   *
   * Movidas a la fila de filtros tampoco era: ahi se confunden con los filtros
   * —que filtran lo que se ve— cuando son de lo contrario, y encima lo unico
   * que las distingue es que son botones redondos al lado de otros redondos.
   * Su sitio es la pestana de claves, donde se ve de que son: del fichero.
   *
   * Se comprueba en los dos sitios: que no esten en la barra —ni como texto
   * ni como icono, que fue el primer intento y tambien fallaba— y que esten
   * en la pestana de claves de Ajustes.
   */
  test('exportar, importar y datos estan en ajustes > claves, no en la barra', () => {
    // Ni con texto ni en la barra de arriba ni en la fila de filtros.
    expect(BARRA).not.toMatch(/toolbar\.export/);
    expect(BARRA).not.toMatch(/toolbar\.import/);
    expect(BARRA).not.toMatch(/toolbar\.data/);

    expect(BARRA).not.toMatch(/icon="download"/);
    expect(BARRA).not.toMatch(/icon="upload"/);
    expect(BARRA).not.toMatch(/icon="package"/);

    // Y las props dejan de pasar por la barra.
    expect(BARRA).not.toContain('onExport');
    expect(BARRA).not.toContain('onImport');
    expect(BARRA).not.toContain('onOpenStorage');

    // En la pestana de claves, con su texto y con la seccion que los explica.
    expect(CLAVES_AJUSTES).toContain('onExport: () => void');
    expect(CLAVES_AJUSTES).toContain('onImport: () => void');
    expect(CLAVES_AJUSTES).toContain('onOpenStorage: () => void');

    expect(CLAVES_AJUSTES).toContain("t('toolbar.export')");
    expect(CLAVES_AJUSTES).toContain("t('toolbar.import')");
    expect(CLAVES_AJUSTES).toContain("t('toolbar.data')");

    /**
     * Y «Ajustes» y «Anadir» se quedan arriba, que no son de la lista.
     *
     * Con regex y no con `toContain`: el boton de Ajustes lleva los atributos
     * en cuatro lineas y el de Anadir en una, y un `toContain` de la cadena
     * entera solo encontraria uno de los dos —el que este partido de otra
     * forma el dia que se edite—. Lo que importa es que existan.
     */
    expect(BARRA).toMatch(/<Button\s+variant="ghost"\s+icon="settings"/);
    expect(BARRA).toMatch(/<Button\s+variant="primary"\s+icon="plus"/);
  });

  /**
   * La seccion del fichero dice lo que es, en vez de ser tres botones sueltos.
   *
   * Sin el titulo, tres botones con icono —descargar, subir, un paquete— en
   * una pestana que ya tiene otro boton con icono son cuatro pulsadores sin
   * jerarquia. Con el, se lee «esto es sobre el fichero» y los tres cuelgan
   * de ahi.
   */
  test('las tres acciones cuelgan de una seccion con nombre', () => {
    expect(CLAVES_AJUSTES).toContain("t('settings.keys.file')");
    expect(CLAVES_AJUSTES).toContain("t('settings.keys.file.hint')");

    // Y la seccion va **despues** de las etiquetas, que es lo que ya estaba.
    expect(CLAVES_AJUSTES.indexOf("t('settings.keys.file')")).toBeGreaterThan(
      CLAVES_AJUSTES.indexOf("t('settings.keys.tags')"),
    );
  });

  /**
   * Los dialogos cuelgan del borde de arriba, no van centrados.
   *
   * `items-center` hacia que cambiar de pestana moviera el dialogo entero. Al
   * crecer el contenido el panel se centro hacia abajo y al encoger se centro
   * hacia arriba, y las pestanas —la fila que decide el cambio— subian y
   * bajaban con el: pulsar la pestana que ya no estaba donde se vio.
   *
   * Arriba, la cabecera y las pestanas no dependen del alto del contenido, solo
   * de `MARGEN`, y no se mueven nunca. El alto se absorbe hacia abajo, que es
   * donde esta lo que cambia.
   *
   * Medido en el navegador con las tres pestanas de Ajustes: `top` = 16 en las
   * tres, con altos de 575, 488 y 483.
   */
  test('los dialogos cuelgan del borde de arriba, para que las pestanas no se muevan', () => {
    expect(DIALOGO).toContain('fixed inset-0 z-50 flex items-start justify-center');
    expect(DIALOGO).not.toContain('items-center justify-center');

    // El margen es lo unico que separa el panel del borde de arriba.
    expect(DIALOGO).toContain('const MARGEN = 16;');
    expect(DIALOGO).toContain('style={{ padding: MARGEN }}');

    // Y el alto maximo deja el mismo margen por abajo, de modo que un dialogo
    // que crece hasta el tope no se sale por abajo.
    expect(DIALOGO).toContain('style={{ maxHeight: `calc(100dvh - ${MARGEN * 2}px)` }}');
  });

  /**
   * Los dialogos no se pegan al borde de arriba.
   *
   * El margen y el `max-h` salen de la misma constante, en el `style`. Se
   * Podrian escribir como clases —`p-4` y `max-h-[calc(100dvh-2rem)]`— y
   * entonces el numero estaria escrito dos veces, con la mitad de las
   * posibilidades de que un dia se toque una y no la otra: el dialogo se sale
   * por abajo justo cuando se le ha anadido una fila, que es cuando mas falta
   * hace.
   *
   * Y no es que se pueda escribir con un literal de plantilla
   * (`max-h-[calc(100dvh-${MARGEN * 2}px)]`): Tailwind lee el codigo fuente
   * buscando literales, no expresiones, asi que de ahi no genera ninguna clase
   * y el margen se pierde sin avisar. Se perdio una vez por eso.
   *
   * Y el panel transiciona de tamano. Ajustes tiene pestanas y al cambiarlas
   * el alto saltaba de golpe; con `height` en la transicion —que es `auto`,
   * asi que el navegador interpola si puede— el dialogo se abre y se cierra
   * como una caja y no como un recorte.
   */
  test('los dialogos dejan margen y transicionan de tamano', () => {
    expect(DIALOGO).toContain('const MARGEN = 16;');

    expect(DIALOGO).toContain('style={{ padding: MARGEN }}');
    expect(DIALOGO).toContain('style={{ maxHeight: `calc(100dvh - ${MARGEN * 2}px)` }}');

    // Ni una clase construida con la constante, que es el fallo silencioso.
    expect(DIALOGO).not.toMatch(/className=\{`[^`]*\$\{/);
    expect(DIALOGO).not.toMatch(/'[^']*p-\[\$\{/);

    // Y la transicion pide menos movimiento al que no lo quiere.
    expect(DIALOGO).toContain('motion-reduce:transition-none');
  });

  /**
   * El candado de la exclusion.
   *
   * Con varias marcadas sale lo que lleva cualquiera de ellas, y eso casi
   * siempre es lo que se quiere. Pero «cumplidos **y** regalados» no se puede
   * pedir de ninguna otra forma, y sin este boton el filtro se queda corto sin
   * avisar: se marca, no sale lo esperado y no hay forma de saber por que.
   *
   * Va con candado y no con una casilla porque no es «activar algo»: abierto
   * es «con una basta» y cerrado es «hay que tenerlas todas», que es
   * exactamente lo que distingue a un candado de una casilla.
   *
   * Y sale **siempre**. Antes solo con dos o mas marcadas, que es lo unico que
   * se habia pedido: una fila que aparece al marcar la segunda etiqueta y se
   * va al desmarcar, sin avisar. Con una sola marcada no se esconde, se ve
   * **apagada**: se sabe que existe y que no aplica, que es mejor que no
   * saber que existe.
   */
  test('la exclusion es un candado que sale siempre', () => {
    /**
     * El boton del panel y su estado para el lector de pantalla.
     *
     * Los tres ya no estan escritos aqui: el filtro le pasa el estado al
     * `Toggle` —que es el mismo control que la casilla de orden inverso— y el
     * `Toggle` pone el `role` y el `aria-checked`. Se comprueba en los dos
     * sitios porque cada uno podria deshacerse por su cuenta.
     */
    expect(FILTRO).toContain('<Toggle');
    expect(FILTRO).toContain('marcada={excluir}');
    expect(UI).toMatch(/role="checkbox"/);
    expect(UI).toContain('aria-checked={marcada}');
    expect(FILTRO).toContain("icono={excluir ? 'lock' : 'lock-open'}");

    /**
     * Siempre en el DOM, y apagado por `:disabled`.
     *
     * Se comprueba que no haya ninguna condicion de renderizado alrededor:
     * con `{marcadas.size > 1 ? (…)}` la fila aparecia y desaparecia segun
     * cuantas etiquetas hubiera.
     */
    expect(FILTRO).not.toContain('{marcadas.size > 1 ? (');

    // Y **tampoco** se apaga con menos de dos. Ver el guard del candado de
    // abajo, que explica por que.
    expect(FILTRO).not.toContain('disabled={marcadas.size < 2}');

    /**
     * El candado va junto al **titulo** del filtro, no dentro del boton.
     *
     * Dentro del boton se leia como parte de la cuenta —«2 candado flecha»— y
     * ademas desaparecia al desmarcar todo: con cero marcadas y el modo
     * cerrado el filtro no acota, pero el modo sigue puesto y no se veia en
     * ninguna parte. El modo es del **filtro**, y su sitio es el nombre del
     * filtro, que es donde se lee de que filtro se esta hablando.
     *
     * El boton es solo el que abre el menu, y abrirlo no cambia el filtro:
     * el candado no tiene nada que ver con el y por eso no va ahi.
     */
    expect(FILTRO).toMatch(/\{onExcluir && excluir \? \(\s*<Icon\s*name="lock"/);

    // Y esta **antes** del boton en el fuente, que es lo mismo que estar
    // encima: el titulo va arriba y el boton debajo.
    const candado = FILTRO.indexOf('name="lock"');
    const boton = FILTRO.indexOf('<button');

    expect(candado).toBeGreaterThan(-1);
    expect(candado).toBeLessThan(boton);

    // Y sale siempre que el modo este puesto, sin mirar si hay algo marcado.
    expect(FILTRO).not.toMatch(/excluir \? \(<Icon[\s\S]{0,120}todas \?/);

    // El texto nombra el operador entero, sin una prop que decida cual: solo
    // hay un filtro con candado, asi que no hay dos lecturas que repartir.
    expect(FILTRO).toContain("t(`filter.menu.orAnd.${excluir ? 'on' : 'off'}`)");

    /**
     * La nota del pie **no** cambia con el candado.
     *
     * Antes decia «Con el candado abierto solo incluye las que llevan todas»,
     * y sale con el candado **cerrado**. Ademas en plataforma y estado el
     * candado no exige las que llevan todas: las descarta, que es otra cosa, y
     * con AND sobre una sola plataforma la lista saldria vacia. Es decir, la
     * nota era falsa en dos de los tres filtros.
     *
     * Y no hace falta que cambie: el operador ya lo nombra el boton de al
     * lado, palabra por palabra, y ese si depende del modo. La nota solo tiene
     * que explicar lo que no se deduce —que no marcar nada no filtra— y eso es
     * cierto con el candado como esté.
     */
    expect(FILTRO).toContain('t(footHint)');
    expect(FILTRO).not.toContain('footHintExcluir');

    /**
     * El tamano va en el `style`, y es el mismo que el de la nota.
     *
     * `text-[10px]` no llega a un boton: la regla de `font: inherit` esta
     * **fuera** de `@layer` —fuera, gana a cualquier utilidad— y como `font`
     * es el atajo completo, pisa tambien el tamano. El candado se veia a 16 px
     * junto a una nota a 10: tres veces mas grande, y la fila parecia un
     * titular en vez de de una nota al pie.
     */
    expect(FILTRO).toContain("const TAMANO_AVISO = '10px'");
    expect(FILTRO).toMatch(/style=\{\{ fontSize: TAMANO_AVISO \}\}/);
    expect(FILTRO).toMatch(/<p[\s\S]{0,120}style=\{\{ fontSize: TAMANO_AVISO \}\}/);
  });

  /**
   * El candado dice OR y AND, no «sale» ni «candado abierto».
   *
   * El texto era de correr: «Con candado abierto: sale lo que tenga alguna de
   * las marcadas». Tres cosas mal:
   *
   * - **Repetia el icono.** El candado ya esta a la izquierda; decir «con
   *   candado abierto» es leerlo dos veces.
   * - **«Sale»** es el verbo de la pantalla, no de la consulta. El filtro no
   *   saca nada: acota un conjunto.
   * - **«Lo que tenga»** esta en castelhano y suena a frase hecha.
   *
   * Lo que hace de verdad la consulta es un operador, asi que se dice el
   * operador. Y el que lo nombra es **el boton**, no la nota: el boton ya
   * tiene el candado al lado y es lo que se pulsa, asi que ahi es donde se
   * lee que filtro se esta aplicando.
   */
  test('el candado nombra el operador, en vez de repetir el icono', () => {
    // Corto, porque lo que explica esta en la nota de al lado. Y son **dos**
    // textos, no cuatro: con el candado solo en etiquetas, solo hay una cosa
    // que nombrar —OR y AND— y las de plataforma y estado se fueron con el.
    expect(I18N_ES).toContain("'filter.menu.orAnd.off': 'Elementos que contengan alguna seleccionada.'");
    expect(I18N_ES).toContain("'filter.menu.orAnd.on': 'Elementos que contengan todas las seleccionadas.'");

    // Y las otras dos no existen: describian un modo que ya no hay.
    expect(I18N_ES).not.toContain('filter.menu.acota');
    expect(FILTRO).not.toContain('filter.menu.acota');

    /**
     * Ni una palabra de las que se quitaron.
     *
     * Solo las que estaban **en el boton**. «Candado cerrado» vuelve a salir,
     * pero en la nota, y ahi si ayuda: es lo unico que explica que con el
     * candado cerrado cambia la consulta. Lo que no puede es repetir el icono
     * en la linea que lo describe.
     */
    // Solo en las dos lineas del boton. En el resto del fichero esas palabras
    // salen en mensajes que si las necesitan, y un `not.toContain` sobre el
    // fichero entero las prohibiria tambien ahi.
    for (const clave of ['filter.menu.orAnd.off', 'filter.menu.orAnd.on']) {
      const linea = I18N_ES.split('\n').find((l) => l.includes(`'${clave}'`)) ?? '';

      for (const palabra of ['candado', 'sale ', 'descartar', 'coincide', 'incluye']) {
        expect(`${clave}:${palabra}:${linea.toLowerCase().includes(palabra)}`).toBe(`${clave}:${palabra}:false`);
      }
    }

  });

  /**
   * La nota del pie dice las tres reglas del filtro, no una.
   *
   * Se quedo en «Sin marcar ninguna: sin filtro» y con eso desaparecio la
   * parte importante: que con varias marcadas se puede pedir **cualquiera** o
   * **todas**. Es la unica funcionalidad de los tres filtros que no se deduce
   * mirando los botones, y sin la parece que el filtro solo sabe filtrar por
   * una cosa.
   *
   * Con «Varias: OR o AND» el boton dice cual de las dos esta puesta y la nota
   * dice que las dos existen. Y son las tres reglas en una linea: sin marcar no
   * se filtra —que es lo que no se deduce de un boton que pone «Todas»—, con
   * una da igual, y con varias se elige el operador.
   *
   * Sin jerga de conjuntos: «interseccion» y «union» no le dicen nada a quien
   * esta marcando etiquetas, y lo de verdad lo dice OR y AND.
   */
  test('la nota del pie dice las tres reglas del filtro', () => {
    /**
     * Y dice «si cierras el candado», no «si abres».
     *
     * Decia «abres», que es justo lo contrario: el candado nace abierto, asi
     * que «solo las que las llevan todas» —que es lo que hace el filtro en
     * modo cerrado— no se obtiene abriéndolo sino cerrándolo. Ademas el boton
     * de al lado ya trae su candado, y la nota se leia como si el icono de la
     * izquierda marcara el modo, cuando el icono va en el **titulo** y lo que
     * se pulsa es el boton de abajo.
     */
    expect(I18N_ES).toContain('Sin marcar ninguna, se ve todo. Con varias marcadas, el filtro incluye las que llevan alguna, o solo las que las llevan todas si cierras el candado.');
    expect(I18N_ES).toContain('Sin marcar ninguna, se ve todo. Con varias marcadas, el filtro incluye las que llevan alguna.');
    // Y sin nota para el candado cerrado, porque no tendria que ser cierta
    // para los tres filtros: no hay una regla comun a «exige todas» y
    // «descarta las marcadas».
    expect(I18N_ES).not.toContain('footHintExcluir');

    // Y el texto entero, no un esqueleto: es lo unico que explica el filtro.
    for (const nota of ['filter.tags.footHint', 'filter.menu.footHint']) {
      const linea = I18N_ES.split('\n').find((l) => l.includes(`'${nota}'`)) ?? '';

      expect(`${nota}:${linea.length}`).not.toBe(`${nota}:0`);
    }

    // Y nada de jerga de teoria de conjuntos en ninguna de las tres.
    for (const palabra of ['interseccion', 'union', 'uniao', 'intersecao']) {
      expect(I18N_ES).not.toContain(palabra);
    }
  });

  /**
   * El menu **crece** con su contenido; no se encoge la lista.
   *
   * El alto maximo estaba en 320, un numero arbitrario que ademas se cumplia
   * siempre: el panel media 302 siempre, cabecera y pie se comian 111 y a las
   * opciones les quedaban 182. Con cinco etiquetas —180 de contenido— eso era
   * un scroll de seis pixeles en un menu al que le sobraba media pantalla, y
   * con treinta etiquetas la lista se encogia mas.
   *
   * El alto de verdad lo pone la pantalla, que es lo que mide `Popover` al
   * colocar el menu. Este numero solo entra cuando la ventana es mas alta, y
   * para entonces que el menu se aproveche entero.
   *
   * Medido: cinco opciones dan 302 px y siete dan 342, y en los dos casos sin
   * barra de scroll. Antes los dos daban 320 y con scroll.
   */
  test('el alto del menu lo marca el contenido, no un numero fijo', () => {
    expect(FILTRO).toContain('const ALTO_MAXIMO_PANEL = 640');
    expect(FILTRO).toContain('altoMaximo={ALTO_MAXIMO_PANEL}');

    // Y la lista cede el alto: sin `flex-1` growing, el pie no la aplasta.
    expect(FILTRO).toContain('min-h-0 flex-1 overflow-y-auto overscroll-contain py-1');

    // El pie es `shrink-0`, con lo que el que cede espacio es el de en medio.
    expect(FILTRO).toContain('shrink-0 border-t border-line bg-surface-1');
  });

  /**
   * El candado sale **solo** en el filtro que tiene modo exclusion.
   *
   * Esto se rompio por hacer el boton «siempre». Se pinto en Plataforma y en
   * Estado tambien, donde la exclusion no existe: ahi `onExcluir` no llega,
   * el boton salia pulsable en cuanto habia dos marcadas y al pulsarlo no
   * pasaba nada. Un boton que no hace nada es peor que uno que no esta,
   * porque promete una consulta que no se va a hacer.
   *
   * Lo decide `onExcluir`, no un flag aparte: si el filtro trae el modo, el
   * boton existe. Un flag podria quedar desincronizado de la prop que hace el
   * trabajo, que es justo como se llego a este bug.
   */
  test('el candado sale solo en el filtro de etiquetas y nunca se apaga', () => {
    // Sale con `onExcluir`, no con un flag: un flag se desincroniza de la prop
    // que hace el trabajo, y asi llego el boton que salia y no hacia nada.
    expect(FILTRO).toContain('{onExcluir ? (');
    expect(FILTRO).toContain('alCambiar={onExcluir}');
    expect(UI).toContain('onClick={() => alCambiar(!marcada)}');

    // Sin llamada opcional: con ella, se puede pulsar sin efecto.
    expect(FILTRO).not.toContain('onExcluir?.(');

    /**
     * Y **solo** se lo pasa el filtro de etiquetas.
     *
     * Se cuentan a mano porque el numero solo no dice nada: si aparece tres
     * veces en el mismo filtro, o no hay candado en otro. Va uno en cada
     * `FilterMenu`, que es como se distingue.
     *
     * Plataforma y estado no lo llevan porque una clave tiene una sola
     * plataforma y un solo estado: «Steam **y** Epic» no devuelve nada ni con
     * la coleccion entera. Un icono de candado ahi anuncia un AND que no se
     * puede pedir, y es el modo que solo se ve cuando ya hay algo marcado.
     */
    const menus = BARRA.match(/<FilterMenu[\s\S]*?\/>/g) ?? [];

    expect(menus).toHaveLength(3);
    expect(menus.filter((menu) => menu.includes('onExcluir='))).toHaveLength(1);

    // Y el que lo lleva es el de etiquetas, no otro.
    expect(menus.find((menu) => menu.includes('onExcluir='))).toContain("t('filter.tags')");
    expect(BARRA.match(/onExcluir=\{\(excluir\)/g) ?? []).toHaveLength(1);

    // Y nada de flags de negacion para los otros dos: no existen en el contrato.
    expect(BARRA).not.toContain('excluirPlataformas');
    expect(BARRA).not.toContain('excluirEstados');
    expect(FILTRO).not.toContain('modoExclusion');

    /**
     * **Nunca se apaga.**
     *
     * Antes llevaba `disabled={marcadas.size < 2}` y `text-t5` con menos de
     * dos marcadas. Sobre un pie de 10 px, `t5` es casi no verse: en el filtro
     * de un solo elemento —el caso normal— no se distinguia de nada. Y
     * apagado quiere decir que no se puede dejar el modo puesto antes de
     * seguir marcando, que es justo cuando se decide.
     *
     * Con una sola marcada los dos modos dan lo mismo, asi que no hace falta
     * apagarlo para que se entienda que no cambia nada.
     */
    expect(FILTRO).not.toContain('disabled={marcadas.size < 2}');
    expect(FILTRO).not.toContain("cursor: marcadas.size < 2 ? 'not-allowed' : 'pointer'");
    expect(FILTRO).not.toContain("marcadas.size < 2 ? 'text-t5'");
    expect(UI).toContain("marcada ? 'text-t1' : 'text-t3 hover:text-t2'");
  });

  test('los dos modos de combinar llegan al filtro y se limpian juntos', () => {
    expect(FILTRO_CLAVE).toMatch(/excluir\?: boolean/);

    // Y «Limpiar» los quita los dos, o el filtro sigue acotando sin avisar.
    expect(BARRA).toMatch(/onFilterChange\(\{[\s\S]{0,400}?tags: \[\],[\s\S]{0,120}?excluir: false,/);

    // La exclusion se la pasa a la barra solo el filtro de etiquetas, que es el
    // unico donde tiene sentido: con plataformas o estados, «todas» no existe.
    expect(BARRA).toMatch(/tone="violet"[\s\S]{0,200}?excluir=\{filter\.excluir\}/);
  });
});

describe('arranque sin salto de estilos', () => {
  const APP = fuente('app.component.tsx');
  /**
   * El estado de «las claves ya se han leido» vive en `useKeys`, asi que lo que
   * se marca en el `finally` ya no esta en el componente. La guarda mira los dos
   * ficheros porque lo que vigila es que la marca se ponga **siempre**, no que
   * este en un sitio concreto.
   */
  const KEYS = fuente('helpers/use-keys.helper.ts');

  test('el cartel espera a los ajustes y a las claves', () => {
    expect(APP).toContain('todoListo');
    expect(APP).toMatch(/todoListo\s*=\s*ajustesListos\s*&&\s*keysLoaded/);

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
    expect(KEYS).toMatch(/finally\s*\{\s*setLoaded\(true\)/);

    // Y el componente tiene que leer el nombre que devuelve el hook, no otro.
    expect(APP).toMatch(/loaded:\s*keysLoaded/);
  });
});
/**
 * El candado nace **abierto**.
 *
 * Cerrado es el caso raro: obliga a que la clave lleve todas las marcadas, y
 * con «cumplidos y regalados» sobre una coleccion de mil eso no devuelve nada
 * hasta que se acumulan las etiquetas. Es un filtro que de entrada parece
 * roto, y es exactamente lo que se ve al empezar.
 *
 * Ademas el abierto es lo que se espera al marcar: se marca «lo mio de este
 * tema» y sale lo de ese tema. Cerrado es para quien busca deliberadamente el
 * cruce, que se pulsa a proposito.
 *
 * Y «Limpiar» lo devuelve a abierto, que es lo unico que hace que el boton no
 * conserve un filtro puesto que no se ve en ninguna parte.
 */
describe('el candado nace abierto', () => {
  test('el filtro por defecto tiene el modo abierto', () => {
    // El unico que hay: en `emptyFilter`, que es lo que se usa al arrancar y
    // al pulsar «Limpiar».
    expect(FILTRAR).toMatch(/excluir: false,/);

    // Y los otros dos ni aparecen: no tienen modo que abrir ni cerrar.
    expect(FILTRAR).not.toContain('excluirPlataformas');
    expect(FILTRAR).not.toContain('excluirEstados');
  });

  test('el filtro por defecto no acota por nada', () => {
    // Si `excluir` se COLOCA por error en `emptyFilter`, con el filtro sin
    // marcar no se notaria —no hay nada que acotar— y en cuanto se marcara
    // algo apareceria una lista vacia sin explicacion.
    expect(FILTRAR).toMatch(/tags: \[\],[\s\S]{0,40}?excluir: false,/);

    // Y los otros dos filtros no tienen nada que dejar cerrado.
    expect(FILTRAR).not.toMatch(/platforms: \[\],[\s\S]{0,200}?excluirPlataformas/);
  });

  test('limpiar devuelve el modo a abierto', () => {
    expect(BARRA).toMatch(/excluir: false,/);
  });

  test('las props del componente tambien arrancan en abierto', () => {
    // `excluir = false` por defecto: un filtro que no lo pase sale abierto.
    expect(FILTRO).toMatch(/excluir = false,/);
  });
});

/**
 * Un solo selector de una eleccion para los cuatro.
 *
 * Son cuatro cosas que hacen exactamente lo mismo —abrir una lista, elegir
 * una, cerrarla— y eran cuatro ficheros. No se les veia la diferencia en el
 * comportamiento: la lista salia por un portal, el teclado la recorria con las
 * flechas y la elegida llevaba un check. Lo que **si** se veia era el boton:
 *
 * - el de idioma llevaba `ring-1 ring-line`;
 * - el de plataforma y estado, `border border-borde` —`INPUT_CLASS`;
 * - el de orden era un `<select>` nativo, con la lista y el dibujado del
 *   sistema operativo y sin transicion.
 *
 * Tres bordes distintos para el mismo control, y dos de ellos en la misma
 * pantalla del mismo dialogo. Un campo con `ring` y otro con `border` no se
 * leen como la misma familia aunque lo sean: el grosor y el sitio donde se
 * dibujan no casan, y el ojo lo nota antes que la cabeza.
 *
 * El nativo era el peor de los tres: ademas de no parecerse, **no admite nada
 * dentro de un `<option>`** —una bandera o un icono se ignoran— y su lista la
 * dibuja el sistema, que en Windows sale con otro tamano, otro desplazamiento y
 * otra tipografia. Si el menu tiene que verse como el resto, tiene que ser
 * nuestro.
 */
describe('un solo selector de una eleccion', () => {
  test('los cuatro usan el mismo componente y ninguno se dibuja a mano', () => {
    // Los tres que existian, mas el de orden, que se ha converted.
    for (const [nombre, texto] of [
      ['idioma', IDIOMA],
      ['meta', META],
      ['orden', BARRA],
    ] as const) {
      expect(`${nombre}:${texto.includes('SingleSelect')}`).toBe(`${nombre}:true`);
    }
  });

  test('el de orden ya no es un <select> nativo', () => {
    // El `<option>` solo admite texto, asi que no hay forma de ponerle icono.
    expect(BARRA).not.toContain('<select');
    expect(BARRA).not.toContain('<option');
    expect(BARRA).not.toContain('SELECT_CLASS');
  });

  test('el boton del desplegable sale en un solo sitio de toda la app', () => {
    // `aria-haspopup="listbox"` es la senal de «esto abre una lista». Si sale
    // en otro fichero, ese boton esta hecho a mano y puede diverjir en
    // cualquier cosa —que es exactamente como se separaron.
    for (const [nombre, texto] of [
      ['idioma', IDIOMA],
      ['meta', META],
      ['toolbar', BARRA],
    ] as const) {
      expect(`${nombre}:${texto.includes('aria-haspopup="listbox"')}`).toBe(`${nombre}:false`);
    }

    // Y sale una vez en el comun, que es quien lo dibuja.
    expect(UNICO.match(/aria-haspopup="listbox"/g)).toHaveLength(1);
  });

  test('el boton es el de `CAMPO_CLASS`, el mismo que los campos', () => {
    // El de idioma se salia de la familia con `ring-1 ring-line`, y con eso el
    // dialogo de ajustes tenia dos bordes distintos a la vez.
    expect(UNICO).toContain('${CAMPO_CLASS} flex items-center gap-2 text-left');
    expect(IDIOMA).not.toContain('ring-1 ring-line ');
    expect(META).not.toContain('ring-1 ring-line ');
  });

  test('el boton del desplegable no lleva `w-full`', () => {
    // `INPUT_CLASS` lo lleva, y con las dos clases en el atributo manda la que
    // Tailwind pone despues en su CSS y no la que va la ultima: el ancho
    // acaba siendo el que no se queria. Para eso esta `CAMPO_CLASS` suelta.
    expect(UI).toContain('export const INPUT_CLASS = `${CAMPO_CLASS} w-full`');
    expect(UNICO).not.toContain('INPUT_CLASS');
  });

  test('el giro de la flecha y el `listbox` con nombre', () => {
    // Sin nombre, el lector de pantalla anuncia «lista» a secas y hay que
    // haber leido el boton para saber que se esta abriendo.
    expect(POPOVER).toContain("'aria-label': ariaLabel");
    expect(POPOVER).toContain('aria-label={ariaLabel}');
    expect(UNICO).toContain('aria-label={label}');

    // Y la flecha gira al abrir, que es el gesto que dice «esto esta
    // desplegado» sin tener que mirar el panel.
    expect(UNICO).toContain("abierto ? 'rotate-180' : ''");
  });

  test('el teclado lo maneja el boton, no el panel', () => {
    // El panel va en un portal colgado de `body`: un `onKeyDown` suyo solo ve
    // lo que se pulsa con el raton encima, que es justo cuando no se navega.
    expect(UNICO).toMatch(/<div[^>]*onKeyDown=\{alTeclado\}/);
    expect(UNICO).not.toMatch(/<Popover[^>]*onKeyDown/);
  });

  test('lo unico que cambia entre ellos es el `icono` de la opcion', () => {
    // El boton enseña el de la elegida y cada fila el suyo, y salen del mismo
    // sitio. Con un `icon?: IconName` habria que inventar un tipo capaz de
    // pintar una bandera, un icono con su color y nada.
    expect(UNICO).toContain('icono?: ReactNode');

    // Y sale del mismo sitio en el boton y en la fila: sin resto de hueco,
    // sin medida fija. Lo que pone el boton es el de la elegida.
    expect(UNICO).toContain('{elegida?.icono}');
    expect(UNICO).toContain('{option.icono}');
  });
});

/**
 * Un solo dialogo, con una sola cabecera y un solo pie.
 *
 * Los dialogos eran nueve ficheros y **casi ninguno** usaba el `Modal` comun:
 * cada uno escribia su fondo, su cabecera y su pie. No parecian nueve copias
 * sino nueve versiones distintas: el titulo a `text-sm` en unos y a `text-base`
 * en otros, el icono a 15 y a 16 px, el boton de cerrar con `p-1.5` y con `p-2`,
 * la cruz en unos con nombre y en otros sin el.
 *
 * Con nueve versiones, «un dialogo» no es una forma de dibujar nada: es una
 * forma de tener nueve. Y lo que se sale de las demas es lo que se nota.
 *
 * Los dos que escribian su fondo —el panel de datos y la previsualizacion de
 * la importacion— ademas se quedaban sin `aria-modal`, sin trampa de foco y
 * **sin cerrar con Escape**. El segundo no tenia ni boton de cerrar: se salia
 * pulsando fuera, que no es donde se busca cuando algo va mal.
 */
describe('un solo dialogo', () => {
  /** Los ficheros que dibujan un dialogo. */
  const DIALOGOS = [
    'bulk-status-dialog',
    'feedback',
    'gift-dialog',
    'import-preview',
    'key-editor',
    'settings-dialog',
    'shortcuts-dialog',
    'storage-panel',
    'tag-manager',
    'tags-dialog',
  ].map((nombre) => `components/${nombre}.component.tsx`);

  test('el fondo se escribe una sola vez, en el `Modal`', () => {
    // `fixed inset-0` con `z-50` es la firma de un dialogo dibujado a mano.
    expect(DIALOGO).toContain('fixed inset-0 z-50');

    for (const nombre of DIALOGOS) {
      expect(`${nombre}:${fuente(nombre).includes('fixed inset-0')}`).toBe(`${nombre}:false`);
    }
  });

  test('la cabecera se escribe una sola vez, en `ModalHeader`', () => {
    // Un `<header>` con una `<h2>` y un boton de cerrar es la cabecera de todos
    // los dialogos. Si aparece escrito en un fichero, ese dialogo tiene la
    // suya.
    expect(DIALOGO).toContain('export function ModalHeader');
    expect(DIALOGO).toContain('export function ModalFooter');

    for (const nombre of DIALOGOS) {
      expect(`${nombre}:${fuente(nombre).includes('<header')}`).toBe(`${nombre}:false`);
    }
  });

  test('el pie se escribe una sola vez, en `ModalFooter`', () => {
    // `border-t border-line px-5 py-3` estaba escrito caracter a caracter en
    // cinco ficheros: sin un sitio comun no hay manera de saber si los cinco
    // dias siguientes siguen iguales.
    for (const nombre of DIALOGOS) {
      expect(`${nombre}:${fuente(nombre).includes('justify-end gap-2 border-t')}`).toBe(`${nombre}:false`);
    }
  });

  test('la cruz de cerrar sale una sola vez en toda la app', () => {
    // El boton de cerrar vive en `ModalHeader`. Anywhere else esta dibujado a
    // mano y se le puede olvidar el nombre.
    const conCruz = DIALOGOS.filter((nombre) => fuente(nombre).includes('name="x"'));

    expect(conCruz).toEqual([]);
  });
});

/**
 * Escape cierra el dialogo de encima, y lo sabe sin lista de dialogos.
 *
 * Antes lo decidia una lista escrita a mano con los diez dialogos de la app,
 * en `use-shortcuts.helper`, mas diez banderas y diez funciones de cierre en
 * `app.component`. Tres sitios que habia que mantener de acuerdo para que una
 * tecla cerrara lo que toca, y ninguno lo comprobaba: un dialogo nuevo que se
 * olvidara en la lista se quedaba sin cerrar con la tecla, sin avisar.
 *
 * Y la lista estaba ademas **mal**. Decia que Ajustes queda encima del panel de
 * datos, y se llega al panel de datos **desde** Ajustes. Con los dos abiertos,
 * un Escape cerraba Ajustes y dejaba el panel de datos solo en pantalla, con el
 * fondo oscurecido y sin forma de salir con la tecla que se acababa de usar.
 *
 * Ahora cada `Modal` se apila al montarse, en el orden en que React lo monta,
 * que es el orden real en el que se abren.
 */
describe('que cierra escape', () => {
  test('la pila es un helper, no una lista dentro del hook', () => {
    expect(PILA).toContain('export function apilarDialogo');
    expect(PILA).toContain('export function dialogoSuperior');

    // El hook ya no lleva ninguna lista de dialogos: solo pregunta.
    expect(ATASJOS).toContain("import { dialogoSuperior } from './dialogos.helper'");
    expect(ATASJOS).not.toContain('IDialogosAbiertos');
    expect(ATASJOS).not.toContain('TDialogoId');
    expect(ATASJOS).not.toContain('CASCADA');
  });

  test('`app.component` no lleva la cuenta de que dialogos hay abiertos', () => {
    // Diez banderas y diez funciones de cierre que cada dialogo ya repite en su
    // `onClose`. Las dos listas pueden mirar para lados distintos y solo se ve
    // cuando algo va mal.
    expect(APP).not.toContain('dialogs: {');
    expect(APP).not.toContain('onClose: {');
  });

  test('cada `Modal` se apila y no escucha la tecla por su cuenta', () => {
    expect(DIALOGO).toContain("import { apilarDialogo } from '@/helpers/dialogos.helper'");
    expect(DIALOGO).toContain('apilarDialogo(onClose)');

    /*
     * Y no escucha `Escape` por su cuenta: si lo hiciera, con dos dialogos
     * abiertos la pulsacion llegaria a los dos —los dos estan en `window`— y
     * cerrarian los dos de una vez.
     */
    expect(DIALOGO).not.toContain("event.key !== 'Escape'");
    expect(DIALOGO).not.toContain("window.addEventListener('keydown'");
  });
});

/**
 * El ancho del boton de un desplegable, medido y con transicion.
 *
 * El de «Ordenar por» lleva `w-44` fijo. Con el texto del nombre delante, el
 * boton se salia de ahi: «Ordenar por» + «Por plataforma» + relleno son mas
 * de 220 px en la traduzccion mas larga, y lo que sobra se comia el buscador o
 * empujaba el resto de la barra.
 *
 * Y con el ancho en vez del texto, al cambiar de orden el boton encoge y **no
 * empuja a nadie**: mide lo que mide lo seleccionado y lo demas se queda quieto.
 */
describe('el ancho del desplegable de orden', () => {
  test('el ancho se mide, no se escribe', () => {
    expect(UNICO).toContain('ajustarAncho');
    expect(UNICO).toContain("nodo.style.width = ''");
    expect(UNICO).toContain('nodo.style.width = `${nodo.offsetWidth}px`');

    // Y no hay ancho fijo en el toolbar.
    expect(BARRA).toContain('ajustarAncho');
    expect(BARRA).not.toContain('className="w-44"');
  });

  test('se suprime el ancho puesto antes de medir', () => {
    /**
     * Sin la primera linea, la medida no es la del contenido.
     *
     * El ancho puesto manda sobre el natural, asi que la segunda medida daria
     * el ancho de la opcion anterior y el boton se quedaria clavado en la
     * primera que se eligio: elegir «Por plataforma» no moveria nada.
     */
    const medir = UNICO.slice(
      UNICO.indexOf('const medir = (): void => {'),
      UNICO.indexOf("window.addEventListener('resize'"),
    );

    expect(medir.indexOf("style.width = ''")).toBeLessThan(
      medir.indexOf('offsetWidth'),
    );
  });

  test('la transicion del ancho va en sus tres propiedades', () => {
    /**
     * El atajo entero en `transitionProperty` no hace nada.
     *
     * Ahi va solo la lista de propiedades. Poner `width 200ms cubic-bezier(...)`
     * hace que la declaracion no valide, el navegador la descarta, y el boton se
     * queda con la lista de la clase `transition` —colores, sombra, opacidad—
     * que no incluye el ancho. El ancho salta de golpe y no hay ningun sintoma:
     * el estilo se ve puesto en el inspector.
     */
    expect(UNICO).toContain("transitionProperty: 'width'");
    expect(UNICO).toContain('transitionDuration: DURACION_ANCHO');
    expect(UNICO).toContain('transitionTimingFunction: CURVA_ANCHO');
    expect(UNICO).not.toContain('transitionProperty: TRANSICION');

    // Y el nombre del selector va en un icono, no escrito dentro del boton.
    expect(BARRA).toContain('name="sort"');
    expect(BARRA).toContain('iconoBase={');
    expect(UNICO).not.toContain('prefijo');
  });
});

/**
 * La pompa de un selector se mide **despues** de que termine la animacion.
 *
 * `getBoundingClientRect` devuelve medidas ya transformadas. El dialogo entra
 * con `animate-scale-in`, que va de 0,96 a 1, asi que midiendo a mitad de
 * camino la pompa salia multiplicada por la escala —5 pixeles corta en un
 * boton de 180— y se quedaba ahi para siempre, porque no habia ningun cambio
 * posterior que la midiera otra vez.
 *
 * Se notaba en las pestanas de Ajustes abiertas desde «Mis juegos» sin cuenta
 * conectada: el texto de la pestana activa se salia medio pixel fuera de la
 * pastilla. El `aria-checked` estaba bien, que es por lo que se leia como un
 * fallo de dibujado y no de estado.
 */
describe('la pompa se mide cuando el dialogo ya esta quieto', () => {
  test('vuelve a medir al terminar cualquier animacion', () => {
    expect(SELECTOR).toContain("window.addEventListener('animationend', alTerminar, true)");
    expect(SELECTOR).toContain("window.removeEventListener('animationend', alTerminar, true)");

    // Y se quita al desmontar: un listener que se queda escucha animaciones de
    // dialogos que ya no existen.
    expect(SELECTOR).toContain('observador?.disconnect()');
  });

  test('sigue mirando el ancho de la pista y el de la ventana', () => {
    // El idioma cambia el ancho de los botones, y la ventana tambien.
    expect(SELECTOR).toContain('new ResizeObserver(() => medir())');
    expect(SELECTOR).toContain("window.addEventListener('resize', medir)");
  });
});

/**
 * El editor se cierra **despues** de vaciarse.
 *
 * Dos fallos en el mismo boton:
 *
 * - Se le pasaba `open` a pelo, siempre `true`. `Modal` ya sabe reproducir la
 *   salida, pero nunca se le decia que se estaba cerrando, asi que el panel se
 *   borraba en el fotograma en que `open` de fuera pasaba a `false` y el
 *   `useKeepMounted` no tenia nada que reproducir.
 * - Al cerrar se soltaba la clave que se estaba editando. `editing` es lo que
 *   el formulario lee al abrirse, asi que vaciarlo hacia que `entry` pasara a
 *   `null` en el mismo instante en que empezaba la salida: los campos se
 *   vaciaban solos, a la vista, durante los 140 ms de la animacion. Se veia
 *   como un guardado que se iba al traste.
 */
describe('el editor se cierra mirandose', () => {
  /**
   * Que clave se edita y si el editor esta abierto son el mismo par, asi que
   * viven en `useModals` y no se pueden separar. El guard mira los dos
   * ficheros porque lo que vigila es el par, no donde este escrito.
   */
  const MODALS = fuente('helpers/use-modals.helper.ts');

  test('recibe `open` y lo pasa al `Modal`', () => {
    expect(EDITOR).toContain('open = true');
    expect(EDITOR).toContain('<Modal\n      open={open}');

    // El `open` a pelo era el fallo.
    expect(EDITOR).not.toMatch(/<Modal\s*\n\s*open\s*\n/);
  });

  test('cerrar no suelta la clave que se esta editando', () => {
    expect(APP).toContain('onClose={closeEditor}');

    // Cerrar solo apaga. `editing` se suelta al abrir, que es donde importa:
    // si se soltara aqui, el formulario perderia los datos que esta enseñando
    // durante los 140 ms de la salida.
    expect(MODALS).toMatch(
      /const closeEditor = useCallback\(\(\): void => setEditorAbierto\(false\), \[\]\);/,
    );
    expect(MODALS).not.toMatch(/closeEditor[\s\S]{0,120}?setEditing\(null\)/);
  });

  test('la clave se suelta al abrir, y en los dos caminos', () => {
    // Editar: se pone la nueva antes de abrir. Crear: al omitir el argumento
    // queda a `null`, tambien antes de abrir.
    expect(MODALS).toMatch(
      /const openEditor = useCallback\(\(entrada\?: IGameKey \| null\): void => \{[\s\S]{0,120}?setEditing\(entrada \?\? null\);\s*\n\s*setEditorAbierto\(true\)/,
    );
  });
});

/**
 * Los enlaces del pie, con nombre y sin ocupar sitio.
 *
 * Con dos nombres mas el pie se quedaba sin sitio en una ventana estrecha, y
 * lo que se perdia era el recuento de claves, que es lo unico que no esta en
 * ninguna parte mas.
 */
describe('los enlaces del pie', () => {
  test('van al repositorio y al perfil, y solo con el icono', () => {
    expect(PIE).toContain('url={PROYECTO_URL}');
    expect(PIE).toContain('url={PERFIL_URL}');
    expect(PIE).toContain('<Icon name="github"');
    expect(PIE).toContain('<Icon name="linkedin"');

    // Las URLs estan en los contratos, no escritas en el componente: cambiar la
    // del perfil debe ser cambiar una linea.
    expect(PIE).not.toContain('github.com');
    expect(PIE).not.toContain('linkedin.com');
  });

  test('se abren con `ExternalLink`, que sale del navegador del sistema', () => {
    // Un `<a>` a pelo puede no abrirse en una ventana de escritorio y
    // acabarse navegando a la web, dejando la coleccion en blanco.
    expect(PIE).toContain('<ExternalLink');
    expect(PIE).not.toContain('window.open');
  });

  test('los enlaces llevan el nombre de quien firma, no solo el icono', () => {
    /**
     * Los enlaces **enseñan** el nombre de la firma y no solo el icono.
     *
     * Antes eran solo el icono de la marca, con el nombre en el `title`. Con
     * eso habia que pasar el raton por cada uno para saber a quien llevaban, y
     * lo unico que se veía en el pie era «una flecha y otra flecha». El nombre
     * va delante del icono porque es el que dice **quien** firma, y el icono
     * identifica la marca sin tener que leer.
     *
     * Los dos, ademas, salen de `app.constants` y no de un texto traducible:
     * `CartagoGit` y `Mario Cabrero Volarich` son nombres propios y se escriben
     * como son, con mayusculas.
     */
    expect(PIE).toContain('{FIRMA_CODIGO}');
    expect(PIE).toContain('{FIRMA_PERFIL}');
    expect(PIE).toContain('name="github"');
    expect(PIE).toContain('name="linkedin"');

    // Y el `title` los nombra tambien, que es lo que lee quien va con lector de
    // pantalla: el texto del enlace ya dice el nombre, pero el `title` dice
    // tambien a donde lleva.
    expect(PIE).toContain("t('footer.code')");
    expect(PIE).toContain("t('footer.author')");
    expect(UI).toContain('aria-label={title}');
  });

  test('el aviso de derechos va centrado, con el recuento al lado', () => {
    /*
     * En un pie de escritorio el centro es el sitio de la firma. Con
     * `justify-between` los dos extremos tienen que medir igual para que el
     * bloque de en medio no se mueva, y el recuento —lo unico que cambia de
     * texto— lo empujaba cada vez que era mas largo.
     */
    expect(PIE).toContain('grid-cols-[1fr_auto_1fr]');
    expect(PIE).toContain('justify-center');
    expect(PIE).not.toContain('justify-between');

    // Y el ano no esta escrito a mano: se pide al pintar, porque una app que
    // no se actualiza cada mes deja el ano viejo y no hay quien lo arregle.
    expect(PIE).toContain('new Date().getFullYear()');
    expect(PIE).not.toMatch(/©\s*20\d\d/);
  });
});

/**
 * El orden inverso.
 *
 * Invierte el **primer criterio** y no da la vuelta a la lista. «Por
 * plataforma» son tres cosas en fila: plataforma, titulo e id. Al invertir solo
 * la primera, Z sale antes que A **dentro** de Steam y los titulos de cada
 * plataforma siguen en A-Z.
 *
 * Darle la vuelta a la lista entera haria lo contrario: dentro de cada
 * plataforma los titulos tambien saldrian al reves, y el desempate por id —que
 * existe para que dos claves del mismo juego no cambien de sitio entre
 * recargas— se invertiria con el. Un orden que no se puede repetir deja de ser
 * un orden.
 *
 * Y se invierte con `* -1` y no con un `if` por rama: la comparacion es la misma
 * en los dos sentidos, y duplicarla es como un cambio en ella se queda sin
 * aplicar en uno de los dos.
 */
describe('el orden inverso', () => {
  test('se invierte el criterio, y solo el criterio', () => {
    expect(FILTRAR).toContain('const sentido = inverso ? -1 : 1');

    // El desempate por id se queda **fuera** del `sentido`: es el que evita que
    // dos claves del mismo juego cambien de sitio entre recargas, y darlo la
    // vuelta lo deshace igual que lo deshace el titulo.
    expect(FILTRAR).toContain('sentido * a.title.localeCompare(b.title, \'es\') || a.id - b.id');
    expect(FILTRAR).toContain('sentido * a.status.localeCompare(b.status, \'es\') ||');
    expect(FILTRAR).toContain('sentido * a.platform.localeCompare(b.platform, \'es\') ||');

    // Y el parametro tiene valor por defecto, para que llamarla como antes siga
    // dando el mismo orden.
    expect(FILTRAR).toContain('inverso = false');
  });

  test('la fila del pie es el mismo control que el candado', () => {
    /*
     * Los dos son «esta consulta o la contraria», y los dos estan al pie de un
     * desplegable. Estaban escritos dos veces, con el mismo marcado y el mismo
     * truco del tamano en el `style`.
     */
    expect(FILTRO).toContain('<Toggle');
    expect(UNICO).toContain('<Toggle');

    // Y no queda ninguna copia del boton con casilla.
    expect(FILTRO).not.toContain('role="checkbox"');
    expect(UNICO).not.toContain('role="checkbox"');
    expect(UI).toContain("role=\"checkbox\"");
  });

  /**
   * La lista se recalcula al cambiar **el sentido**.
   *
   * El `useMemo` de la lista visible llevaba `[keys, filter, sort]` y el
   * sentido se colaba dentro sin declarar: cambiar la casilla marcaba la fila y
   * giraba el icono, pero la lista se quedaba igual. Dos de las tres señales
   * del cambio eran verdad y la tercera —la que importa— no, asi que no se
   * veía como un fallo sino como un menu que no ordenaba.
   */
  test('el memo de la lista incluye el sentido', () => {
    expect(APP).toContain('sortKeys(filterKeys(keys, filter), sort, ordenInverso)');
    expect(APP).toMatch(
      /sortKeys\(filterKeys\(keys, filter\), sort, ordenInverso\),\s*\[keys, filter, sort, ordenInverso\]/,
    );
  });

  test('el icono del boton gira con el sentido', () => {
    // Un solo icono, rotado. Con dos iconos, un dia se cambia uno y no el otro.
    expect(BARRA).toContain("sortInverso ? 'rotate-180' : ''");
    expect(BARRA).toContain('name="sort"');

    // Y el giro se ve sin abrir el menu: lleva transicion.
    expect(BARRA).toContain('transition-transform');
  });

  test('el pie no se desplaza con la lista', () => {
    /*
     * Con `scrollCopia` solo se desplaza la lista y la casilla se queda fija.
     *
     * Sin ella, el panel entero baja y la unica forma de volver a cambiar el
     * sentido —sin reabrir el menu— se va por arriba. Y no puede ser una
     * `PopoverOption` mas: la lista es de eleccion unica, donde las flechas no
     * tienen nada que recorrer, y Enter sobre ella cerraria el menu sin elegir.
     */
    expect(UNICO).toContain('scrollCopia={pie !== undefined}');
    expect(UNICO).toContain('className="shrink-0 border-t border-line"');
  });
});
