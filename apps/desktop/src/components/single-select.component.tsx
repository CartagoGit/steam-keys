import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { Icon } from './icon.component';
import { Popover, PopoverOption } from './popover.component';
import { CAMPO_CLASS, Toggle } from './ui.component';

/** Una opcion de un desplegable de una sola eleccion. */
export interface ISelectOption<T extends string> {
  value: T;
  /** Texto ya traducido, listo para pintar. */
  label: string;
  /**
   * Lo que va delante del texto: un icono, una bandera, un distintivo.
   *
   * Es un **nodo** y no un nombre de icono a proposito. Cada selector enseña
   * algo distinto delante —una bandera, un icono dentro de su color, nada— y
   * con un `icon?: IconName` habria que inventar un tipo de icono capaz de
   * pintar tres cosas distintas, que es como se acaba con un
   * `if (opcion.icon === 'bandera')`. Ademas, el nodo se pinta igual en el
   * boton y en la lista, y es exactamente lo que tienen que ser: si el boton
   * enseña otra cosa que la fila que tiene puesta, no se sabe cual es la elegida.
   */
  icono?: ReactNode;
  /** Texto del tooltip, si es distinto de lo que ya se ve. */
  title?: string;
}

export interface ISingleSelectProps<T extends string> {
  options: readonly ISelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nombre accesible del control. */
  label: string;
  /**
   * Lo que se ve a la izquierda, del todo: el icono que dice **de que** es el
   * desplegable.
   *
   * Es lo unico que se parece a una etiqueta y no lo es. En un dialogo el
   * nombre ya lo pone el `Field` que lo envuelve y no hace falta nada; en la
   * cabecera no hay sitio para un titulo encima sin estirar la barra entera,
   * asi que el nombre va en un icono.
   *
   * Va antes que el `icono` de la opcion y no en su lugar: `icono` es lo que
   * ha elegido quien usa el selector —la bandera, el color del estado— y esto
   * es de que es el selector. Juntos se leen «ordenar: A - Z» sin que el
   * segundo pise al primero.
   */
  iconoBase?: ReactNode;
  /**
   * Que el boton mida lo que mide lo seleccionado.
   *
   * En un dialogo el boton ocupa el ancho entero del campo y da igual: se ve
   * dentro de un formulario y el ancho lo lleva el formulario. En la cabecera
   * no: hay tres cosas en una fila y un boton que cambia de ancho al cambiar
   * de opcion arrastra a las de al lado.
   *
   * Con esto mide **lo que ocupa el valor puesto** —ni mas ni menos— y al
   * cambiar de valor el ancho se interpola en vez de saltar. Un boton que
   * encoge de golpe y empuja el «Anadir» 60 pixeles a la izquierda es un
   * parpadeo en cada cambio de orden, y lo que hay alrededor se ve moverse sin
   * motivo.
   */
  ajustarAncho?: boolean;
  /**
   * Fila con casilla al pie de la lista, para el otro sentido.
   *
   * Solo la lleva el desplegable de orden, y es el mismo control que el
   * candado del filtro de etiquetas —«esta consulta o la contraria»— asi que
   * es el mismo `Toggle`, no una copia.
   *
   * Va **dentro del menu** y no al lado del boton porque cambia lo que hay
   * marcado: si se pulsara desde la cabecera, el boton tendria que abrir el
   * menu solo para poder tocarlo, y el menu se cerraria al pulsar fuera antes
   * de que se llegue. Y porque se elige **al ordenar**: al elegir el criterio
   * se elige tambien hacia que lado.
   */
  pie?: {
    texto: string;
    marcada: boolean;
    alCambiar: (marcada: boolean) => void;
  };
  /** Clase del contenedor, para lo que cambia de sitio. */
  className?: string;
}

/**
 * La transicion del ancho, en sus tres partes.
 *
 * El atajo entero no se puede poner en `transitionProperty`: ahi va **solo** la
 * lista de propiedades. Escribir ahi `width 200ms cubic-bezier(...)` hace que la
 * declaracion no valida, el navegador la tira, y el boton se queda con la
 * lista de la clase `transition` —colores, sombra, opacidad— que no incluye el
 * ancho. El ancho entonces salta de golpe, que es justo lo que se queria
 * evitar, y ademas no hay ningun sintoma: el estilo se ve puesto en el
 * inspector y no hace nada.
 *
 * La duracion y la curva son las de la pompa de `Segmented`, y a proposito: si
 * el boton se encoge en 200 ms y lo que tiene al lado se recoloca en otra
 * cifra, los dos gestos se leen como dos cosas. Con la misma se leen como uno.
 */
/**
 * Alto maximo de la lista cuando hay fila de pie.
 *
 * Es holgado a proposito: solo se alcanza con el desplegable de orden, que
 * tiene cuatro opciones, asi que en la practica casi nunca llega. Si se
 * alcanzara, lo que se desplaza es la lista y el pie se queda quieto, que es
 * justo para lo que esta.
 */
const ALTO_MAXIMO_CON_PIE = 420;

const DURACION_ANCHO = '200ms';
const CURVA_ANCHO = 'cubic-bezier(0.34, 1.3, 0.64, 1)';

/**
 * Desplegable de **una sola eleccion**. Es el patron de la app.
 *
 * Vive aqui porque son cuatro selectores que hacen exactamente lo mismo —abrir
 * una lista, elegir una, cerrar— y cada uno traia su copia. No se les ve la
 * diferencia en el comportamiento: la lista sale por un portal, el teclado la
 * recorre con las flechas, la elegida lleva un check y la flecha gira al
 * abrir. Lo unico que cambia entre ellos es lo que va delante del texto.
 *
 * Eso es justo lo que se veia. El selector de idioma tenia `ring-1 ring-line`
 * y el de plataforma `border border-borde`: el mismo control con el borde
 * dibujado de dos maneras, y en la misma pantalla se leian como dos families.
 * El de orden, ademas, era un `<select>` nativo: sin transicion, con la lista
 * del sistema operativo y con el dibujado del sistema operativo encima.
 *
 * Un `<select>` nativo no admite nada dentro de un `<option>` —una bandera o un
 * icono se ignoran— y su lista es la del sistema, que en Windows sale con otro
 * tamano, otro scroll y otra tipografia. Si el menu tiene que verse como el
 * resto, tiene que ser nuestro.
 *
 * La unica diferencia entre los cuatro es `icono`, y por eso va en la opcion y
 * no en una prop del componente: el boton enseña el de la elegida y cada fila
 * el suyo, y las dos cosas salen del mismo sitio sin que haya que acordarse.
 */
export function SingleSelect<T extends string>({
  options,
  value,
  onChange,
  label,
  iconoBase,
  ajustarAncho = false,
  pie,
  className = '',
}: ISingleSelectProps<T>) {
  const [abierto, setAbierto] = useState(false);
  const [resaltada, setResaltada] = useState(0);
  const boton = useRef<HTMLButtonElement>(null);

  const indicePuesta = options.findIndex((option) => option.value === value);
  const elegida = options[indicePuesta] ?? options[0];

  /**
   * Al abrir, el teclado arranca sobre la opcion que esta puesta, no sobre la
   * primera: si se esta corrigiendo algo, casi siempre es para volver a lo
   * mismo, y dejarlo puesto ahorra un tabulador.
   */
  useEffect(() => {
    if (!abierto) return;

    setResaltada(Math.max(0, indicePuesta));
  }, [abierto, indicePuesta]);

  const elegir = (opcion: T): void => {
    setAbierto(false);
    if (opcion !== value) onChange(opcion);
  };

  /**
   * El ancho del boton, cuando `ajustarAncho` lo pide.
   *
   * No se guarda en estado de React: se escribe **en el DOM**, desde un efecto
   * de layout. Y no porque sea mas corto, sino porque un ancho medido necesita
   * dos pasos que en un render no existen: primero quitar el ancho puesto para
   * que el boton se mida al natural, y despues volver a ponerselo.
   *
   * Con estado habria un bucle: el estado cambia, React repinta con el ancho
   * viejo puesto, el efecto mide ese ancho —que ya no es el natural— y lo
   * guarda, y el efecto vuelve a medirse. Con el ancho en el DOM los dos pasos
   * ocurren en el mismo efecto y antes de pintar, que es justo cuando se
   * quiere que ocurran.
   */
  useLayoutEffect(() => {
    const nodo = boton.current;

    if (!ajustarAncho || !nodo) return;

    const medir = (): void => {
      // Se suprime el ancho puesto antes de leer. Sin esto, la segunda medida
      // daria el ancho de la anterior y el boton se quedaria clavado en la
      // primera opcion que se eligio.
      nodo.style.width = '';
      nodo.style.width = `${nodo.offsetWidth}px`;
    };

    medir();

    /*
     * Se vuelve a medir cuando cambia el idioma y cuando se estrecha la
     * ventana. El texto es lo unico que puede cambiar el ancho, y sin esto el
     * boton se queda con la medida del castellano —o con la de una ventana
     * ancha, si la medida se tomo antes de que la caja se encogiera— y el
     * texto se sale o sobra espacio por el mismo lado.
     */
    const alCambiarIdioma = (): void => medir();

    window.addEventListener('resize', alCambiarIdioma);

    return () => {
      window.removeEventListener('resize', alCambiarIdioma);
      nodo.style.width = '';
    };
  }, [ajustarAncho, elegida?.label]);

  /**
   * El teclado va **ahi** y no en el panel.
   *
   * El panel se monta en `document.body` por un portal, asi que un
   * `onKeyDown` suyo solo veria las teclas que se pulsan con el raton encima,
   * que es justo cuando no se navega. En el boton ve todo, y el arbol de
   * eventos de React sigue siendo el normal a traves del portal.
   */
  const alTeclado = (evento: React.KeyboardEvent): void => {
    const ultimo = options.length - 1;

    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        setAbierto(true);
        setResaltada((i) => Math.min(ultimo, i + 1));
        break;
      case 'ArrowUp':
        evento.preventDefault();
        setAbierto(true);
        setResaltada((i) => Math.max(0, i - 1));
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
        if (abierto) {
          const highlighted = options[resaltada];

          if (highlighted !== undefined) elegir(highlighted.value);
        } else {
          setAbierto(true);
        }
        break;
      // `Escape` no esta aqui a proposito: lo lleva `Popover`, que sabe
      // cuando hay algo abierto encima y por tanto cuando tiene sentido
      // subir un nivel en vez de cerrarlo todo.
    }
  };

  return (
    <div className={className} onKeyDown={alTeclado}>
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((abierto) => !abierto)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={`${CAMPO_CLASS} flex items-center gap-2 text-left`}
        style={
          ajustarAncho
            ? {
                /*
                 * `width` **sustituye** la lista de la clase `transition`, no
                 * se anade a ella: `transition-property` no es acumulable. Con
                 * las dos, la de aqui gana —es la ultima— y el boton deja de
                 * transicionar el color al pasar por encima.
                 */
                transitionProperty: 'width',
                transitionDuration: DURACION_ANCHO,
                transitionTimingFunction: CURVA_ANCHO,
              }
            : undefined
        }
      >
        {iconoBase}

        {elegida?.icono}

        <span className="flex-1 truncate">{elegida?.label ?? value}</span>

        <Icon
          name="chevron-down"
          size={14}
          className={[
            /*
             * Sin `shrink-0`: `Icon` ya lo pone en todos sus iconos, y
             * duplicarlo deja el atributo con la palabra dos veces.
             */
            'text-t3 transition-transform duration-150',
            abierto ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      <Popover
        abierto={abierto}
        ancla={boton}
        onCerrar={() => setAbierto(false)}
        resaltada={resaltada}
        aria-label={label}
        /*
         * `scrollCopia` solo cuando hay fila de pie.
         *
         * Sin ella el panel entero se desplaza y la casilla se va por arriba al
         * bajar la lista, que es justo lo que no puede pasar: es la unica
         * forma de volver a cambiar el sentido sin reabrir el menu.
         */
        scrollCopia={pie !== undefined}
        altoMaximo={pie !== undefined ? ALTO_MAXIMO_CON_PIE : undefined}
        className={pie !== undefined ? 'p-0' : ''}
      >
        {options.map((option, indice) => (
          <PopoverOption
            key={option.value}
            activa={option.value === value}
            resaltada={indice === resaltada}
            alPulsar={() => elegir(option.value)}
            alEntrar={() => setResaltada(indice)}
            title={option.title}
            derecha={
              option.value === value ? (
                <Icon name="check" size={14} className="shrink-0 text-accent" />
              ) : null
            }
          >
            {option.icono}

            <span className="flex-1 truncate">{option.label}</span>
          </PopoverOption>
        ))}

        {/*
          El pie va **fuera** de la lista y con su propio borde.
          *
          * `PopoverOption` mide su caja para el ajuste del teclado, asi que si
          * la casilla fuera una opcion mas se moveria con las flechas —que en
          * una lista de eleccion unica no tienen nada que recorrer por ahi— y
          * Enter sobre ella cerraria el menu sin elegir. Con su propio borde
          * debajo se lee como lo que es: una opcion distinta, de otro tipo.
        */}
        {pie ? (
          <div className="shrink-0 border-t border-line">
            <Toggle
              marcada={pie.marcada}
              alCambiar={pie.alCambiar}
              icono={pie.marcada ? 'check' : 'minus'}
            >
              {pie.texto}
            </Toggle>
          </div>
        ) : null}
      </Popover>
    </div>
  );
}