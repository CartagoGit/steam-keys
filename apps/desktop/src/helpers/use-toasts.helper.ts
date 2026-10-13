import { useCallback, useRef, useState } from 'react';

import type { IToast, ToastTone } from '@/contracts';

/** Cuanto dura un aviso antes de quitarse solo. */
const TOAST_DURATION = 4200;

export interface IUseToasts {
  /** Los avisos que hay en pantalla, para el `ToastStack`. */
  toasts: readonly IToast[];
  /** Enseña un aviso. Es estable: no cambia nunca entre renders. */
  notify: (message: string, tone?: ToastTone) => void;
  /** Quita uno antes de tiempo, al pulsarlo. */
  dismiss: (id: number) => void;
}

/**
 * Los avisos de la esquina, y el reloj que los quita.
 *
 * Esta aqui y no en el componente por dos razones, y la segunda es la buena:
 *
 * - **El estado es suyo.** `toasts` no se lee ni se escribe en ningun otro
 *   sitio del componente: se pinta entero en un unico `<ToastStack>` y solo lo
 *   tocan `notify` y el cerrar. Estado que pertenece a un solo sitio no tiene
 *   por que vivir en el ancestro de todo lo demas.
 * - **El reloj tambien.** El `setTimeout` que borra cada aviso es el tipo de
 *   efecto que se olvida: si vive dentro de `notify`, cada aviso crea un
 *   temporizador que nadie cancela si el componente se desmonta antes, y en el
 *   escritorio —donde la ventana se cierra de golpe— eso es un `setState` sobre
 *   un componente muerto. Aqui el cleanup se puede hacer bien.
 *
 * El id sale de un contador propio y no de `Date.now()`: dos avisos seguidos en
 * el mismo milisegundo —que pasa al importar una lista de mil claves— darian el
 * mismo id con la hora, y el segundo borraria al primero.
 *
 * `notify` va envuelto en `useCallback` con la lista **vacia** a proposito: no
 * necesita leer nada, solo escribir, y asi la funcion es la misma en todos los
 * renders. Eso es lo que la deja poder usarse dentro de otras funciones
 * memorizadas sin volverlas a recrear en cada render.
 */
export function useToasts(): IUseToasts {
  const [toasts, setToasts] = useState<readonly IToast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number): void => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message: string, tone: ToastTone = 'info'): void => {
    const id = nextId.current++;

    setToasts((current) => [...current, { id, message, tone }]);

    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_DURATION);
  }, []);

  return { toasts, notify, dismiss };
}