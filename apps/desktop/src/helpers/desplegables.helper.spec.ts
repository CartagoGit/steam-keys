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
const FILTRO_CLAVE = fuente('contracts/interfaces/key-filter.interface.ts');
const FILTRAR = fuente('helpers/filter-keys.helper.ts');
const APP = fuente('app.component.tsx');

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
    expect(FILTRO).toContain('FILAS_POR_COLUMNA = 1');
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
    expect(FILTRO).toMatch(/className="relative shrink-0 overflow-hidden"[\s\S]{0,160}width: `\$\{anchoTags\}px`/);
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

    // Se compara contra un conjunto: es la diferencia entre comprobar cada
    // etiqueta suelta y comprobar una vez.
    expect(FILTRAR).toContain('const tags = new Set<string>(filter.tags)');

    // Y es una disyccion, no una conjunccion: con dos marcadas sale lo que
    // tenga cualquiera de las dos. Conjuncion seria «lo que tenga las dos», que
    // es un filtro que casi nunca devuelve nada y parece roto.
    expect(FILTRAR).toContain('!key.tags.some((tag) => tags.has(tag))');
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
    expect(FILTRO).toContain("const ALTO_COLUMNA = '2.5rem'");

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
  test('el desplegable y limpiar miden lo mismo que los toggles', () => {
    expect(FILTRO).toMatch(/justify-between gap-2 rounded-full px-3 py-2/);

    // Y la columna de tags, atada al alto de ese boton.
    expect(FILTRO).toContain("const ALTO_COLUMNA = '2.5rem'");
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

    // Mismo radio y misma caja que los botones del desplegable.
    expect(BARRA).toMatch(/inline-flex shrink-0 items-center justify-center gap-1\.5 rounded-full px-3 py-\[7px\]/);

    // Y el tono que dice «esto tira algo». Con el neutro de antes no se
    // distinguia de un filtro mas, y «Limpiar» no es un filtro: deshace.
    expect(BARRA).toMatch(/border border-danger\/30 bg-danger\/10 text-danger-strong/);
    expect(BARRA).toMatch(/hover:border-danger hover:bg-danger hover:text-on-danger/);

    // Con una cruz, que es la unica accion destructiva de la barra.
    expect(BARRA).toMatch(/<Icon name="x" size=\{12\}/);

    // Y limpia las etiquetas tambien, o el filtro se queda puesto sin que lo
    // diga nadie.
    expect(BARRA).toMatch(/onFilterChange\(\{[\s\S]{0,400}?tags: \[\],/);
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