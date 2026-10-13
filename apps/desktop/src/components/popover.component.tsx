import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type TPopoverLado = 'izquierda' | 'derecha';

export interface IPopoverProps {
  /** `true` mientras se ve la lista. */
  abierto: boolean;
  /** Boton al que se ancla la lista. Es lo que se mide. */
  ancla: React.RefObject<HTMLElement | null>;
  /** Al cerrar: Escape, clic fuera o elegir algo. */
  onCerrar: () => void;
  /**
   * Que borde del boton se alinea con el de la lista.
   *
   * `izquierda` para el que se abre hacia la derecha —un desplegable de campo
   * de formulario— y `derecha` para el que se sale hacia el otro lado, como el
   * boton del extremo de una barra.
   */
  lado?: TPopoverLado;
  /** Alto maximo en pixeles. La lista se desplaza dentro si se pasa. */
  altoMaximo?: number;
  /**
   * Ancho del panel, en pixeles.
   *
   * `ANCHO` es el de una lista de opciones y no sirve para todo: el panel de
   * color son diez discos de treinta pixeles, y a 280 se abre una caja vacia
   * alrededor. Con esto lo elige quien lo abre, y el ajuste para no salirse de
   * la ventana lo hace el mismo sitio de siempre.
   */
  ancho?: number;
  /** Indice de la opcion resaltada, para mantenerla a la vista. */
  resaltada?: number;
  /**
   * `false` cuando el panel **no** es la lista.
   *
   * El panel lleva `role="listbox"` por defecto porque casi todos lo son: son
   * listas de opciones y asi lo anuncian los lectores de pantalla sin tener que
   * repetirlo en cada sitio.
   *
   * El desplegable de filtros es la excepcion —lleva arriba el par «Ninguna /
   * Todas», abajo una nota y en medio la lista—, y ahi el rol va en su lista
   * de dentro. Un `listbox` con botones y con un parrafo dentro miente sobre lo
   * que contiene: un lector de pantalla anuncia «lista de X elementos» y se
   * encuentra con mas cosas.
   */
  esLista?: boolean;
  /**
   * `true` para que se desplace **solo** la lista de dentro.
   *
   * El panel se desplaza entero por defecto, lo que incluye la cabecera y el
   * pie. Con `sticky` se quedan a la vista y funciona, pero se ve el doble
   * desplazamiento: las dos barras del panel y —en un menu alto— la de la
   * pagina de detras. Dos o tres superficies que se mueven a la vez por un
   * solo gesto de la rueda, y no se sabe cual de las dos manda.
   *
   * Con esto el panel es una columna de tres cajas —cabecera, lista, pie— y
   * la unica que se desplaza es la del medio. La cabecera y el pie dejan de
   * necesitar `sticky` y pasan a estar fijas de verdad.
   */
  scrollCopia?: boolean;
  className?: string;
  /**
   * Nombre del panel, cuando es una lista.
   *
   * Sin esto el lector de pantalla anuncia «lista» a secas. Con el nombre se
   * anuncia «lista de Plataformas, 7 elementos», que es lo que hace falta para
   * saber que se esta abriendo sin haber leido el boton.
   */
  'aria-label'?: string;
  children: React.ReactNode;
}

/** Hueco entre el boton y la lista, en pixeles. */
const SEPARACION = 6;

/** Margen que se deja contra el borde de la ventana. */
const MARGEN = 8;

/** Alto por debajo del cual «abajo» ya no da sitio de verdad. */
const MIN_ABajo = 120;

/** Margen del alto maximo: una lista mas baja de esto parece un error. */
const ALTO_MINIMO = 96;

/**
 * Ancho del panel, en pixeles.
 *
 * Fijo y no el del boton. Con `minWidth` al ancho del ancla, el menu se
 * estiraba cada vez que el boton crecia —al marcar una etiqueta, al marcar
 * tres—, de modo que el menu se movia mientras se leia y Platforma, con
 * nombres largos, se comia media pantalla.
 *
 * 280 px es lo que necesita el nombre mas largo de las listas —«Sin
 * determinar» con su punto y sus numeros al lado— con aire, y cabe en
 * cualquier ventana en la que quepa un boton.
 */
const ANCHO = 280;

/** Donde va la lista, en pixeles desde el borde de la ventana. */
interface IPosicion {
  top: number;
  left: number;
  alto: number;
  /** `true` cuando no cabe debajo y se ha volteado hacia arriba. */
  arriba: boolean;
}

/**
 * Lista desplegable que se dibuja **fuera** de donde vive.
 *
 * El problema que resuelve. Un desplegable normal es un elemento con
 * `position: absolute` debajo del boton, y funciona bien… hasta que el boton
 * esta dentro de un contenedor que recorta. El panel de un dialogo lleva
 * `overflow-hidden` —sin el, las esquinas redondeadas no se recortan— y su
 * cuerpo es `flex-1 overflow-y-auto`. Las dos cosas juntas hacen que un
 * desplegable dentro de un dialogo:
 *
 * - **no se vea entero**: se lo come el borde del panel y la lista se corta
 *   por la mitad sin ninguna pista de que hay mas debajo;
 * - **mueva el dialogo**: al abrirse, la opcion resaltada se trae a la vista
 *   con `scrollIntoView`, y eso desplaza el cuerpo entero. El dialogo da un
 *   bote al abrir un desplegable, que es lo que se nota como «algo raro».
 *
 * La solucion no es pelearse con el `overflow`, sino **sacar la lista del
 * arbol del dialogo**: se monta en `document.body` con `position: fixed` y se
 * coloca midiendo el boton. Asi da igual cuantos ancestros recorten, y de
 * paso se puede voltear hacia arriba cuando no cabe abajo —el caso del ultimo
 * campo de un formulario largo, que con `absolute` se salia de la pantalla sin
 * forma de llegar al final de la lista—.
 *
 * Se usa un portal de React, no un nodo suelto: el arbol de eventos sigue
 * siendo el normal, y un `onKeyDown` del boton sigue viendo lo que pasa dentro
 * de la lista, que es lo que hace falta para navegar con las flechas.
 */
export function Popover({
  abierto,
  ancla,
  onCerrar,
  lado = 'izquierda',
  altoMaximo = 256,
  ancho = ANCHO,
  resaltada,
  esLista = true,
  scrollCopia = false,
  className = '',
  children,
  'aria-label': ariaLabel,
}: IPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState<IPosicion | null>(null);

  /**
   * `true` mientras hay panel en el DOM, y `saliendo` durante la salida.
   *
   * Son dos estados y no uno porque **cerrar tambien hay que verse**. Con un
   * solo estado —`if (!abierto) return null`— el panel desaparece en el
   * fotograma en que se cierra y la animacion de entrada se queda sin espejo:
   * abrir desliza el menu desde el boton y cerrar lo hace desaparecer de la
   * nada, que se lee como un fallo y no como una respuesta.
   *
   * Es el mismo truco que usa `Modal`, y por el mismo motivo: al cerrar,
   * `abierto` pasa a `false` pero el panel sigue montado hasta que la
   * animacion termina.
   */
  const [visible, setVisible] = useState(abierto);
  const [saliendo, setSaliendo] = useState(false);

  /**
   * Mide el boton y decide donde va la lista.
   *
   * `useLayoutEffect` y no `useEffect`: se calcula **antes** de pintar, con lo
   * que la lista aparece ya en su sitio. Con `useEffect` habria un fotograma en
   * la posicion anterior —que al abrir es 0,0— y se veria un parpadeo desde la
   * esquina de la ventana.
   */
  const colocar = useCallback((): void => {
    const boton = ancla.current;

    if (!boton) return;

    const caja = boton.getBoundingClientRect();

    // Cuanto queda por debajo y por encima. Con listas cortas se elige el lado
    // con mas sitio, y no por una regla fija: un desplegable en el ultimo
    // campo de un formulario casi siempre tiene mas sitio **arriba**.
    const sitioAbajo = window.innerHeight - caja.bottom - MARGEN;
    const sitioArriba = caja.top - MARGEN;
    const arriba =
      sitioAbajo < Math.min(altoMaximo, MIN_ABajo) && sitioArriba > sitioAbajo;

    const alto = Math.max(
      ALTO_MINIMO,
      Math.min(
        altoMaximo,
        (arriba ? sitioArriba : sitioAbajo) - SEPARACION,
      ),
    );

    const left = lado === 'derecha' ? caja.right - ancho : caja.left;

    setPosicion({
      top: arriba ? caja.top - SEPARACION - alto : caja.bottom + SEPARACION,
      left: Math.max(MARGEN, Math.min(left, window.innerWidth - ancho - MARGEN)),
      alto,
      arriba,
    });
  }, [altoMaximo, ancla, ancho, lado]);

  useLayoutEffect(() => {
    if (!abierto) {
      setPosicion(null);
      return;
    }

    colocar();
  }, [abierto, colocar]);

  useEffect(() => {
    if (abierto) {
      setVisible(true);
      setSaliendo(false);
      return;
    }

    // Cerrado y visible todavia: toca reproducir la salida antes de desmontar.
    if (visible) setSaliendo(true);
  }, [abierto, visible]);

  /**
   * Termina la salida y desmonta.
   *
   * El `if (!saliendo)` es imprescindible y no es DEFensivo: `onAnimationEnd`
   * salta tambien al acabar la animacion de **entrada**, y sin esta comprobacion
   * el desplegable se cerraria justo despues de abrirse, al abrirlo.
   */
  const terminarSalida = (): void => {
    if (!saliendo) return;

    setVisible(false);
    setSaliendo(false);
  };

  /**
   * Recalcular mientras se mueve el mundo.
   *
   * `scroll` con `capture: true` para que avise tambien de los scrolls dentro
   * del dialogo, no solo de los de la pagina. Sin esto, al desplazarse el
   * dialogo la lista se queda clavada en el sitio viejo: el sintoma clasico de
   * `position: fixed` dentro de algo que se mueve.
   */
  useEffect(() => {
    if (!abierto) return;

    const recalcular = (): void => colocar();

    window.addEventListener('scroll', recalcular, { capture: true, passive: true });
    window.addEventListener('resize', recalcular);

    return () => {
      window.removeEventListener('scroll', recalcular, { capture: true });
      window.removeEventListener('resize', recalcular);
    };
  }, [abierto, colocar]);

  /**
   * Mantiene la opcion resaltada a la vista, **solo** dentro del panel.
   *
   * Se ajusta el `scrollTop` a mano en vez de usar `scrollIntoView`, y no por
   * falta de ganas: `scrollIntoView` desplaza tambien cualquier ancestro que
   * se pueda mover, que es precisamente el bote del dialogo que este componente
   * viene a quitar. A mano no puede tocar nada mas.
   */
  useEffect(() => {
    const panel = panelRef.current;

    if (!abierto || !panel || resaltada === undefined) return;

    const nodo = panel.querySelectorAll('[role="option"]')[resaltada];

    if (!(nodo instanceof HTMLElement)) return;

    const arriba = nodo.offsetTop;
    const abajo = arriba + nodo.offsetHeight;

    if (arriba < panel.scrollTop) panel.scrollTop = arriba;
    else if (abajo > panel.scrollTop + panel.clientHeight) {
      panel.scrollTop = abajo - panel.clientHeight;
    }
  }, [abierto, resaltada]);

  /** Clic fuera, y Escape. */
  useEffect(() => {
    if (!abierto) return;

    const fuera = (evento: PointerEvent): void => {
      const destino = evento.target as Node;

      if (ancla.current?.contains(destino)) return;
      if (panelRef.current?.contains(destino)) return;

      onCerrar();
    };

    const alPulsar = (evento: KeyboardEvent): void => {
      if (evento.key !== 'Escape') return;

      /**
       * Se para aqui a proposito.
       *
       * El dialogo que contiene este desplegable tambien escucha Escape en
       * `window` para cerrarse. Sin este `stopPropagation`, abrir un desplegable
       * y pulsar Escape cerraria **los dos**: primero la lista y acto seguido
       * el dialogo entero. Lo natural es que Escape suba un nivel, no que se
       * caiga todo.
       *
       * Llega aqui antes que a `window` porque este listener va en fase de
       * captura y `window` en la de burbuja, asi que el orden no depende de
       * donde este el nodo de React.
       */
      evento.stopPropagation();

      onCerrar();
    };

    document.addEventListener('pointerdown', fuera);
    window.addEventListener('keydown', alPulsar, true);

    return () => {
      document.removeEventListener('pointerdown', fuera);
      window.removeEventListener('keydown', alPulsar, true);
    };
  }, [abierto, ancla, onCerrar]);

  if (!visible || posicion === null) return null;

  return createPortal(
    <div
      ref={panelRef}
      role={esLista ? 'listbox' : undefined}
      aria-label={ariaLabel}
      onAnimationEnd={terminarSalida}
      style={{
        position: 'fixed',
        top: posicion.top,
        left: posicion.left,
        /**
         * **Ancho fijo, y no el del boton.** Se ponia el del ancla con
         * `minWidth`, y entonces el menu crecia con cada etiqueta que se
         * marcaba —que es justo cuando mas se nota— y ademas el menu de
         * plataforma, con sus nombres largos, se comia media pantalla.
         *
         * Un menu es un menu: tiene el ancho que necesita para sus opciones,
         * no el que le happenca el boton que lo abre.
         */
        width: ancho,
        maxHeight: posicion.alto,
        /**
         * La escala sale desde el boton, no desde el centro: el menu tiene que
         * crecer **hacia donde esta el boton**, no encogerse hacia su propia
         * mitad. Y el desplazamiento va en negativo cuando se ha volteado hacia
         * arriba, para que tambien en ese caso salga de debajo del boton.
         */
        '--popover-desplazamiento': posicion.arriba ? '-4px' : '4px',
        transformOrigin: `${lado === 'derecha' ? 'right' : 'left'} ${posicion.arriba ? 'bottom' : 'top'}`,
      } as React.CSSProperties}
      className={[
        'z-50 rounded-lg bg-surface-1 p-1 shadow-lg',
        /**
         * `flex flex-col` solo con `scrollCopia`.
         *
         * El panel pasa a ser una columna de tres cajas —cabecera, lista, pie—
         * y la del medio es la unica con `overflow-y-auto`. La cabecera y el
         * pie se quedan quietas de verdad, sin `sticky`, y la rueda lleva a un
         * sitio unico.
         *
         * Sin esto el panel entero es lo que se desplaza y las dos barras
         * sticky viajan con el: se ven dos superficies moviendose a la vez por
         * un solo gesto de la rueda, y no se sabe cual manda.
         */
        scrollCopia ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overscroll-contain',
        'shadow-black/30 ring-1 ring-line-strong',
        saliendo ? 'animate-popover-out' : 'animate-popover-in',
        className,
      ].join(' ')}
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * Una opcion de un desplegable, con el mismo marcado para todos.
 *
 * Vive aqui y no en el componente que lo usa porque los desplegables —el
 * idioma, la plataforma, el estado y el del editor— necesitan exactamente el
 * mismo: fondo al pasar por encima, check cuando esta elegida, y `tabIndex={-1}`
 * para que la lista se recorra con las flechas y no tabulando opcion por
 * opcion. Lo que cambia entre ellos es el icono y el color, y eso lo pone el
 * llamante.
 */
export function PopoverOption({
  activa,
  resaltada,
  alPulsar,
  alEntrar,
  /** Se dibuja a la derecha: el icono, o el check de la elegida. */
  derecha,
  /** Texto del tooltip, si es distinto de lo que ya se ve. */
  title,
  children,
}: {
  activa: boolean;
  resaltada: boolean;
  alPulsar: () => void;
  alEntrar?: () => void;
  derecha?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
}) {
  /**
   * El rol va **en el boton**, no en un envoltorio.
   *
   * Antes era un `<li role="option">` con `className="contents"` y dentro el
   * boton, y eso rompia el desplazamiento con teclado: un elemento con
   * `display: contents` no genera caja ninguna, asi que su `offsetTop` y su
   * `offsetHeight` son 0, y el ajuste del `scrollTop` que hace el panel para
   * mantener la opcion resaltada a la vista comparaba 0 contra 0 y no hacia
   * nada. Con siete opciones caben todas; con veinte, bajar con las flechas se
   *enia que parar a media pantalla sin poder ver donde estabas.
   *
   * Con el rol en el boton —que si es una caja— las medidas son reales y el
   * ajuste funciona. Ademas el marcado es valido: el panel es un `<div>` y sus
   * opciones son `<button>`, no un `<ul>` con `<div>` y `<p>` dentro, que es lo
   * que habia.
   */
  return (
    <button
      type="button"
      role="option"
      aria-selected={activa}
      tabIndex={-1}
      title={title}
      onClick={alPulsar}
      onMouseEnter={alEntrar}
      className={[
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
        /**
         * Tres fondos distintos, no dos.
         *
         * Antes la marcada y la normal se pintaban igual: `aria-selected` no se
         * ve, y en un filtro de seleccion multiple eso deja a quien lo usa sin
         * forma de saber que ha marcado ya. Es el fallo clasico de estos menus,
         * y la razon de que la seleccion multiple con lista abierta sea mas
         * incomoda de usar de lo que parece.
         *
         * Tres estados porque son tres cosas:
         * - marcada: fondo medio. Es lo que se ha elegido.
         * - resaltada: fondo claro. Es por donde va el teclado, y no tiene por
         *   que estar marcada.
         * - las dos: el claro, que manda.
         */
        resaltada
          ? 'bg-surface-3 text-t1'
          : activa
            ? 'bg-surface-2 text-t1'
            : 'text-t2',
      ].join(' ')}
    >
      {children}
      {derecha}
    </button>
  );
}