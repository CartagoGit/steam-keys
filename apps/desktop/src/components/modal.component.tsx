import { useEffect, useRef, useState } from 'react';

import { IconButton } from './ui.component';
import { apilarDialogo } from '@/helpers/dialogos.helper';
import { Icon, type IconName } from './icon.component';

export interface IModalProps {
  /** `false` empieza a cerrar: reproduce la salida y luego se desmonta. */
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * Elemento que envuelve el contenido del dialogo.
   *
   * El editor de claves necesita un `<form>` para que el guardado salga con
   * Enter desde cualquier campo, y `<div>` dentro de un `<form>` no se puede.
   * Por eso se puede cambiar la etiqueta en vez de obligar al editor a
   * mantener su propio fondo, su propio Escape y su propio fondo oscurecido.
   */
  as?: 'div' | 'form';
  /** `onSubmit` del `<form>`, cuando `as="form"`. */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  /** Ancho maximo del panel. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'auto';
  /** Al pulsar fuera, se cierra. Los dialogos de confirmacion, si. */
  closeOnBackdrop?: boolean;
  /** Al pulsar Escape, se cierra. */
  closeOnEscape?: boolean;
  /** Etiqueta para lectores de pantalla. */
  label: string;
}

/** El tipo sale de la prop `size`, para que anadir un tamano no se pueda olvidar. */
type TSize = NonNullable<IModalProps['size']>;

const SIZES: Record<TSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  /*
   * `xl` esta desde que el panel de datos dejo de escribir su fondo a mano.
   * Es `max-w-2xl`, que es lo que necesitaba: el ancho estaba puesto en el
   * componente y no en la tabla de tamaños, asi que cambiar el ancho de un
   * dialogo obligaba a acordarse de que ese no la usaba.
   */
  xl: 'max-w-2xl',
  /*
   * `auto` mide el contenido, y esta ahi por el catalogo de etiquetas.
   *
   * Los demas son un ancho fijo —con el suyo, todos los dialogos se abren
   * igual— y un dialogo de formulario lo necesita: los campos tienen que estar
   * en el mismo sitio cada vez que se abre. El catalogo no: su ancho depende de
   * lo larga que sea la etiqueta mas larga, y con un ancho fijo ese hueco se
   * resolvia como se pudo, que era.recortando el nombre o —si no cabia nada—
   * aplastando los botones de la fila encima. Ajustandolo al contenido, cada
   * fila ocupa lo que necesita y el dialogo se abre al ancho que de verdad hace
   * falta.
   *
   * Se combina con `md` en lugar de sustituirlo: `w-fit max-w-md` quiere decir
   * «lo que necesite, hasta el ancho de un dialogo normal». Sin el `max-w` un
   * nombre de cuarenta letras abriria un dialogo mas ancho que la ventana.
   */
  auto: 'w-fit max-w-md',
};

/**
 * Margen que se deja entre el dialogo y los bordes de la ventana, en pixeles.
 *
 * Es el mismo por los cuatro lados a proposito: si el de arriba fuera mayor, el
 * panel quedaria «colgado» de la barra de titulo y en una ventana baja se
 * comeria el espacio de abajo, que es justo el que necesita el boton de
 * guardar.
 *
 * Y con el dialogo pegado al borde de arriba —ver el `items-start` del fondo—
 * este margen es **la unica cosa** que separa el panel del borde. Es lo que
 * hace que el alto del contenido no mueva la cabecera ni las pestanas.
 *
 * Va en el `style` y no en una clase de Tailwind. Las clases se escriben
 * `p-4` y `max-h-[calc(100dvh-2rem)]`, y para que las dos dijeran lo mismo
 * habria que escribir el numero dos veces —y la vez que se tocara una, el
 * dialogo se saldria por abajo justo cuando se le anade una fila, que es
 * cuando mas falta hace—.
 *
 * Y no es que se pueda escribir `p-[${MARGEN}px]`: Tailwind lee el codigo
 * fuente buscando literales, no las expresiones, asi que de un literal de
 * plantilla no genera ninguna clase. Se pierde el margen sin avisar.
 */
const MARGEN = 16;

/**
 * Lo que puede recibir el foco dentro de un dialogo.
 *
 * `[tabindex]:not([tabindex="-1"])` recoge los que se han hecho enfocables a
 * proposito con `tabIndex={0}`, que si no se quedarian fuera de la trampa.
 * `[disabled]` y los de `aria-hidden` no entran: no son alcanzables con el
 * teclado y enfocar un boton apagado no hace nada.
 */
const ENFOCABLES =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Dialogo modal con animacion de entrada y de salida.
 *
 * La parte dificil de animar una salida en React es que al poner
 * `open = false` el elemento se desmonta en el acto y no hay ningun fotograma
 * en el que se pueda ver el final de la animacion. La solucion es mantenerlo
 * montado durante la salida: cuando `open` pasa a `false` se cambia la clase
 * a la de salida, se espera a que termine con `onAnimationEnd` y solo entonces
 * se saca del DOM.
 *
 * De paso centraliza lo que todos los dialogos necesitan y que se estaba
 * repetir en cada uno: cerrar con Escape, cerrar pulsando fuera, el fondo
 * oscurecido y el `aria-modal`.
 */
/**
 * El panel del dialogo: el rectangulo con el contenido, dentro del fondo.
 *
 * Vive aparte porque el editor de claves necesita un `<form>` —para que el
 * guardado salga con Enter desde cualquier campo— y los demas un `<div>`. Ni
 * `<As tag={...}>` ni un componente parametrizado por la etiqueta compilan:
 * React comprueba los atributos contra las dos etiquetas a la vez y no hay un
 * tipo que valga para las dos. Con dos ramas, cada una tipa contra lo suyo y
 * `onSubmit` solo existe en la que lo necesita.
 */
function PanelInterno({
  ref,
  form,
  className,
  style,
  onSalir,
  onSubmit,
  children,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  /** `true` pinta un `<form>` en vez de un `<div>`. */
  form: boolean;
  className: string;
  style?: React.CSSProperties;
  onSalir: () => void;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}) {
  // Se filtra por el propio panel: el fondo tambien termina su animacion y si
  // no se filtra, se cerraria dos veces.
  const alTerminar = (event: React.AnimationEvent): void => {
    if (event.target !== event.currentTarget) return;

    onSalir();
  };

  // `tabIndex={-1}` sin `outline-none`: el anillo de foco se ve cuando el panel
  // recibe el foco por teclado, que es cuando hace falta saber donde esta. La
  // trampa de foco lo enfoca al abrir y cuando el Tab se queda sin nada.
  if (form) {
    return (
      <form
        ref={ref as React.RefObject<HTMLFormElement & HTMLDivElement>}
        tabIndex={-1}
        onSubmit={onSubmit}
        className={className}
        style={style}
        onAnimationEnd={alTerminar}
      >
        {children}
      </form>
    );
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={className}
      style={style}
      onAnimationEnd={alTerminar}
    >
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  children,
  as: As = 'div',
  onSubmit,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  label,
}: IModalProps) {
  /** `true` mientras se ve; `false` solo mientras se reproduce la salida. */
  const [visible, setVisible] = useState(open);
  const [saliendo, setSaliendo] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * El elemento que estaba enfocado cuando se abrio el dialogo.
   *
   * Sin guardarlo, al cerrar el foco se queda en el `<body>`: el siguiente Tab
   * empieza desde arriba de la pagina y hay que recorrer media pantalla hasta
   * volver al boton. Con esto, el foco vuelve justo a donde estaba.
   */
  const abridorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setSaliendo(false);
      return;
    }

    // Cerrado y visible todavia: toca reproducir la salida.
    if (visible) setSaliendo(true);
  }, [open, visible]);

  /**
   * Escape lo cierra el hook de atajos, no este componente.
   *
   * Este solo se apila. Quien **pide** el cierre es
   * `useShortcuts`, que es el unico que escucha la tecla: si cada `Modal` se
   * escuchara a si mismo, con dos dialogos abiertos la pulsacion llegaria a
   * los dos —los dos estan en `window`— y cerrarian los dos a la vez.
   *
   * Con la pila commun, quien cierra es el de encima y solo ese.
   */
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    return apilarDialogo(onClose);
  }, [open, onClose, closeOnEscape]);

  // Al abrir, el foco entra en el dialogo y no sale hasta que se cierra.
  //
  // Sin esto, seguiria en el boton que lo abrio y el primer Tab se iria al
  // fondo de la pagina, por detras del fondo oscurecido: el cursor se perdia
  // en una pantalla que ya no se ve y habia que cazarlo con el raton. En el
  // editor de claves era peor —el Tab iba a la barra de la pagina y Enter
  // pulsaba «Anadir» o «Exportar» en vez de guardar.
  useEffect(() => {
    if (!open || !panelRef.current) return;

    const panel = panelRef.current;
    abridorRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const primero = panel.querySelector<HTMLElement>(
      'input, textarea, select, button:not([disabled])',
    );

    (primero ?? panel).focus();

    /**
     * Los elementos que se pueden enfocar ahora mismo.
     *
     * Se recalcula en cada pulsacion porque un dialogo puede mostrar botones
     * nuevos al cambiar el contenido —confirmar, deshabilitado hasta que se
     * rellena— y una lista fija dejaria fuera lo que acaba de aparecer.
     */
    const enfocables = (): HTMLElement[] =>
      [...panel.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(
        (nodo) => nodo.offsetParent !== null || nodo === document.activeElement,
      );

    const alPulsarTab = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;

      const lista = enfocables();

      if (lista.length === 0) {
        // No hay nada que enfocar: el Tab no debe salirse del dialogo.
        event.preventDefault();
        panel.focus();
        return;
      }

      const primero_ = lista[0]!;
      const ultimo = lista[lista.length - 1]!;
      const activo = document.activeElement;

      // Cycle: del ultimo al primero, y del primero al ultimo. Sin Shift, que
      // es el caso normal; con Shift, en sentido contrario.
      if (event.shiftKey && (activo === primero_ || activo === panel)) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && activo === ultimo) {
        event.preventDefault();
        primero_.focus();
      }
    };

    panel.addEventListener('keydown', alPulsarTab);

    return () => {
      panel.removeEventListener('keydown', alPulsarTab);
      // El elemento puede haberse desmontado con el dialogo.
      abridorRef.current?.focus();
      abridorRef.current = null;
    };
  }, [open]);

  if (!visible) return null;

  /**
   * Cierra de verdad: termina la animacion de salida y desmonta.
   *
   * `onAnimationEnd` salta tambien al terminar la animacion de **entrada**, y
   * ese momento no es para cerrar: sin esta comprobacion el dialogo se
   * cerraria justo despues de abrirse.
   */
  const terminarSalida = (): void => {
    if (!saliendo) return;

    setVisible(false);
    setSaliendo(false);
  };

  const clases = [
    // `flex max-h-[...] flex-col` es lo que hace que el `flex-1 overflow-y-auto`
    // que ponen los dialogos en su cuerpo sirva de algo. Sin altura maxima el
    // panel crece hasta lo que ocupa el contenido, se sale de la pantalla y
    // el `overflow-hidden` de aqui lo recorta sin dejar desplazarse: el ultimo
    // elemento (el selector de idioma en Ajustes) quedaba sin poder pulsarse en
    // una ventana baja, y parecia que el idioma no se podia cambiar.
    //
    // La maxima va en el `style`, atada a `MARGEN`, y no como clase suelta: ver
    // el comentario de la constante.
    'flex w-full flex-col overflow-hidden rounded-2xl bg-surface-1 shadow-2xl ring-1 ring-line',
    SIZES[size] ?? SIZES.md,
    /**
     * El ancho y el alto se mueven despacio.
     *
     * Los dialogos que cambian de contenido —Ajustes, que tiene pestanas—
     * saltaban de tamano de golpe: se pulsaba «General» y el panel se
     * estiraba o se encogia en un fotograma. Con `height` en la transicion,
     * que es `auto` y no un numero, el navegador interpola cuando puede y en
     * los navegadores que no, el salto es el de antes: no se rompe nada.
     *
     * Y el ancho con `max-w`: es lo unico que se anima de verdad al cambiar de
     * pestana a una mas ancha, sin lo que el texto se recoloca a saltos.
     */
    'transition-[max-width,height] duration-200 ease-out motion-reduce:transition-none',
    saliendo ? 'animate-scale-out' : 'animate-scale-in',
  ].join(' ');

  return (
    <div
      className={[
        /**
         * **`items-start`, no `items-center`.**
         *
         * El dialogo cuelga del borde de arriba y no esta centrado. Con el
         * centrado, cambiar de pestana en Ajustes movia el panel entero: al
         * crecer el contenido el dialogo se centró hacia abajo y al encoger
         * se centro hacia arriba, y las pestanas —la fila que decide el
         * cambio— subian y bajaban con el. Pulsar la pestana que ya no estaba
         * donde se vio.
         *
         * Arriba, la cabecera y las pestanas no se mueven nunca, porque no
         * dependen del alto del contenido: solo dependen de `MARGEN`. El alto
         * se absorbe **hacia abajo**, que es donde esta el contenido que
         * cambia. Es la misma solucion que lleva los titulos pegados al borde
         * superior en vez de al centro vertical.
         */
        'fixed inset-0 z-50 flex items-start justify-center backdrop-blur-sm',
        saliendo ? 'animate-backdrop-out bg-black/60' : 'animate-backdrop-in bg-black/60',
      ].join(' ')}
      style={{ padding: MARGEN }}
      onClick={(event) => {
        // Solo si el pulso ha dado en el fondo, no en el panel de dentro.
        if (!closeOnBackdrop) return;
        if (event.target !== event.currentTarget) return;

        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <PanelInterno
        ref={panelRef}
        form={As === 'form'}
        className={clases}
        style={{ maxHeight: `calc(100dvh - ${MARGEN * 2}px)` }}
        onSalir={terminarSalida}
        onSubmit={onSubmit}
      >
        {children}
      </PanelInterno>
    </div>
  );
}
export interface IModalHeaderProps {
  /** Nombre del dialogo. Es el `<h2>` y lo que se ve arriba. */
  title: string;
  /** Una linea debajo del nombre, con el detalle de lo que se va a hacer. */
  subtitle?: string;
  /** Icono delante del nombre. */
  icon?: IconName;
  /**
   * Colores del icono, como clases completas.
   *
   * Van completas y no como un nombre de color, por lo mismo que los tonos de
   * la pastilla: cada tema declara los suyos y este sitio no tiene por que
   * saber como se llaman.
   */
  tone?: string;
  /**
   * El boton de cerrar, o nada.
   *
   * Van **las dos cosas juntas** en una sola prop y no sueltas: un boton que
   * cierra y no tiene nombre es un boton que el lector de pantalla anuncia
   * como «boton», y eso ya paso —el dialogo de atajos lo tenia con `title` y
   * sin `aria-label`—. Con dos props opcionales, la combinacion de tener una
   * y no la otra compila sin decir nada.
   */
  cerrar?: { alPulsar: () => void; texto: string };
}

/**
 * La cabecera de un dialogo.
 *
 * Estaba escrita entera en **seis** ficheros, y no parecian seis copias sino
 * seis versiones distintas de la misma: el titulo era `text-sm` en cinco y
 * `text-base` en uno, el icono de 16 px en unos y de 15 en otro, el boton de
 * cerrar con `p-1.5` en unos y con `p-2` en otros, y uno —el de atajos— sin
 * `aria-label`, que hacia que el boton de cerrar no tuviera nombre.
 *
 * Con seis versiones, «un dialogo» no es una forma de dibujar nada: es una
 * forma de tener seis. Y el que se sale de las demas es el que se nota, que
 * es donde se acaba el trabajo de hacer que todo lo demas se pareciese a la
 * excepcion en vez de al revés.
 *
 * Va aqui y no en `ui` porque solo tiene sentido **dentro** de un `Modal`: es
 * la cabecera de su panel, con su mismo borde y su mismo relleno.
 */
export function ModalHeader({
  title,
  subtitle,
  icon,
  tone = 'text-t3',
  cerrar,
}: IModalHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
      <div className="leading-tight">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-t1">
          {icon ? <Icon name={icon} size={16} className={tone} /> : null}
          {title}
        </h2>

        {/*
          El respiro va en el subtitulo y no en el bloque entero. El titulo
          lleva `leading-tight`, que es lo que hace que dos dialogos seguidos
          no dejen una linea en blanco entre la cabecera y el nombre; si el
          margen viviera en el `<div>` de los dos, el titulo se separaria de su
          propio texto.
        */}
        {subtitle ? <p className="mt-1 text-[11px] text-t4">{subtitle}</p> : null}
      </div>

      {cerrar ? (
        <IconButton icon="x" title={cerrar.texto} onClick={cerrar.alPulsar} />
      ) : null}
    </header>
  );
}

/**
 * El pie de un dialogo: los botones de la derecha.
 *
 * La cadena `flex justify-end gap-2 border-t border-line px-5 py-3` estaba
 * escrita igual, caracter a caracter, en cinco ficheros. Sin un sitio comun no
 * hay manera de saber si los cinco dias siguientes siguen iguales.
 *
 * Los botones van dentro. Se podria dejar el hueco al llamante, pero entonces
 * cada uno escribiria `gap-2` otra vez y volveriamos a lo mismo.
 */
export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
      {children}
    </footer>
  );
}
