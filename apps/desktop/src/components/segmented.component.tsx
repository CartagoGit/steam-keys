import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { Icon, type IconName } from './icon.component';

/** Una opcion de un grupo de opciones excluyentes. */
export interface ISegmentOption<T> {
  value: T;
  /** Clave de traduccion del texto. */
  label: string;
  /** Icono delante del texto. Va a SVG, no a glifo. */
  icon?: IconName;
  /**
   * Texto del tooltip, si es distinto de lo que ya se ve.
   *
   * El tooltip solo se esconde en la opcion elegida cuando **no** hay texto
   * propio, porque ahi lo que se pone de mas es el mismo nombre. En cuanto se
   * da uno, se enseña siempre: es el contador de la fila de arriba, y ese no
   * hay que ir a buscarlo con el raton.
   */
  title?: string;
}

export interface ISegmentedProps<T extends string> {
  options: readonly ISegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * Por que no se puede cambiar ahora mismo. Si viene, el grupo entero se
   * apaga y el tooltip lo explica.
   */
  disabled?: boolean;
  /** Texto del tooltip cuando esta apagado. */
  disabledTitle?: string;
  /** Colores del grupo: cambia segun para que sirve cada filtro. */
  tone?: 'emerald' | 'amber' | 'sky' | 'rose';
  /** Nombre accesible del grupo. */
  label: string;
  /**
   * Sin el nombre encima, para cuando el selector va **dentro** de otro sitio
   * que ya dice de que es: el desplegable de filtros, o una fila de un
   * dialogo. El titulo ahi duplicaria lo que ya esta escrito justo encima y
   * gastaria tres lineas de alto del menu.
   */
  sinTitulo?: boolean;
  /** Mas bajo y sin respiro, para menus. */
  compacto?: boolean;
  /**
   * Ocupa todo el ancho de donde esta.
   *
   * Es para los desplegables, que se abren en un panel con su propia medida: el
   * selector tiene que llenar el panel o se queda en una esquina con un hueco
   * al lado que parece un error de maquetacion.
   *
   * **No se hereda de `sinTitulo`.** Lo estaba, y al usarlo «Claves / Mis
   * juegos» en la cabecera se llevo el 100 % del ancho del contenedor y se fue
   * a su propia fila: era un selector de dos palabras de 120 px, pero pedia
   * el ancho entero. Los dos son selectores sin titulo y solo uno quiere
   * estirarse, asi que son dos cosas distintas.
   */
  completo?: boolean;
  /**
   * Redondeado o casi recto.
   *
   * La pastilla entera (`rounded-full`) es la forma de una pastilla: por eso la
   * usan los filtros, que son chips. En un selector de pestanas —«Claves» /
   * «Mis juegos»— la capsula casi redonda queda rara: son palabras, no
   * etiquetas, y el borde se dobla tanto que no se ve donde empieza el boton.
   * `recta` los deja como botones, que es lo que son.
   */
  forma?: 'redonda' | 'recta';
  /**
   * Que **ninguna** opcion este encendida, pero el grupo siga siendo el que
   * manda en lo que hay marcado.
   *
   * Es el estado «estoy filtrando, pero ni del todo». Antes de esto, al marcar
   * tres de siete plataformas el par «Ninguna / Todas» se quedaba sin ninguna de
   * las dos encendida y la pompa se quedaba a medio camino de un salto: el
   * relleno se mantenia puesto y el texto volvia a gris encima de el, que es
   * justo el color que no se lee.
   *
   * Con esto la pompa se **desvanece en su sitio** y el texto se devuelve a su
   * gris con su propia transicion. Las dos cosas tardan lo mismo, asi que se
   * leen como un solo gesto: la pastilla se suelta y el texto se apaga, en vez
   * de que el relleno se quede puesto con el texto gris encima.
   */
  parcial?: boolean;
}

/**
 * Los tres colores de un filtro, y porque son tres.
 *
 * `pompa` es el relleno solido de la opcion elegida; `sobrePompa` es el
 * texto que va **encima** de ese relleno, y `titulo` el del nombre del
 * filtro. Los tres hacen falta y no se pueden reducir a dos.
 *
 * El texto de la pompa no es «un color mas claro»: es `--on-accent`, que cada
 * tema define para que se lea sobre su propio acento. Aplicado aqui suena
 * aproximado —el relleno es `--ok`, no `--accent`— pero funciona porque en
 * todos los temas el acento y los colores con significado tienen la misma
 * luminosidad: en los oscuros son claros y el texto encima es casi negro; en
 * los claros son oscuros y el texto encima es blanco. Con un color fijo
 * («negro» o «blanco») el selector se apagaba entero al cambiar de tema, que
 * es justo el fallo que las variables semanticas existen para evitar.
 */
const TONOS = {
  emerald: { pompa: 'bg-ok', sobrePompa: 'text-on-accent', titulo: 'text-ok-strong' },
  amber: { pompa: 'bg-warn', sobrePompa: 'text-on-accent', titulo: 'text-warn-strong' },
  sky: { pompa: 'bg-info', sobrePompa: 'text-on-accent', titulo: 'text-info-strong' },
  rose: { pompa: 'bg-danger', sobrePompa: 'text-on-accent', titulo: 'text-danger-strong' },
} as const;

/**
 * Como se mueve la pompa.
 *
 * La curva se pasa del 1: sale disparada, se pasa y aterriza. Sin ese exceso
 * de 0.3 el desplazamiento es un deslizamiento correcto y a la vez plano, que
 * es exactamente lo que parece un fallo de rendimiento.
 *
 * Se declara **`transform` y `width`, nunca `left`**: `left` no esta en la
 * lista y por eso el cambio de posicion se teletransportaba. Con la posicion
 * en `left` y la transicion en `transform` —que es como se escribio la
 * primera vez— la pompa saltaba de un boton a otro sin moverse, y lo unico
 * que animaba era un `transform: none` que no cambia nunca.
 */
const TRANSICION = 'transform 260ms cubic-bezier(0.34, 1.3, 0.64, 1), width 260ms cubic-bezier(0.34, 1.3, 0.64, 1), opacity 200ms ease-out';

/** El mismo radio, en clase, para la pista y para la pompa. */
const CURVAS = { redonda: 'rounded-full', recta: 'rounded-md' } as const;

/** Donde esta la pompa, en pixeles dentro del grupo. */
interface IPosicion {
  desplazamiento: number;
  ancho: number;
}

/**
 * Grupo de opciones excluyentes con una pompa que se desliza de una a otra.
 *
 * Que la pompa se mueva no es adorno: el desplazamiento dice **cual de las
 * dos cosas se ha cambiado y hacia donde**, y eso un cambio de color no lo
 * cuenta. Sin el, pasar de «Todos» a «Solo disponibles» parece un parpadeo
 * sin causa, y en un filtro eso es justo la duda que hace falta para no
 * fiarse de lo que se ve.
 *
 * **Sin bordes, ni dentro ni fuera.** Antes cada boton llevaba su anillo y el
 * grupo otro, y con cinco anillos en pantalla el filtro que deberia estar en
 * segundo plano competia por la atencion con el que se ha pulsado. Ahora solo
 * hay una superficie —la pompa— y el texto encima: lo demas se apaga.
 *
 * La pompa se mide con `getBoundingClientRect` en vez de calcular la posicion
 * con los anchos del texto, porque las etiquetas estan traducidas y «Solo
 * juegos» mide otra cosa que «Solo DLC». Medir es lo unico que funciona con
 * los cinco idiomas sin mantener una tabla de anchos que se queda vieja en
 * cuanto se toca una frase.
 *
 * El titulo va **encima** y no al lado. Al lado, cuatro titulos y cuatro
 * controles en una fila se leen como una frase larga de la que hay que
 *parsingar donde acaba cada filtro; encima, cada filtro es un bloque
 * con su nombre, y se lee sin esfuerzo.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  disabledTitle,
  tone = 'emerald',
  label,
  sinTitulo = false,
  compacto = false,
  completo = false,
  forma = 'redonda',
  parcial = false,
}: ISegmentedProps<T>) {
  const colores = TONOS[tone];
  const curva = CURVAS[forma];

  const pistaRef = useRef<HTMLDivElement>(null);
  const botonesRef = useRef(new Map<string, HTMLButtonElement>());
  const [pompa, setPompa] = useState<IPosicion | null>(null);

  const medir = useCallback((): void => {
    const pista = pistaRef.current;
    const activo = botonesRef.current.get(value);

    if (!pista || !activo) return;

    const cajaPista = pista.getBoundingClientRect();
    const cajaActivo = activo.getBoundingClientRect();

    setPompa({
      desplazamiento: cajaActivo.left - cajaPista.left,
      ancho: cajaActivo.width,
    });
  }, [value]);

  /**
   * Se mide antes de pintar y se vuelve a medir al cambiar el ancho de la
   * ventana.
   *
   * `useLayoutEffect` y no `useEffect` porque si se midiera despues, la pompa
   * apareceria en 0,0 y saltaria a su sitio en el primer fotograma: un
   * parpadeo en cada arranque del componente, que es justo cuando la persona
   * ya esta mirando.
   *
   * El `ResizeObserver` es lo que la mantiene en su sitio cuando el texto
   * cambia de idioma o la ventana se estrecha. Sin el, la pompa se queda con
   * el ancho de la traduccion anterior y tapa medio boton.
   */
  useLayoutEffect(() => {
    medir();

    const pista = pistaRef.current;

    if (!pista || typeof ResizeObserver === 'undefined') return;

    const observador = new ResizeObserver(() => medir());

    observador.observe(pista);
    window.addEventListener('resize', medir);

    return () => {
      observador.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [medir, options.length]);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      title={disabled ? disabledTitle : undefined}
      className={
        completo
          ? 'flex w-full'
          : sinTitulo
            ? 'flex'
            : 'flex shrink-0 flex-col gap-1.5'
      }
    >
      {sinTitulo ? null : (
        <span
          className={[
            'text-[10px] font-medium tracking-wide uppercase',
            disabled ? 'text-t5' : colores.titulo,
          ].join(' ')}
        >
          {label}
        </span>
      )}

      {/*
        El fondo del grupo es plano y sin anillo: lo unico con relieve es la
        pompa. Un fondo un punto mas claro que la barra da la sensacion de
        «hueco por donde meter cosas» sin aadir un solo borde.
      */}
      <div
        ref={pistaRef}
        className={[
          'relative flex items-center bg-hover',
          curva,
          completo ? 'flex-1' : '',
          compacto ? 'p-0.5' : 'p-1',
          disabled ? 'opacity-40' : '',
        ].join(' ')}
      >
        {pompa !== null ? (
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none absolute top-1 bottom-1 left-0',
              curva,
              compacto ? 'top-0.5 bottom-0.5' : '',
              colores.pompa,
              /**
               * En `parcial` la pompa se queda **puesta pero invisible**, en vez
               * de desaparecer del DOM. Si se desmontase, al volver a un estado
               * con una opcion elegida tendria que volver a medirse, y como
               * `medir` no encuentra boton activo devuelve sin hacer nada: la
               * pompa se quedaria en 0,0 durante un fotograma y saltaria desde
               * la esquina del grupo. Desvaneciendola se mantiene la posicion
               * medida y solo cambia la opacidad, que es lo unico que hace falta
               * para la lectura.
               */
              parcial ? 'opacity-0' : '',
            ].join(' ')}
            style={{
              // La posicion va en `transform` porque es lo unico que
              // transiciona; si fuera `left` saltaria de golpe.
              transform: `translateX(${pompa.desplazamiento}px)`,
              width: pompa.ancho,
              transition: TRANSICION,
            }}
          />
        ) : null}

        {options.map((option) => {
          const activo = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={activo}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              title={option.title ?? (activo ? undefined : option.label)}
              ref={(nodo) => {
                if (nodo) botonesRef.current.set(option.value, nodo);
                else botonesRef.current.delete(option.value);
              }}
              className={[
                'relative z-1 inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors',
                curva,
                compacto ? 'flex-1 px-2 py-1 text-[11px]' : 'px-3.5 py-1 text-xs',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                'disabled:cursor-not-allowed',
                /**
                 * Con pompa: el color del filtro, y el texto encima es el que el
                 * tema marca para leerse sobre el.
                 *
                 * En `parcial` no hay pompa visible —se esta desvaneciendo— asi
                 * que el texto vuelve a su gris. Como el relleno tarda 200 ms en
                 * irse y el color tambien, los dos cambios se leen como uno
                 * solo en vez de dejar el texto claro encima de un relleno que
                 * ya casi no se ve.
                 */
                activo && !parcial ? colores.sobrePompa : 'text-t4 hover:text-t2',
              ].join(' ')}
            >
              {option.icon ? (
                <Icon
                  name={option.icon}
                  size={compacto ? 11 : 13}
                  className="shrink-0 opacity-90"
                />
              ) : null}

              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}