import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { IconName } from './icon.component';

/** Una opcion de un grupo de opciones excluyentes. */
export interface ISegmentOption<T> {
  value: T;
  /** Clave de traduccion del texto. */
  label: string;
  icon?: IconName;
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
const TRANSICION = 'transform 260ms cubic-bezier(0.34, 1.3, 0.64, 1), width 260ms cubic-bezier(0.34, 1.3, 0.64, 1)';

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
}: ISegmentedProps<T>) {
  const colores = TONOS[tone];

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
      className="flex shrink-0 flex-col gap-1.5"
    >
      <span
        className={[
          'text-[10px] font-medium tracking-wide uppercase',
          disabled ? 'text-t5' : colores.titulo,
        ].join(' ')}
      >
        {label}
      </span>

      {/*
        El fondo del grupo es plano y sin anillo: lo unico con relieve es la
        pompa. Un fondo un punto mas claro que la barra da la sensacion de
        «hueco por donde meter cosas» sin aadir un solo borde.
      */}
      <div
        ref={pistaRef}
        className={[
          'relative flex items-center rounded-full bg-hover p-1',
          disabled ? 'opacity-40' : '',
        ].join(' ')}
      >
        {pompa !== null ? (
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none absolute top-1 bottom-1 left-0 rounded-full',
              colores.pompa,
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
              title={activo ? undefined : option.label}
              ref={(nodo) => {
                if (nodo) botonesRef.current.set(option.value, nodo);
                else botonesRef.current.delete(option.value);
              }}
              className={[
                'relative z-1 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                'disabled:cursor-not-allowed',
                // Sin pompa: gris apagado. Con pompa: el color del filtro, y
                // el texto encima es el que el tema marca para leerse sobre el.
                activo ? colores.sobrePompa : 'text-t4 hover:text-t2',
              ].join(' ')}
            >
              {option.icon ? <IconGlyph name={option.icon} /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** El icono del boton, del mismo tamano que el texto. */
function IconGlyph({ name }: { name: IconName }) {
  return <span className="text-[13px] leading-none">{GLIFOS[name] ?? '·'}</span>;
}

/**
 * Glifos en texto plano.
 *
 * Se usan en vez de iconos SVG porque en un boton de 28 px de alto un SVG pesa
 * mas que el texto y lo descuadra; ademas el color lo hereda del boton sin
 * tener que pasarle clases.
 *
 * El tipo sale de `IconName`, no de `Record<string, string>`: con el tipo
 * abierto, anadir un icono nuevo a la enumeracion no obliga a decidir aqui si
 * lleva glifo o no, y el `?? '·'` de `IconGlyph` se traga el olvido sin avisar.
 * `Partial` mantiene esa red de seguridad sin fingir que todos los iconos
 * tienen glifo: hoy `check-circle` comparte glifo con `check`, y el resto
 * (flechas, lapiz...) no se usan en este boton y se dibujarian como punto.
 */
const GLIFOS: Partial<Readonly<Record<IconName, string>>> = {
  check: '✓',
  'check-circle': '✓',
  gamepad: '\u{1F3AE}',
  package: '\u{1F4E6}',
  filter: '\u{1F50D}',
  layers: '\u{1F5C2}',
};