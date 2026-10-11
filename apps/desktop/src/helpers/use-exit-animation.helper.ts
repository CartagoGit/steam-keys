import { useEffect, useRef, useState } from 'react';

/**
 * Mantiene vivo un componente mientras se reproduce su animacion de salida.
 *
 * El problema: en React, `{condicion && <Dialogo/>}` desmonta el componente en
 * cuanto `condicion` pasa a `false`. Si el dialogo esta dentro su animacion de
 * salida, no hay ni un fotograma en el que se vea: se borra de golpe.
 *
 * Aqui no se toca la app: se envuelve el dialogo y el wrapper decide cuando
 * queda tiempo a montarlo. Mientras `condicion` es `true` lo pinta siempre; en
 * el momento en que pasa a `false` lo mantiene una vez mas durante
 * `duracionMs`, y luego lo saca.
 *
 *   const DialogoVivo = useExitAnimation(
 *   Boolean(stagedImport),
 *   stagedImport,
 *   () => <ImportPreview ... />,
 * );
 *
 * @param abierto `true` mientras el dialogo deberia verse.
 * @param contenido El elemento a montar. Puede ser `null`.
 * @param duracionMs Cuanto dura la animacion de salida.
 */
export function useExitAnimation<T>(
  abierto: boolean,
  contenido: T | null,
  duracionMs = 140,
): T | null {
  const [anterior, setAnterior] = useState<T | null>(contenido);
  const pendiente = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (abierto) {
      // Cancela cualquier salida a medias: si el usuario reabre el dialogo
      // mientras se cerraba, el temporizador lo desmontaria de golpe.
      if (pendiente.current !== null) {
        clearTimeout(pendiente.current);
        pendiente.current = null;
      }

      setAnterior(contenido);
      return;
    }

    if (contenido !== null) {
      // El contenido sigue presente pero ya no deberia verse: es el momento de
      // empezar a dejarlo ir.
      setAnterior(contenido);
    }

    pendiente.current = setTimeout(() => {
      pendiente.current = null;
      setAnterior(null);
    }, duracionMs);

    return () => {
      if (pendiente.current !== null) {
        clearTimeout(pendiente.current);
        pendiente.current = null;
      }
    };
  }, [abierto, contenido, duracionMs]);

  return anterior;
}

/**
 * Igual que `useExitAnimation`, pero devuelve un booleano para montar el
 * dialogo directamente.
 *
 *   const montado = useKeepMounted(condicion);
 *   return montado ? <Dialogo open={condicion} ... /> : null;
 */
export function useKeepMounted(activo: boolean, duracionMs = 140): boolean {
  const [montado, setMontado] = useState(activo);
  const pendiente = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activo) {
      if (pendiente.current !== null) {
        clearTimeout(pendiente.current);
        pendiente.current = null;
      }

      setMontado(true);
      return;
    }

    pendiente.current = setTimeout(() => {
      pendiente.current = null;
      setMontado(false);
    }, duracionMs);

    return () => {
      if (pendiente.current !== null) {
        clearTimeout(pendiente.current);
        pendiente.current = null;
      }
    };
  }, [activo, duracionMs]);

  return montado;
}