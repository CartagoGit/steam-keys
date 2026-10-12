import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { Icon, type IconName } from './icon.component';
import { Popover, PopoverOption } from './popover.component';
import { Segmented } from './segmented.component';
import { useT } from '@/context/locale.context';

/** Que boton del par de arriba esta encendido. */
type TAlcance = 'ninguna' | 'todas' | 'parcial';

/**
 * Los tags marcados se apilan **por columna**, de dos en dos.
 *
 * Se llena una columna entera antes de abrir la siguiente: el primero, el
 * segundo debajo, y el tercero ya a la derecha. Es como se leen las listas de
 * etiquetas de las demas herramientas.
 *
 * Y al crecer solo hacia un lado, **la barra de filtros no cambia de alto**:
 * el filtro de al lado se desplaza, la fila no.
 *
 * **No hay tope de cuantos se muestran.** Habia uno, y con cuatro marcadas
 * salia un «+1» en vez del tag: contar no es ver. Al crecer solo en horizontal
 * no hace falta esconder nada.
 *
 * El ancho de un tag sale de su texto, con un maximo para que un nombre muy
 * largo no se lleve media barra. Lo que no cabe se recorta y lleva el nombre
 * entero en el `title`.
 */
const FILAS_POR_COLUMNA = 2;

/** Ancho maximo de un tag. Lo que pase, se recorta. */
const ANCHO_MAX_TAG = '9rem';

/** Alto de un chip. */
const ALTO_CHIP = 'h-5';

/** Separacion entre chips de la misma columna. */
const ESPACIO_CHIPS = 'gap-1';

/**
 * Alto de la columna: dos chips y su separacion.
 *
 * **Va fijo y no sale de la medicion.** Si fuera lo que ocupan los chips,
 * cada tag que se marcase haria el bloque del filtro mas alto, y con el la
 * fila entera, que es el descentrado que se corrigio antes.
 *
 * Y aun asi44 no cabe en el alto del boton, que es 40. Por eso la caja va
 * en `absolute` y el envoltorio no mide: la columna cuelga del boton hacia
 * abajo en vez de encadrarse con el. Ocupa ancho —que es lo que tiene que
 * hacer— pero no ocupa alto, y la barra no se entera en vertical.
 *
 * Esta atado a `ALTO_CHIP` y `ESPACIO_CHIPS` a proposito: si el chip cambia
 * de alto, el unico sitio que hay que tocar es este.
 */
const ALTO_COLUMNA = '2.75rem';

/** Tamano del texto del chip. Va aqui porque las utilidades no llegan. */
const TAMANO_CHIP = '10px';

/** Cuanto tarda en deslizarse la columna al aparecer o desaparecer un tag. */
const TRANSICION_TAGS = 'width 240ms cubic-bezier(0.34, 1.3, 0.64, 1)';

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
  tone: 'sky' | 'rose' | 'violet';
  /**
   * Nota de abajo del menu. Por defecto la de los filtros de siempre, que
   * habla de «marcar varias, solo esas».
   *
   * El de etiquetas necesita la suya porque **cambia el significado**: varias
   * marcadas son OR —sale lo que lleva alguna—, no AND. Sin decirlo, quien
   * marca «canducadas» y «regalo» esperando las dos se encuentra con mas de lo
   * que pedia y no sabe si el filtro va mal.
   */
  footHint?: string;
  /**
   * Que las marcadas se combinen con «y» en vez de con «o».
   *
   * `false` por defecto: sale lo que lleva cualquiera de ellas. `true`: hay que
   * llevarlas todas. Solo tiene sentido con dos o mas marcadas, y con una da
   * lo mismo en los dos modos.
   *
   * El boton lleva el candado **solo cuando esta activo**: antes de decidir no
   * hay nada que avisar, y un icono permanente seria ruido en los tres filtros
   * que de normal no lo usan.
   */
  excluir?: boolean;
  onExcluir?: (excluir: boolean) => void;
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
  violet: {
    relleno: 'bg-accent',
    sobreRelleno: 'text-on-accent',
    titulo: 'text-accent',
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
  footHint = 'filter.menu.footHint',
  excluir = false,
  onExcluir,
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

  /**
   * Los marcados, en el orden en que salen en la lista y con un tope.
   *
   * El tope es a proposito: sin el, marcar las siete plataformas ocupa el ancho
   * de media barra y empuja al resto de filtros fuera de la vista, que es justo
   * lo que vino a resolver este desplegable. Con tres mas el «+N», se ve
   * cuales son sin poder estar mirando como crece la fila.
   */
  const opcionesVisibles = options.filter((option) => marcadas.has(option.value));

  /**
   * Cuanto ocupa la columna de tags, en pixeles.
   *
   * Se **mide** y se pone a mano en vez de dejarlo al `flex`, porque un ancho
   * que decide el navegador en la misma pasada en que se pinta no se puede
   * transicionar: no hay estado intermedio entre el ancho viejo y el nuevo, y
   * el filtro de al lado se teletransporta en vez de desplazarse.
   *
   * La medida sale de una caja invisible con `max-content`, que se ajusta al
   * contenido aunque la de fuera le imponga otro ancho. Asi lo que se mide es
   * lo que **pediria** la rejilla, no lo que queda recortado.
   *
   * Empieza en cero para que en el primer pintado no haya un salto: sin tags el
   * ancho es cero de verdad, no «cero que luego se corrige».
   */
  const medidaRef = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState({ ancho: 0 });

  useLayoutEffect(() => {
    const caja = medidaRef.current;

    if (!caja) return;

    const leer = (): void => {
      const ancho = caja.offsetWidth;

      setMedida((anterior) => (anterior.ancho === ancho ? anterior : { ancho }));
    };

    leer();

    /**
     * Los tags cambian de texto al cambiar de idioma, asi que el ancho tambien.
     * Sin el observador, al cambiar de idioma la columna se queda con el ancho
     * del idioma anterior y el filtro de al lado se queda donde estaba.
     */
    if (typeof ResizeObserver === 'undefined') return;

    const observador = new ResizeObserver(leer);

    observador.observe(caja);

    return () => observador.disconnect();
  }, [opcionesVisibles.length]);

  /**
   * El `title` del boton dice cuales son, todos.
   *
   * Los chips solo enseñan los primeros, y el resto son un «+3» que no dice
   * cuales. Al pasar por encima se ve la lista entera, que es el sitio donde
   * uno se para un momento y lee.
   */
  const resumen =
    marcadas.size === 0
      ? allLabel
      : opcionesVisibles.map((option) => t(option.label)).join(', ');

  const { ancho: anchoTags } = medida;

  /**
   * El chip, **el mismo** para el que se ve y para el que mide.
   *
   * Escribirlos por separado es tentador —uno lleva fondo y `title`, el otro
   * ni se ve— y no funciona: estuvo escrito asi y se separaron de tres formas
   * distintas a la vez, sin que nada protestara.
   *
   * - El que mide no llevaba `text-[10px]`, asi que media los tags a 16 px. El
   *   ancho salia un 60 % mayor y la columna se comia 71 px de aire a la
   *   derecha de los chips. Ese era el hueco fantasma.
   * - Solo el que media llevaba el tope de ancho, de modo que en cuanto un
   *   nombre largo lo tocaba los dos dabian numeros distintos.
   *
   * Ahora los dos son el mismo elemento y lo unico que cambia es si se ve.
   *
   * Y el tamano va en el `style`, no en la clase. Hay una regla en el CSS que
   * pone `font: inherit` a los botones, y como `font` es el atajo completo
   * pisa tambien el tamano: una utilidad `text-[10px]` no llega nunca a
   * aplicarse. El `style` si, porque gana a todo lo demas.
   */
  const chip = (option: IFilterOption<T>, visible: boolean): ReactNode => (
    <span
      key={String(option.value)}
      title={visible ? t(option.label) : undefined}
      className={[
        ['flex min-w-0 items-center gap-1 px-1.5 leading-none', ALTO_CHIP].join(' '),
        visible ? 'overflow-hidden rounded-md bg-surface-2 text-t2' : '',
      ].join(' ')}
      style={{ maxWidth: ANCHO_MAX_TAG, fontSize: TAMANO_CHIP }}
    >
      {option.dot ? (
        <span
          aria-hidden="true"
          className={['h-1.5 w-1.5 shrink-0 rounded-full', option.dot].join(' ')}
        />
      ) : option.icon ? (
        <Icon name={option.icon} size={9} className="shrink-0 opacity-80" />
      ) : null}

      <span className="truncate">{t(option.label)}</span>
    </span>
  );

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
   * Teclado en `window`, no en un `onKeyDown` del boton.
   *
   * Estaba como `onKeyDown` en el `<div>` que envuelve el boton, y por eso
   * **no funcionaba al abrir con Enter**. La razon es que `Popover` se monta en
   * `document.body` con un portal: en cuanto la lista esta abierta, el elemento
   * que tiene el foco ya no esta dentro de ese `<div>`, es un hermano suyo en el
   * `body`. El evento sube hasta `body` y alli se queda: nunca llega al
   * envoltorio. Con el raton no se notaba —el clic va directo al `onClick` del
   * boton—, pero con el teclado el `Enter` no abria nada y no habia forma de
   * llegar a las opciones.
   *
   * Con un listener en `window` en fase de captura da igual donde este el foco:
   * se coje antes que nadie. Es lo mismo que hace `Popover` con Escape, y por
   * eso los dos estan en el mismo sitio y no en dos capas distintas.
   *
   * Se guarda `abierto`, `options` y `resaltada` en refs para que el listener no
   * se vuelva a crear en cada cambio y no tenga que depender de ellos.
   */
  const estadoRef = useRef({ abierto, opciones: options, resaltada });

  estadoRef.current = { abierto, opciones: options, resaltada };

  useEffect(() => {
    if (disabled) return;

    const alPulsar = (evento: KeyboardEvent): void => {
      const { abierto: estaAbierto, opciones: lista, resaltada: marca } =
        estadoRef.current;

      // El foco tiene que estar en este desplegable. Sin esto, las flechas
      // moverian el resaltado de «Plataforma» mientras se esta jugando con el
      // desplegable de «Estado» de al lado.
      const activo = document.activeElement;

      const mio =
        botonRef.current?.contains(activo) ||
        (activo instanceof HTMLElement && activo.getAttribute('role') === 'option');

      if (!mio) return;

      const ultimo = lista.length - 1;

      switch (evento.key) {
        case 'ArrowDown':
        case 'ArrowUp':
          evento.preventDefault();
          if (!estaAbierto) {
            setAbierto(true);
            setResaltada(evento.key === 'ArrowDown' ? 0 : ultimo);
            return;
          }
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
          if (!estaAbierto) {
            setAbierto(true);
            return;
          }
          if (marca >= 0 && marca < lista.length) {
            const elegida = lista[marca];
            if (elegida) alternar(elegida.value);
          }
          break;
      }
    };

    window.addEventListener('keydown', alPulsar, true);

    return () => window.removeEventListener('keydown', alPulsar, true);
  }, [disabled]);

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

      {/*
        Los marcados salen **a la derecha** del boton, en su propia columna.

        Estaban dentro, y era un error por partida doble: el boton media lo que
        median los tags, con lo que el desplegable se estira y empuja a los
        demas filtros de la barra fuera de la vista —justo el problema que vino
        a resolver este filtro—, y ademas el numero y el nombre del filtro
        acababan mezclados en el mismo sitio, sin saber donde acababa el boton
        y empezaba la cuenta.

        Ahora el boton mide lo que siempre —«Todas» o el numero— y los tags
        ocupan una columna de ancho fijo a su derecha. El ancho de los tags no
        depende de cuantos haya: son tres huecos fijos, y cambiar de tres a uno
        no mueve el filtro de estado que viene despues.

        Se apilan por filas de dos y bajan a la siguiente. Con nombres largos
        —«Elder Scrolls Online»— en una sola fila habia que recortar tanto que
        no seidia nada; en dos columnas caben dos nombres enteros y el tercero
        baja.
      */}
      {/*
        Boton y tags, juntos. El hueco entre ellos es de `gap-1`, el minimo:
        los tags son parte de este filtro, no un filtro aparte, asi que van
        pegados. El espacio de verdad lo pone el `gap-x-5` de la barra, que es
        el que separa este filtro del de estado — y ese si se mantiene, porque
        si no los dos filtros parecerian uno solo.

        `items-start` y no `items-center`: con tags en dos filas el boton tiene
        que quedarse arriba, pegado a su titulo, en vez de flotar en medio de
        una columna mas alta que el.
      */}
      <div className="flex shrink-0 items-start gap-1">
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
          title={disabled ? disabledTitle : `${label}: ${resumen}`}
          className={[
            'inline-flex shrink-0 items-center justify-between gap-2 rounded-full px-3 py-2 text-xs font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            'disabled:cursor-not-allowed',
            // Relleno solido con el color del filtro, como la pompa del
            // interruptor. Sin nada marcado esta apagado —no se esta filtrando—
            // y en cuanto se marca algo se enciende entero. El menu abierto no
            // lo enciende: abrirlo no es filtrar.
            //
            // Apagado **no** es casi invisible. Con `bg-hover` —blanco al 5 %—
            // y `text-t4` el texto salia a 2,15:1 de contraste, por debajo
            // del 4,5 que pide la norma, y el boton no pare pulsable sino un
            // texto con una flecha pegada. Con superficie, borde y `text-t2`
            // son 6,4:1 en el tema oscuro y 10,3:1 en el claro.
            todas ? 'border border-borde bg-surface-2 text-t1' : [colores.relleno, colores.sobreRelleno].join(' '),
            disabled ? 'opacity-40' : '',
          ].join(' ')}
        >
          {todas ? <span>{allLabel}</span> : <span className="tabular-nums">{marcadas.size}</span>}

          {/*
            El candado solo cuando la exclusion esta encendida. Encendido o
            apagado, el boton pone un numero: el icono de al lado solo dice como
            hay que leer ese numero, y mientras no se haya decidido no hay nada
            que leer de otra forma.
          */}
          {excluir ? (
            <Icon
              name="lock"
              size={11}
              className={todas ? 'shrink-0 text-t4' : 'shrink-0 opacity-80'}
            />
          ) : null}

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

        {/*
          Los tags marcados, en su columna a la derecha.

          El contenedor mide **lo que necesitan los tags**, no una reserva, y el
          filtro de al lado se ve desplazarse cuando aparecen o desaparecen. Es
          lo pedido: si el hueco se reservase fijo, el filtro de estado se
          quedaria quieto y los tags no tendrian a donde empujar.

          El ancho se mide y se pone a mano para poder transicionar. Un `flex`
          calcula su ancho y ya esta: no hay transicion posible sobre un ancho
          que el navegador decide en la misma pasada en que se pinta. Asi que
          hay dos cajas —una invisible ajustada al contenido, que es la que
          mide, y otra visible con el ancho ya puesto en pixeles— y el ancho
          medido se le pone a la de fuera con `transition: width`.

          **Y cuelga, no empuja.** El alto va fijo —dos chips y su separacion—
          y ademas la caja va en `absolute`, con el envoltorio a la altura del
          boton. Con dos filas la columna es 44 y el boton 40: si ocupara su
          sitio en el flujo, el bloque del filtro mediria 44, la fila entera
          creceria cuatro pixeles y los titulos de al lado se descuadrarian.

          **No hay tope de cuantos se muestran.** Con cuatro marcadas salia un
          «+1» en vez del tag, y contar no es ver: no se esconde ninguno.
        */}
        <div className="relative shrink-0" style={{ width: `${anchoTags}px` }}>
          <div
            className="absolute top-0 left-0 overflow-hidden"
            style={{
              width: `${anchoTags}px`,
              height: ALTO_COLUMNA,
              transition: TRANSICION_TAGS,
            }}
          >
          {/*
            Esta caja es la que mide: `max-content` la deja al tamano de sus
            hijos aunque la de fuera le imponga otro, que es justo lo que
            necesita —mide lo que pediria la rejilla, no lo que hay recortado—.
            No se ve y no transiciona.

            `grid-auto-flow: column` con las filas fijas es lo que hace que los
            tags se apilen **hacia abajo** y no hacia la derecha: se llena la
            primera columna hasta `FILAS_POR_COLUMNA` y solo entonces se abre
            otra a la derecha. Con el flujo por defecto pasaria al reves —dos en
            la primera fila y uno en la segunda—, que es lo que se hizo y no es
            lo pedido.

            Y `grid-auto-columns: max-content` para que cada columna se ajuste
            a su tag. Con un ancho fijo, veinte tags de nombre corto se llevaban
            media barra.
          */}
          <div
            ref={medidaRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute top-0 left-0 grid gap-1"
            style={{
              gridAutoFlow: 'column',
              gridTemplateRows: `repeat(${FILAS_POR_COLUMNA}, auto)`,
              gridAutoColumns: 'max-content',
              gap: ESPACIO_CHIPS,
              height: ALTO_COLUMNA,
              width: 'max-content',
            }}
          >
            {opcionesVisibles.map((option) => chip(option, false))}
          </div>

          {/*
            Y esta se ve. Va tambien a `max-content`, **no** al ancho medido.

            Ponerle el ancho medido parece lo natural —es el mismo numero— y
            hace lo contrario: una rejilla con ancho definido reparte el
            sobrante entre las columnas en vez de quedarse cada una con lo que
            pide, asi que las columnas se acortan y el aire que sobra se queda
            a la derecha como un margen invisible. Media 243 px y ocupaba 172.

            El recorte lo pone el de fuera, que es el que tiene el ancho
            transitioning: mientras este se estrecha, el hijo —mas ancho que el
            — se sale y `overflow-hidden` lo corta. Eso es lo que quiere.
          */}
          <div
            className="grid gap-1"
            style={{
              gridAutoFlow: 'column',
              gridTemplateRows: `repeat(${FILAS_POR_COLUMNA}, auto)`,
              gridAutoColumns: 'max-content',
              gap: ESPACIO_CHIPS,
              height: ALTO_COLUMNA,
              width: 'max-content',
            }}
          >
            {opcionesVisibles.map((option) => chip(option, true))}
          </div>
          </div>
        </div>
      </div>

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
              completo
              /*
               * `value` es una de las dos opciones **siempre**, y `parcial` va
               * aparte. Antes se pasaba `'parcial'` como valor, y eso rompia
               * por dentro: `medir()` busca el boton que coincide con el valor
               * para saber donde va la pompa, y `'parcial'` no es ninguno de
               * los dos, asi que no encontraba nada y la pompa se quedaba
               * clavada donde estaba —encima de «Ninguna»—. Lo unico que la
               * hacia invisible era el `opacity`, con lo que al volver a un
               * estado con opcion elegida tenia que recolocarse desde cero y
               * se leia el salto.
               *
               * Ahora el valor sigue siendo real, la pompa siempre sabe donde
               * esta, y `parcial` solo decide si se ve. En el estado a medias
               * queda sobre «Ninguna», que es lo cierto: no hay ninguna
               * plataforma marcada. Lo que no es cierto es «Todas», y por eso
               * esa es la que no se enciende.
               */
              parcial={alcance === 'parcial'}
              tone={tone}
              value={alcance === 'todas' ? 'todas' : 'ninguna'}
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

                  {/*
                    El check va antes del numero, y solo en las marcadas.

                    Es lo que hace el desplegable de una sola opcion —el del
                    editor—, y aqui faltaba. Con el fondo de la fila mas el
                    check, marcar y desmarcar se ven de las dos maneras: sin
                    marca de color y con ella, para quien tenga buen ojo y para
                    quien no.

                    Con `opacity` y no con color: el boton va sobre el relleno
                    solido del filtro, y un check del color del filtro —el
                    natural— se perderia justo en las marcadas, que es donde
                    mas importa verlo.
                  */}
                  {marcada ? (
                    <Icon
                      name="check"
                      size={14}
                      className={[
                        'shrink-0',
                        todas ? 'text-accent' : 'opacity-90',
                      ].join(' ')}
                    />
                  ) : null}
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
          <div className="sticky bottom-0 border-t border-line bg-surface-1">
            <p className="px-3 py-2 text-[10px] leading-relaxed text-t4">
              {t(excluir ? 'filter.menu.footHintExcluir' : footHint)}
            </p>

          {/*
            La exclusion, con su candado.

            Con varias marcadas sale lo que lleva **cualquiera** de ellas, que
            es lo que se quiere casi siempre. Pero hay un caso que con OR no se
            puede pedir: «cumplidos **y** regalados». Es lo unico que hace este
            boton, y sin el el filtro se queda corto sin avisar.

            Va debajo de la nota, no junto a las opciones, porque no es una mas
            de las opciones: cambia lo que significan todas las de arriba. Y
            lleva candado en vez de una casilla porque no es «activar algo» sino
            «cerrar el paso a las demas»: abierto es «con una basta», cerrado
            es «hay que tenerlas todas».

            El texto no dice «exclusion», que no explica nada a quien no lo
            sabe: dice las dos lecturas, que es lo que hay que saber.

            Y solo aparece con dos o mas marcadas: con una no hay nada que
            combinar, y con ninguna la opcion de excluir no hace nada.
          */}
          {marcadas.size > 1 ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={excluir}
              onClick={() => onExcluir?.(!excluir)}
              className={[
                'flex w-full items-center gap-2 px-3 py-2',
                'text-left text-[10px] leading-relaxed transition-colors',
                excluir ? 'text-t1' : 'text-t3 hover:text-t2',
              ].join(' ')}
            >
              <Icon
                name={excluir ? 'lock' : 'lock-open'}
                size={13}
                className="shrink-0"
              />

              <span>{t(excluir ? 'filter.menu.excluirOn' : 'filter.menu.excluirOff')}</span>
            </button>
          ) : null}
          </div>
        </Popover>
      ) : null}
    </div>
  );
}
