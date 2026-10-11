import { useEffect, useRef, useState } from 'react';

export interface IModalProps {
  /** `false` empieza a cerrar: reproduce la salida y luego se desmonta. */
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Ancho maximo del panel. */
  size?: 'sm' | 'md' | 'lg';
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
};

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
export function Modal({
  open,
  onClose,
  children,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  label,
}: IModalProps) {
  /** `true` mientras se ve; `false` solo mientras se reproduce la salida. */
  const [visible, setVisible] = useState(open);
  const [saliendo, setSaliendo] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setSaliendo(false);
      return;
    }

    // Cerrado y visible todavia: toca reproducir la salida.
    if (visible) setSaliendo(true);
  }, [open, visible]);

  useEffect(() => {
    if (!closeOnEscape) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !open) return;

      event.stopPropagation();
      onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, closeOnEscape]);

  // Al abrir, el foco entra en el dialogo. Sin esto, seguiria en el boton que
  // lo abrio y el primer Tab se iria al fondo de la pagina, por detras del
  // fondo oscurecido.
  useEffect(() => {
    if (!open || !panelRef.current) return;

    const panel = panelRef.current;
    const primero = panel.querySelector<HTMLElement>(
      'input, textarea, select, button:not([disabled])',
    );

    primero?.focus();
  }, [open]);

  if (!visible) return null;

  const clases = [
    // `flex max-h-[...] flex-col` es lo que hace que el `flex-1 overflow-y-auto`
    // que ponen los dialogos en su cuerpo sirva de algo. Sin altura maxima el
    // panel crece hasta lo que occupancy el contenido, se sale de la pantalla y
    // el `overflow-hidden` de aqui lo recorta sin dejar desplazarse: el ultimo
    // elemento (el selector de idioma en Ajustes) quedaba sin poder pulsarse en
    // una ventana baja, y parecia que el idioma no se podia cambiar.
    'flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl bg-surface-1 shadow-2xl ring-1 ring-line',
    SIZES[size] ?? SIZES.md,
    saliendo ? 'animate-scale-out' : 'animate-scale-in',
  ].join(' ');

  return (
    <div
      className={[
        'fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm',
        saliendo ? 'animate-backdrop-out bg-black/60' : 'animate-backdrop-in bg-black/60',
      ].join(' ')}
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
      <div
        ref={panelRef}
        className={clases}
        onAnimationEnd={(event) => {
          // Se filtra por el propio panel: el fondo tambien termina su
          // animacion y si no se filtra, se cerraria dos veces.
          if (event.target !== event.currentTarget) return;
          if (!saliendo) return;

          setVisible(false);
          setSaliendo(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}