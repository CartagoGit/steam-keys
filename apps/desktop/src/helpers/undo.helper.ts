import { useCallback, useRef, useState } from 'react';
import type { IGameKey, IGameKeyDraft } from '@/contracts';

/**
 * Una accion que se puede deshacer.
 */
export interface IUndoEntry {
  id: number;
  /** Texto ya traducido: «Regaladas 12 claves». */
  label: string;
  /**
   * Estado de las claves **antes** del cambio.
   *
   * Se guarda la fila entera y no solo lo que cambio porque el deshacer tiene
   * que devolver la clave a como estaba, no a una version aproximada: si al
   * regalar tambien se anoto cuando se uso, deshacer solo el estado dejaria esa
   * marca puesta.
   */
  antes: readonly IUndoSnapshot[];
  /**
   * `true` si lo que se deshace es un borrado.
   *
   * Un borrado no se deshace con `update`, porque la fila ya no existe: hay que
   * volver a crearla. Guardar el estado «antes» sirve igual para las dos vias.
   */
  borradas: boolean;
}

/**
 * Lo que hace falta para volver a poner una clave como estaba.
 *
 * Incluye `source` y `lastUsedAt` aunque `update` no los escriba, porque el
 * borrado se deshace recreando la fila y ahi si se perderian: una clave
 * importada del TXT volveria como manual y sin la marca de cuando se canjeo.
 */
export interface IUndoSnapshot {
  title: string;
  keyValue: string;
  platform: IGameKey['platform'];
  status: IGameKey['status'];
  source: IGameKey['source'];
  giftedTo: string | null;
  parentTitle: string | null;
  note: string | null;
  tags: readonly string[];
  addedOn: string | null;
  lastUsedAt: string | null;
}

/** Como deshacer una entrada concreta. */
export type UndoApplier = (entrada: IUndoEntry) => Promise<void>;

export interface IUndoApi {
  /** La ultima accion, o `null` si no hay nada que deshacer. */
  entrada: IUndoEntry | null;
  /** Apunta una accion para poder deshacerla. */
  registrar: (label: string, claves: readonly IGameKey[], borradas?: boolean) => void;
  /**
   * Deshace la ultima y devuelve `true` si habia algo que deshacer.
   *
   * `true` significa «habia una accion», no «se aplico bien». Si la operacion
   * falla la entrada vuelve a la pila y el error sube, para que quien llame lo
   * avise.
   */
  deshacer: () => Promise<boolean>;
}

/** Cuantas acciones se recuerdan. Una basta; diez ya es un historial. */
const PROFUNDIDAD = 10;

/**
 * Convierte una clave en lo que hace falta guardar para deshacer un cambio.
 *
 * Se copia todo lo editable y nada mas: `createdAt` e `updatedAt` los pone la
 * base de datos, y `id` no se puede elegir al reinsertar.
 */
export function instantaneaDe(claves: readonly IGameKey[]): IUndoSnapshot[] {
  return claves.map((clave) => ({
    title: clave.title,
    keyValue: clave.keyValue,
    platform: clave.platform,
    status: clave.status,
    source: clave.source,
    giftedTo: clave.giftedTo,
    parentTitle: clave.parentTitle,
    note: clave.note,
    tags: [...clave.tags],
    addedOn: clave.addedOn,
    lastUsedAt: clave.lastUsedAt,
  }));
}

/** La misma foto, como borrador, que es lo que acepta `update`. */
export function borradorDe(foto: IUndoSnapshot): IGameKeyDraft {
  return {
    title: foto.title,
    keyValue: foto.keyValue,
    platform: foto.platform,
    status: foto.status,
    giftedTo: foto.giftedTo,
    parentTitle: foto.parentTitle,
    note: foto.note,
    tags: foto.tags,
    addedOn: foto.addedOn,
  };
}

/**
 * Pila de «deshacer» para las acciones que tocan varias claves de golpe.
 *
 * Por que hace falta: regalar cuarenta claves se hace en una pulsacion y no se
 * ve clave por clave. Si se equivoca una —o se equivoca la seleccion— sin
 * deshacer hay que editarlas una a una, y son cuarenta viajes al editor.
 *
 * Solo se guardan las acciones de la sesion actual y en memoria: nada se
 * escribe en la base. Un «deshacer» que sobrevive al cierre del programa ya no
 * es un deshacer, es un historial, y un historial tiene fecha de caducidad.
 */
export function useUndo(aplicar: UndoApplier): IUndoApi {
  const [pila, setPila] = useState<readonly IUndoEntry[]>([]);
  const siguienteId = useRef(1);
  const aplicandoRef = useRef(false);

  // El `aplicar` cambia en cada render porque captura estado del componente. Se
  // guarda en un ref para que el callback de `deshacer` no cambie de identidad
  // y no pueda provocar efectos que lo vuelvan a ejecutar.
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;

  const registrar = useCallback(
    (label: string, claves: readonly IGameKey[], borradas = false): void => {
      if (claves.length === 0) return;

      const entrada: IUndoEntry = {
        id: siguienteId.current++,
        label,
        antes: instantaneaDe(claves),
        borradas,
      };

      setPila((actual) => [...actual.slice(-(PROFUNDIDAD - 1)), entrada]);
    },
    [],
  );

  const deshacer = useCallback(async (): Promise<boolean> => {
    /**
     * Una deshecha en curso bloquea la siguiente.
     *
     * Sin esto, dos Ctrl+Z seguidos con una accion de cuarenta claves
     * inconten a la vez: las dos escriben, y el `reload()` de la mas rapida
     * puede dejar la lista mostrando el estado anterior al de la mas lenta.
     */
    if (aplicandoRef.current) return false;

    const entrada = pila[pila.length - 1];

    if (entrada === undefined) return false;

    aplicandoRef.current = true;

    /**
     * Se saca antes de aplicar para que un doble Ctrl+Z no la deshaga dos
     * veces. Pero **vuelve a la pila si falla**.
     *
     * El comentario que habia aqui decia que un fallo deberia poder
     * reintentarse, y el codico no lo hacia: la entrada se perdia y el pie
     * dejaba de ofrecer deshacer. Perderla justo cuando algo ha fallado es
     * cuando mas molesta, que es cuando mas hace falta.
     */
    setPila((actual) => actual.slice(0, -1));

    try {
      await aplicarRef.current(entrada);
      return true;
    } catch (cause) {
      setPila((actual) => [...actual, entrada]);
      throw cause;
    } finally {
      aplicandoRef.current = false;
    }
  }, [pila]);

  return { entrada: pila[pila.length - 1] ?? null, registrar, deshacer };
}