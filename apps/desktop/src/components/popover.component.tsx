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
  /** Indice de la opcion resaltada, para mantenerla a la vista. */
  resaltada?: number;
  className?: string;
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

/** Donde va la lista, en pixeles desde el borde de la ventana. */
interface IPosicion {
  top: number;
  left: number;
  alto: number;
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
  resaltada,
  className = '',
  children,
}: IPopoverProps) {
  const panelRef = useRef<HTMLUListElement>(null);
  const [posicion, setPosicion] = useState<IPosicion | null>(null);

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

    const left = lado === 'derecha' ? caja.right - caja.width : caja.left;

    setPosicion({
      top: arriba ? caja.top - SEPARACION - alto : caja.bottom + SEPARACION,
      left: Math.max(
        MARGEN,
        Math.min(left, window.innerWidth - caja.width - MARGEN),
      ),
      alto,
    });
  }, [altoMaximo, ancla, lado]);

  useLayoutEffect(() => {
    if (!abierto) {
      setPosicion(null);
      return;
    }

    colocar();
  }, [abierto, colocar]);

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
   * Mantiene la opcion resaltada a la vista, **solo** dentro de la lista.
   *
   * Se ajusta el `scrollTop` del panel a mano en vez de usar
   * `scrollIntoView`, y no por falta de ganas: `scrollIntoView` desplaza
   * tambien cualquier ancestro que se pueda mover, que es precisamente el bote
   * del dialogo que este componente viene a quitar. A mano no puede tocar nada
   * mas.
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

  if (!abierto || posicion === null) return null;

  return createPortal(
    <ul
      ref={panelRef}
      role="listbox"
      style={{
        position: 'fixed',
        top: posicion.top,
        left: posicion.left,
        minWidth: ancla.current?.offsetWidth,
        maxHeight: posicion.alto,
      }}
      className={[
        'z-50 overflow-auto overscroll-contain rounded-lg bg-surface-1 p-1 shadow-lg',
        'shadow-black/30 ring-1 ring-line-strong',
        className,
      ].join(' ')}
    >
      {children}
    </ul>,
    document.body,
  );
}

/**
 * Una opcion de un desplegable, con el mismo marcado para todos.
 *
 * Vive aqui y no en el componente que lo usa porque los tres desplegables —el
 * idioma, la plataforma y el estado— necesitan exactamente el mismo: fondo al
 * pasar por encima, check cuando esta elegida, y `tabIndex={-1}` para que la
 * lista se recorra con las flechas y no tabulando opcion por opcion. Lo que
 * cambia entre ellos es el icono y el color, y eso lo pone el llamante.
 */
export function PopoverOption({
  activa,
  resaltada,
  alPulsar,
  alEntrar,
  /** Se dibuja a la derecha: el icono, o el check de la elegida. */
  derecha,
  children,
}: {
  activa: boolean;
  resaltada: boolean;
  alPulsar: () => void;
  alEntrar?: () => void;
  derecha?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li
      role="option"
      aria-selected={activa}
      className="contents"
      onMouseEnter={alEntrar}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={alPulsar}
        className={[
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
          resaltada ? 'bg-surface-3 text-t1' : 'text-t2',
        ].join(' ')}
      >
        {children}
        {derecha}
      </button>
    </li>
  );
}
