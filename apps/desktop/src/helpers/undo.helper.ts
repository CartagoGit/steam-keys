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

/** Lo que hace falta para volver a poner una clave como estaba. */
export interface IUndoSnapshot {
  title: string;
  keyValue: string;
  platform: IGameKey['platform'];
  status: IGameKey['status'];
  giftedTo: string | null;
  parentTitle: string | null;
  note: string | null;
  tags: readonly string[];
  addedOn: string | null;
}

/** Como deshacer una entrada concreta. */
export type UndoApplier = (entrada: IUndoEntry) => Promise<void>;

export interface IUndoApi {
  /** La ultima accion, o `null` si no hay nada que deshacer. */
  entrada: IUndoEntry | null;
  /** Apunta una accion para poder deshacerla. */
  registrar: (label: string, claves: readonly IGameKey[], borradas?: boolean) => void;
  /** Deshace la ultima y devuelve `true` si habia algo. */
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
    giftedTo: clave.giftedTo,
    parentTitle: clave.parentTitle,
    note: clave.note,
    tags: [...clave.tags],
    addedOn: clave.addedOn,
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
 * escribe en la base. Un «deshacer» que sobrevive al cierre del programa ya
 * no es un deshacer, es un historial, y un historial tiene fecha de caducidad.
 */
export function useUndo(aplicar: UndoApplier): IUndoApi {
  const [pila, setPila] = useState<readonly IUndoEntry[]>([]);
  const siguienteId = useRef(1);
  const aplicarRef = useRef(aplicar);

  // El `aplicar` cambia en cada render porque captura estado del componente. Se
  // guarda en un ref para que el callback de `deshacer` no cambie de identidad
  // y no pueda provocar efectos que lo vuelvan a ejecutar.
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
    const entrada = pila[pila.length - 1];

    if (entrada === undefined) return false;

    // Se saca antes de aplicar: si la operacion falla, deshacer otra vez tiene
    // que intentar lo mismo, no saltarse a una accion que no se todavia.
    setPila((actual) => actual.slice(0, -1));

    await aplicarRef.current(entrada);

    return true;
  }, [pila]);

  return { entrada: pila[pila.length - 1] ?? null, registrar, deshacer };
}