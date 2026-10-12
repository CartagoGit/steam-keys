import { useRef, useState } from 'react';

import { Icon, type IconName } from './icon.component';
import { Popover, PopoverOption } from './popover.component';
import { Segmented } from './segmented.component';
import { useT } from '@/context/locale.context';

/** Que boton del par de arriba esta encendido. */
type TAlcance = 'ninguna' | 'todas' | 'parcial';

/** Una opcion del desplegable. */
export interface IFilterOption<T extends string> {
  value: T;
  /** Clave de traduccion. */
  label: string;
  icon?: IconName;
  /** Clase del punto de color, o el icono, para distinguirla de un vistazo. */
  dot?: string;
  /** Cuantas claves hay. `undefined` si el filtro no lo cuenta. */
  count?: number;
}

export interface IFilterMenuProps<T extends string> {
  label: string;
  options: readonly IFilterOption<T>[];
  /** Los marcados. **Vacio significa todos**, no ninguno. */
  selected: readonly T[];
  onChange: (values: readonly T[]) => void;
  /** Texto del boton cuando no hay nada marcado. */
  allLabel: string;
  /** Colores del grupo, para que se distinga de los otros filtros. */
  tone: 'sky' | 'rose';
  disabled?: boolean;
  disabledTitle?: string;
}

/**
 * Los mismos tres colores que en `Segmented`, y por el mismo motivo.
 *
 * El boton lleva el relleno solido del color del filtro y el texto encima en
 * `--on-accent`, que es lo que cada tema marca para leerse sobre su propio
 * acento. Con un color fijo el boton se apagaba entero al cambiar de tema.
 */
const TONOS = {
  sky: {
    relleno: 'bg-info',
    sobreRelleno: 'text-on-accent',
    titulo: 'text-info-strong',
  },
  rose: {
    relleno: 'bg-danger',
    sobreRelleno: 'text-on-accent',
    titulo: 'text-danger-strong',
  },
} as const;

/**
 * Desplegable de seleccion multiple para los filtros de plataforma y estado.
 *
 * Antes eran apretar y soltar: una fila de pastillas directamente en la barra,
 * donde marcar tres plataformas de siete llenaba media linea con siete
 * botones, y en pantallas estrechas empujaba al resto fuera de la vista. Con
 * las «solo disponibles» apagadas, ademas, solo se podia llegar al filtro de
 * estadoFUERA de la barra, porque se apagaba entero —de modo que encender una
 * plataforma ya te quitaba el filtro de estado y viceversa.
 *
 * Aqui no hay pulsacion que se quede pulsada: se abre, se marca lo que se
 * quiera y se cierra. Se puede marcar ninguno, muchos, o todos.
 *
 * **Marcar ninguno no es «ver nada»**, es «ver todo». Es lo que hace el filtro
 * de verdad —una lista vacia de plataformas no restringe nada— y el boton lo
 * dice: si no hay nada marcado pone «Todas», no «Ninguna». Confundir las dos
 * cosas es el error clasico de un filtro de seleccion multiple y la unica
 * forma de evitarlo es decirlo en la etiqueta.
 */
export function FilterMenu<T extends string>({
  label,
  options,
  selected,
  onChange,
  allLabel,
  tone,
  disabled = false,
  disabledTitle,
}: IFilterMenuProps<T>) {
  const { t } = useT();

  const botonRef = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);

  /**
   * Opcion resaltada con el teclado.
   *
   * El desplegable de idioma lo tenia y este no. Es la clase de diferencia que
   * hace que dos menus que se parecen no se comporten igual: en uno se navega
   * con las flechas y en el otro hay que bajar la lista hasta donde se esta con
   * el raton. Los cuatro desplegables de la app tienen que ir igual.
   *
   * `-1` es «ninguna resaltada», que es lo que se quiere con las flechas hacia
   * arriba desde la primera: todavia no se ha movido nada.
   */
  const [resaltada, setResaltada] = useState(-1);

  const colores = TONOS[tone];
  const marcadas = new Set(selected);

  /**
   * Las opciones que se quedan encendidas.
   *
   * Sin ninguna marcada se ofrecen todas. Es el unico estado en el que el
   * boton dice «Todas»: si dejase las opciones apagadas sin marcar nada, se
   * leeria «no has elegido ninguna» y la lista saldria vacia, que no es lo
   * que pasa.
   */
  /** `true` cuando no hay nada marcado: no se filtra, se ve todo. */
  const todas = selected.length === 0;

  /**
   * `true` cuando estan **todas** marcadas.
   *
   * No es lo mismo que `todas`, aunque se vea lo mismo: una es «no has
   * filtrado» y la otra «has pedido todo». El filtro las acepta a las dos,
   * asi que la diferencia solo se ve en el boton, que es donde esta bien que
   * se note: quien marca todo quiere filtros que se puedan quitar.
   */
  const todasTodas = selected.length === options.length && options.length > 0;

  /**
   * Que boton esta encendido en el par de arriba.
   *
   * `parcial` no es una opcion: es el estado en el que **ninguno** de los dos
   * se enciende, que es lo unico que se puede ver cuando el filtro tiene
   * unas cuantas marcadas de siete. Sin el habia que elegir entre dos
   * mentiras: encender «Ninguna» cuando hay tres marcadas, o apagar las dos
   * y no se saber cual de las dos acciones se ha pulsado.
   */
  const alcance: TAlcance = todas ? 'ninguna' : todasTodas ? 'todas' : 'parcial';

  const alternar = (valor: T): void => {
    const siguiente = marcadas.has(valor)
      ? selected.filter((item) => item !== valor)
      : [...selected, valor];

    // Desmarcar la ultima deja la lista vacia, que es «todos». Es lo que se
    // espera al desmarcar: pulsing todo lo marcado es como volver a empezar.
    onChange(siguiente);
  };

  const marcarTodas = (): void => {
    onChange(options.map((option) => option.value));
  };

  const desmarcarTodas = (): void => {
    onChange([]);
  };

  /**
   * Abrir con las flechas, recorrer, y elegir con Enter.
   *
   * `Escape` no esta aqui a proposito: lo lleva `Popover`, que lo captura en
   * fase de captura y detiene la propagacion. Asi el cierre tiene un solo dueno
   * y no se abre otro camino por el que se pueda cerrar la lista y el filtro a
   * la vez.
   */
  const alTeclado = (evento: React.KeyboardEvent): void => {
    const ultimo = options.length - 1;

    switch (evento.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        evento.preventDefault();
        setAbierto(true);
        setResaltada((i) => {
          if (i < 0) return evento.key === 'ArrowDown' ? 0 : ultimo;
          // Al dar la vuelta por un extremo se vuelve al otro, y no se queda
          // encajado: una lista en la que la flecha se para es una lista que
          // parece rota.
          if (evento.key === 'ArrowDown') return i === ultimo ? 0 : i + 1;
          return i === 0 ? ultimo : i - 1;
        });
        break;
      case 'Home':
        evento.preventDefault();
        setResaltada(0);
        break;
      case 'End':
        evento.preventDefault();
        setResaltada(ultimo);
        break;
      case 'Enter':
      case ' ':
        evento.preventDefault();
        if (!abierto) {
          setAbierto(true);
          break;
        }
        if (resaltada >= 0 && resaltada < options.length) {
          const elegida = options[resaltada];
          if (elegida) alternar(elegida.value);
        }
        break;
    }
  };

  return (
    /*
     * Titulo encima y boton debajo, como en `Segmented`. Al lado, cuatro
     * titulos y cuatro controles en una fila hay que parsearlos para saber
     * donde acaba cada filtro; encima, cada filtro es un bloque con su
     * nombre y se lee de un vistazo.
     */
    <div
      onKeyDown={alTeclado}
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

      <button
        ref={botonRef}
        type="button"
        onClick={() => {
          setResaltada(-1);
          setAbierto((v) => !v);
        }}
        disabled={disabled}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        title={disabled ? disabledTitle : label}
        className={[
          'inline-flex items-center justify-between gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'disabled:cursor-not-allowed',
          // Relleno solido con el color del filtro, como la pompa del
          // interruptor. Sin nada marcado esta apagado —no se esta filtrando—
          // y en cuanto se marca algo se enciende entero. El menu abierto no
          // lo enciende: abrirlo no es filtrar.
          todas ? 'bg-hover text-t4' : [colores.relleno, colores.sobreRelleno].join(' '),
          disabled ? 'opacity-40' : '',
        ].join(' ')}
      >
        {todas ? <span>{allLabel}</span> : <span className="tabular-nums">{marcadas.size}</span>}

        {/* La flecha va en la tinta del propio boton, no en un color fijo. */}
        <svg
          viewBox="0 0 12 12"
          width="10"
          height="10"
          aria-hidden="true"
          className={[
            'shrink-0 transition-transform',
            abierto ? 'rotate-180' : '',
            todas ? 'text-t5' : 'opacity-70',
          ].join(' ')}
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {abierto ? (
        /*
         * `esLista={false}` porque el panel no es solo la lista: lleva el par
         * de arriba y la nota de abajo. El rol de lista va en la lista de
         * dentro; un `listbox` con botones y un parrafo miente sobre lo que
         * contiene y el lector de pantalla anuncia «lista de 2 elementos» y se
         * encuentra con mas cosas.
         */
        <Popover
          abierto
          esLista={false}
          ancla={botonRef}
          resaltada={resaltada}
          altoMaximo={320}
          onCerrar={() => setAbierto(false)}
        >
          {/*
            El par de «todo» va **arriba**, antes de la lista. Cuando el filtro
            no filtra nada —que es el estado normal— «Todas» y «Ninguna» son lo
            unico que hay que tocar, y tener que bajar hasta el final de siete
            opciones para llegar es lo que hace que la gente se quede con la
            seleccion a medias.

            Va con `Segmented`, y no con dos botones: es la misma pompa que se
            mueve al cambiar de opcion que la de «Disponibles» y «Tipo», y es
            lo que hace que cambiar «Ninguna» a «Todas» se vea como un cambio y
            no como un parpadeo de dos textos. El selector de fuera y el de
            dentro se mueven igual porque son el mismo componente.

            Cada uno dice en que estado se deja el filtro:

            - nada marcado: se ve todo. Es «Ninguna» la que esta encendida.
            - todas marcadas: se ve todo tambien, pero filtrando de verdad.
              Es «Todas».
            - unas cuantas: no hay ninguna de las dos, que es lo que hay que
              poder ver para saber que el filtro esta a medias.

            Asi que marcar todo y no marcar nada son estados distintos —«no has
            filtrado» y «has pedido todo»—, y se distinguen porque el boton
            encendido lo dice. Con `parcial` ninguno se enciende, que es
            exactamente lo que hay que mostrar.
          */}
          <div className="sticky top-0 z-1 border-b border-line bg-surface-1 p-1.5">
            <Segmented
              label={t('filter.menu.scope')}
              sinTitulo
              compacto
              tone={tone === 'sky' ? 'sky' : 'rose'}
              value={alcance}
              options={[
                { value: 'ninguna', label: t('filter.menu.none') },
                { value: 'todas', label: allLabel },
              ]}
              onChange={(nuevo) => {
                if (nuevo === 'todas') marcarTodas();
                else desmarcarTodas();
              }}
            />
          </div>

          {/*
            Sin `overflow-y-auto` aqui: el scroll es del panel, uno solo.

            Este bloque tenia su propio `max-h-64 overflow-y-auto` y el panel
            tambien se desplazaba, asi que se veian **dos barras de scroll** a
            la vez: la de fuera para todo el menu y la de dentro para las
            opciones. Con siete plataformas el menu parecia una ventana dentro
            de otra ventana, y no se sapedia cual de las dos tocaba.

            Aqui solo se marca la lista como tal; quien se desplaza es el
            panel. La cabecera y el pie van `sticky` para que sigan en su sitio
            al recorrer las opciones, que es para lo que estan.
          */}
          <div role="listbox" aria-multiselectable aria-label={label} className="py-1">
            {options.map((option, indice) => {
              const marcada = marcadas.has(option.value);

              return (
                <PopoverOption
                  key={option.value}
                  activa={marcada}
                  resaltada={indice === resaltada}
                  alEntrar={() => setResaltada(indice)}
                  alPulsar={() => alternar(option.value)}
                >
                  {option.dot ? (
                    <span
                      aria-hidden="true"
                      className={['h-2 w-2 shrink-0 rounded-full', option.dot].join(' ')}
                    />
                  ) : option.icon ? (
                    /*
                     * Icono de verdad, no glifo. En un boton de 28 px un SVG
                     * descuadra la linea y por eso hay una tabla de texto, pero
                     * en una fila de lista de 32 px cabe bien —y media tabla
                     * de plataformas no tiene glifo, con lo que se veian
                     * puntos suspensivos de reserva.
                     */
                    <Icon name={option.icon} size={13} className="shrink-0 text-t4" />
                  ) : null}

                  <span className="min-w-0 flex-1 truncate">{t(option.label)}</span>

                  {option.count === undefined ? null : (
                    <span className="shrink-0 text-[10px] tabular-nums text-t4">
                      {option.count}
                    </span>
                  )}
                </PopoverOption>
              );
            })}
          </div>

          {/*
            El pie dice lo que significa no marcar nada, porque es la parte que
            no se deduce. Alguien ve siete opciones sin marcar, el boton dice
            «Todas» y no es obvio que sea «ninguna marcada = todas».

            Va `sticky` abajo por lo mismo que la cabecera: si las opciones son
            muchas, la nota no puede ser lo primero que se vaya al bajar.
          */}
          <p className="sticky bottom-0 border-t border-line bg-surface-1 px-3 py-2 text-[10px] leading-relaxed text-t4">
            {t('filter.menu.footHint')}
          </p>
        </Popover>
      ) : null}
    </div>
  );
}
