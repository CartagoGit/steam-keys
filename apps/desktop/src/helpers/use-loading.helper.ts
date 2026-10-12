import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Una tarea en curso, de las que se enseñan en el indicador de carga.
 */
export interface ILoadingTask {
  /** Identificador, para poder cancelar una concreta. */
  id: number;
  /** Texto ya traducido: «Guardando», «Sincronizando con Steam»… */
  label: string;
  /**
   * `true` si la tarea sabe detenerse sola al cancelar.
   *
   * Con `false` la X deja de esperar igualmente, pero la operacion de debajo
   * sigue y puede escribir en la base. Esa distincion la tiene que ver quien
   * pulsa, no escondersela.
   */
  abortable: boolean;
}

/** Lo que devuelve `empezar`. */
export interface ILoadingHandle {
  /** Para abortar de verdad una peticion de red. */
  signal: AbortSignal;
  /** Cierra el indicador. Se llama siempre en el `finally`. */
  fin: () => void;
  /** `true` si se pulso la X mientras corria esta tarea. */
  cancelado: () => boolean;
}

export interface ILoadingApi {
  /** Las tareas vivas, en el orden en que empezaron. */
  tareas: readonly ILoadingTask[];
  /**
   * Registra una tarea y devuelve como terminarla.
   *
   *   const tarea = empezar(traducir('loading.saving'));
   *   try { ... } finally { tarea.fin(); }
   */
  empezar: (label: string, abortable?: boolean) => ILoadingHandle;
  /** Cancela una tarea concreta. */
  cancelar: (id: number) => void;
  /** `true` si hay algo en curso. */
  hayCarga: boolean;
}

/**
 * Registro de tareas en curso, para poder enseñarlas y cancelar una.
 *
 * Resuelve un agujero que el `busy` no cubre: apaga botones, pero no dice **que**
 * esta pasando. Cuando algo se cuelga —una llamada a Steam sin respuesta, un
 * `await` que nunca resuelve— la interfaz queda con los controles apagados y sin
 * ninguna explicacion. Con esto hay un indicador discreto con lo que esta
 * pasando y una X para dejarlo ir.
 *
 * Cancelar hace dos cosas distintas segun la tarea, y por eso `abortable` viaja
 * con ella. Una peticion de red recibe el `AbortSignal` y muere de verdad; una
 * escritura en la base no se puede parar a mitad, asi que cancelar abandona la
 * espera y el resultado se descarta cuando llegue. La interfaz se desbloquea en
 * los dos casos, pero solo el primero deja de escribir.
 *
 * Es un hook y no un servicio porque el estado tiene que provocar repintado, y
 * eso solo lo hace React.
 */
export function useLoading(): ILoadingApi {
  const [tareas, setTareas] = useState<readonly ILoadingTask[]>([]);
  const siguienteId = useRef(1);
  const cancelados = useRef(new Set<number>());
  const vivos = useRef(new Map<number, AbortController>());

  const cerrar = useCallback((id: number): void => {
    vivos.current.delete(id);
    setTareas((actuales) => actuales.filter((tarea) => tarea.id !== id));
  }, []);

  const empezar = useCallback(
    (label: string, abortable = false): ILoadingHandle => {
      const id = siguienteId.current++;
      const controller = new AbortController();

      vivos.current.set(id, controller);
      setTareas((actuales) => [...actuales, { id, label, abortable }]);

      return {
        signal: controller.signal,
        fin: () => {
          // Abortar al terminar tambien: si la promesa ya resolvio es un no-op,
          // y si no, evita que un `fetch` siga vivo despues del unmount.
          controller.abort();
          cerrar(id);
        },
        cancelado: () => cancelados.current.has(id),
      };
    },
    [cerrar],
  );

  const cancelar = useCallback(
    (id: number): void => {
      cancelados.current.add(id);
      vivos.current.get(id)?.abort();
      cerrar(id);
    },
    [cerrar],
  );

  // Los ids cancelados se limpian cuando ya no queda ninguna tarea en curso: si
  // no, el conjunto crece sin limite durante una sesion larga.
  useEffect(() => {
    if (tareas.length > 0) return;

    cancelados.current.clear();
  }, [tareas]);

  // Al desmontar se aborta todo lo que quede vivo. Sin esto, una peticion a
  // Steam que colgase seguiria escribiendo en un componente que ya no existe.
  useEffect(() => {
    const pendientes = vivos.current;

    return () => {
      for (const controller of pendientes.values()) controller.abort();
      pendientes.clear();
    };
  }, []);

  return { tareas, empezar, cancelar, hayCarga: tareas.length > 0 };
}

/**
 * Lo que devuelve `conTiempoLimite`.
 *
 * El timeout se distingue con `ok: false` y no devolviendo `undefined`, porque
 * `undefined` es un valor legitimo: un `onSave` que no devuelve nada es
 * exactamente igual que uno que se queda colgado, y confundirlos hacia que un
 * guardado correcto se anunciara como fallo.
 */
export type TConTiempo<T> = { ok: true; valor: T } | { ok: false };

/**
 * Da por abandonada una promesa sin esperar mas, sin que su error llegue nunca.
 *
 *   const r = await conTiempoLimite(buscar(), 8000);
 *   if (!r.ok) return;   // se paso de tiempo
 *   usar(r.valor);
 *
 * Quien pregunta es «¿ha llegado a tiempo y que traia?», y no «¿que fallo ha
 * pasado?». Por eso devuelve un resultado discriminado y no lanza.
 */
export async function conTiempoLimite<T>(
  promesa: Promise<T>,
  ms: number,
): Promise<TConTiempo<T>> {
  let reloj: ReturnType<typeof setTimeout> | undefined;

  const espera = new Promise<{ ok: false }>((resolve) => {
    reloj = setTimeout(() => resolve({ ok: false }), ms);
  });

  const resultado = await Promise.race([
    promesa.then((valor) => ({ ok: true, valor }) as const),
    espera,
  ]);

  if (reloj !== undefined) clearTimeout(reloj);

  if (!resultado.ok) {
    // La promesa original sigue viva. Se le pone un dueño que descarta tanto el
    // acierto como el fallo, para que ninguno llegue como excepcion sin quitar.
    void promesa.then(undefined, () => undefined);
  }

  return resultado;
}