import { useRef, useState } from 'react';

import { Icon, type IconName } from './icon.component';
import { Popover, PopoverOption } from './popover.component';
import { useT } from '@/context/locale.context';

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
   * Escape cierra la lista.
   *
   * El `Popover` ya lo captura en fase de captura y detiene la propagacion, de
   * modo que esto no corre: esta aqui para que quede claro que el cierre
   * tiene un solo dueño, y no se abra otro camino por el que se pueda cerrar
   * la lista y el filtro a la vez.
   */
  return (
    /*
     * Titulo encima y boton debajo, como en `Segmented`. Al lado, cuatro
     * titulos y cuatro controles en una fila hay que parsearlos para saber
     * donde acaba cada filtro; encima, cada filtro es un bloque con su
     * nombre y se lee de un vistazo.
     */
    <div className="flex shrink-0 flex-col gap-1.5">
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
        onClick={() => setAbierto((v) => !v)}
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
        <Popover abierto ancla={botonRef} onCerrar={() => setAbierto(false)}>
          {/*
            Las dos acciones de «todo» van **arriba**, antes de la lista. Cuando
            el filtro no filtra nada —que es el estado normal — «Todas» y
            «Ninguna» son lo unico que hay que tocar, y tener que bajar hasta
            el final de siete opciones para llegar es lo que hace que la gente
            se quede con la seleccion a medias.
          */}
          <div className="flex gap-1 border-b border-line p-1.5">
            {/*
              «Todas» y «Ninguna» son un par conmutivo, no dos acciones.

              No se apagan nunca. Apagarlas era lo de antes, y dejaba el menu
              de un filtro sin tocar con **los dos botones muertos** y ninguna
              accion a la vista, cuando las dos cosas se podian hacer. Ahora
              cada uno dice en que estado se deja el filtro:

              - nada marcado: se ve todo. Es «Ninguna» la que esta encendida.
              - todas marcadas: se ve todo tambien, pero filtrando de verdad.
                Es «Todas».
              - unas cuantas: no hay ninguna de las dos, que es lo que hay que
                poder ver para saber que el filtro esta a medias.

              Asi que marcar todo y no marcar nada son estados distintos —
              «no has filtrado» y «has pedido todo»—, y se distinguen porque el
              boton encendido lo dice.
            */}
            <button
              type="button"
              onClick={desmarcarTodas}
              aria-pressed={todas}
              className={[
                'flex-1 rounded-md px-2 py-1 text-[11px] transition',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                todas ? 'bg-hover-2 text-t1' : 'text-t3 hover:bg-hover hover:text-t1',
              ].join(' ')}
            >
              {t('filter.menu.none')}
            </button>

            <button
              type="button"
              onClick={marcarTodas}
              aria-pressed={todasTodas}
              className={[
                'flex-1 rounded-md px-2 py-1 text-[11px] transition',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                todasTodas ? 'bg-hover-2 text-t1' : 'text-t3 hover:bg-hover hover:text-t1',
              ].join(' ')}
            >
              {allLabel}
            </button>
          </div>

          <ul className="max-h-64 overflow-y-auto py-1" role="listbox" aria-multiselectable>
            {options.map((option) => {
              const marcada = marcadas.has(option.value);

              return (
                <PopoverOption
                  key={option.value}
                  activa={marcada}
                  resaltada={false}
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
          </ul>

          {/*
            El pie dice lo que significa no marcar nada, porque es la parte que
            no se deduce. Alguien ve siete opciones sin marcar, el boton dice
            «Todas» y no es obvio que sea «ninguna marcada = todas».
          */}
          <p className="border-t border-line px-3 py-2 text-[10px] leading-relaxed text-t4">
            {t('filter.menu.footHint')}
          </p>
        </Popover>
      ) : null}
    </div>
  );
}
