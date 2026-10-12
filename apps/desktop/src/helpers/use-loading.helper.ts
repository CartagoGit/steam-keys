import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  /**
   * `true` si se pulso la X mientras corria esta tarea.
   *
   * Se guarda **en el cierre**, no en un conjunto compartido, y por un motivo
   * concreto: el indicador se apaga en cuanto se cancela, y con el se iba el
   * conjunto de marcas. El `await` que viene detras necesita poder preguntar
   * «¿me cancelaron?» mucho despues, cuando ya no queda ninguna tarea en
   * pantalla, y entonces recibia un `false` y anunciaba como hecha una
   * operacion que el usuario habia abandonado.
   */
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
 * Una tarea viva, con su control de cancelacion pegado.
 *
 * El controlador y la marca van juntos porque tienen que morir juntos: al
 * cancelar se borra la entrada del mapa, y si la marca viviera aparte se
 * perderia justo cuando hay que consultarla.
 */
interface IViva {
  controller: AbortController;
  cancelado: boolean;
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
 *
 * Lo que devuelve tiene **identidad estable** entre renders: `empezar` y
 * `cancelar` son los mismos `useCallback` y el resto se envuelve en un
 * `useMemo`. Sin eso, quien use este hook en una lista de dependencias la
 * reinstaria en cada repintado, que es justo lo que se pretendia evitar.
 */
export function useLoading(): ILoadingApi {
  const [tareas, setTareas] = useState<readonly ILoadingTask[]>([]);
  const siguienteId = useRef(1);
  const vivos = useRef(new Map<number, IViva>());

  const cerrar = useCallback((id: number): void => {
    vivos.current.delete(id);
    setTareas((actuales) => actuales.filter((tarea) => tarea.id !== id));
  }, []);

  const empezar = useCallback(
    (label: string, abortable = false): ILoadingHandle => {
      const id = siguienteId.current++;
      const viva: IViva = {
        controller: new AbortController(),
        cancelado: false,
      };

      // El estado vive **aquí**, no en el mapa de ids. Al cancelar se borra el
      // mapa, y con el se perdia la marca; el `await` que viene detras ya no
      // tendria a quien preguntar si se cancelo.
      vivos.current.set(id, viva);
      setTareas((actuales) => [...actuales, { id, label, abortable }]);

      return {
        signal: viva.controller.signal,
        fin: () => {
          // Abortar al terminar tambien: si la promesa ya resolvio es un no-op,
          // y si no, evita que un `fetch` siga vivo despues del unmount.
          viva.controller.abort();
          cerrar(id);
        },
        cancelado: () => viva.cancelado,
      };
    },
    [cerrar],
  );

  const cancelar = useCallback(
    (id: number): void => {
      const viva = vivos.current.get(id);

      // Si no hay, la tarea ya se cerro sola: no hay nada que parar ni marca que
      // poner.
      if (viva === undefined) return;

      viva.cancelado = true;
      viva.controller.abort();
      cerrar(id);
    },
    [cerrar],
  );

  // Al desmontar se aborta todo lo que quede vivo. Sin esto, una peticion a
  // Steam que colgase seguiria escribiendo en un componente que ya no existe.
  useEffect(() => {
    const pendientes = vivos.current;

    return () => {
      for (const viva of pendientes.values()) viva.controller.abort();
      pendientes.clear();
    };
  }, []);

  return useMemo(
    () => ({ tareas, empezar, cancelar, hayCarga: tareas.length > 0 }),
    [tareas, empezar, cancelar],
  );
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