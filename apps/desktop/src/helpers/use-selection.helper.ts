import { useCallback, useEffect, useMemo, useState } from 'react';

import { KeyScope, type IGameKey, type IKeyFilter, type Translator } from '@/contracts';
import {
  analyzeSelection,
  isGiftable,
  podarSeleccion,
  type ISelectionFacts,
  type SelectAction,
} from './selection.helper';

/**
 * Lo que el hook necesita del mundo exterior.
 *
 * Van por parametro y no importadas por capas, como en `use-arranque` y
 * `use-keys`: un hook en `helpers/` solo puede mirar `contracts`.
 */
export interface IUseSelectionInsumos {
  /** La coleccion entera. */
  keys: readonly IGameKey[];
  /** Las claves que se ven con los filtros de ahora. */
  visible: readonly IGameKey[];
  /** El filtro: de aqui sale si la vista es «solo disponibles» o «todos». */
  filter: IKeyFilter;
  /** Traduce la clave que devuelve `analyzeSelection`. */
  traducir: Translator;
}

export interface IUseSelection {
  /** Los ids marcados. Un `Set` porque la lista va camino de los quinientas. */
  selection: ReadonlySet<number>;
  /** Las claves marcadas, en el orden de la coleccion. */
  selectedKeys: readonly IGameKey[];
  /**
   * Las marcadas que aun se pueden regalar.
   *
   * Se calculan solas: con el ambito en «solo disponibles» lo que se ve ya son
   * todas regalables y la seleccion no puede contener ninguna que no lo sea;
   * con «todos» si puede mezclar estados, y entonces se descartan las que no.
   */
  actionableKeys: readonly IGameKey[];
  /** Que se puede hacer con la seleccion, y que esta bloqueado y por que. */
  facts: ISelectionFacts;
  /** Los ids de las marcadas, para pasarlos tal cual a los servicios. */
  selectionIds: readonly number[];
  /** `true` mientras haya algo marcado. */
  haySeleccion: boolean;
  toggleSelect: (entry: IGameKey) => void;
  /** Vacia la seleccion. Lo usan las acciones que acaban con ella. */
  clearSelection: () => void;
  /** Marca todo lo que se ve. */
  selectAll: () => void;
  /**
   * El texto que explica por que un boton esta apagado, o `undefined` si no
   * hay bloqueo.
   *
   * `analyzeSelection` devuelve la **clave** del diccionario y sus argumentos,
   * no el texto: es una funcion pura y no sabe en que idioma esta la app.
   * Aqui se traduce.
   */
  motivo: (action: SelectAction) => string | undefined;
}

/**
 * Lo que esta marcado, y todo lo que se deduce de ello.
 *
 * Antes eran un `useState`, cuatro `useMemo` y cuatro `useCallback` sueltos en
 * el componente, repartidos entre la seccion de estado y la de seleccion, con la
 * poda en un `useEffect` al otro lado del archivo. Diez piezas que solo tienen
 * sentido juntas: la seleccion no es un conjunto de ids, es **la seleccion** mas
 * lo que se puede hacer con ella.
 *
 * `visible` entra como parametro y no se calcula aqui a proposito. La lista
 * visible la produce el filtro **y** el orden, que son dos cosas del
 * componente; si el hook los hiciera, `selection` dependeria de `sort` y de
 * `ordenInverso` para nada: lo unico que necesita de ellos es la lista de ids.
 */
export function useSelection(insumos: IUseSelectionInsumos): IUseSelection {
  const { keys, visible, filter, traducir } = insumos;

  const [selection, setSelection] = useState<ReadonlySet<number>>(new Set());

  /*
   * Poda: deselecciona lo que el filtro deja fuera.
   *
   * Va en un efecto y no en `toggleSelect` porque en este punto ya se conoce la
   * lista **resultante**, que es la unica que importa: la poda necesita saber
   * que claves se ven de verdad, no cual sera el filtro nuevo. Y va aqui y no en
   * el componente por lo mismo que el resto: depende solo de `visible`, que es
   * lo unico que recibe.
   *
   * Solo se dispara cuando cambian las claves o el filtro, no cuando se
   * reordena. Es lo que se quiere: cambiar el orden no invalida nada.
   */
  useEffect(() => {
    setSelection((actual) => podarSeleccion(actual, visible));
  }, [visible]);

  const selectedKeys = useMemo(
    () => keys.filter((key) => selection.has(key.id)),
    [keys, selection],
  );

  const actionableKeys = useMemo(
    () =>
      filter.scope === KeyScope.Available
        ? selectedKeys
        : selectedKeys.filter((key) => isGiftable(key)),
    [selectedKeys, filter.scope],
  );

  const facts = useMemo(
    () => analyzeSelection(selectedKeys, filter.scope === KeyScope.All),
    [selectedKeys, filter.scope],
  );

  const selectionIds = useMemo(
    () => selectedKeys.map((key) => key.id),
    [selectedKeys],
  );

  const toggleSelect = useCallback((entry: IGameKey): void => {
    setSelection((anterior) => {
      const siguiente = new Set(anterior);

      if (siguiente.has(entry.id)) siguiente.delete(entry.id);
      else siguiente.add(entry.id);

      return siguiente;
    });
  }, []);

  const clearSelection = useCallback((): void => {
    setSelection(new Set());
  }, []);

  const selectAll = useCallback((): void => {
    setSelection(new Set(visible.map((key) => key.id)));
  }, [visible]);

  const motivo = useCallback(
    (action: SelectAction): string | undefined => {
      if (selectedKeys.length === 0) return traducir('app.nothingSelected');

      const bloqueo = facts.blocked.find((item) => item.action === action);

      return bloqueo === undefined
        ? undefined
        : traducir(bloqueo.messageKey, bloqueo.messageArgs);
    },
    [facts.blocked, selectedKeys.length, traducir],
  );

  return {
    selection,
    selectedKeys,
    actionableKeys,
    facts,
    selectionIds,
    haySeleccion: selection.size > 0,
    toggleSelect,
    clearSelection,
    selectAll,
    motivo,
  };
}