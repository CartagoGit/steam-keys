import { useCallback, useRef, useState } from 'react';

import type { IGameKey } from '@/contracts';

/**
 * De donde saca las claves el hook.
 *
 * Va **por parametro** y no importado por capas, igual que `IArranqueInsumos`:
 * un hook en `helpers/` solo puede mirar `contracts`. Importando
 * `game-key.service` desde aqui, el fichero rompia la cadena
 * (`helpers -> services`) y arrastraba Tauri entero a cualquier test que
 * quisiera ejercitarlo.
 */
export interface IUseKeysInsumos {
  /** Lee la tabla entera. */
  listar: () => Promise<readonly IGameKey[]>;
  /** Se llama cuando la lectura falla. */
  onError: (message: string) => void;
}

export interface IUseKeys {
  /** La coleccion entera, sin filtrar. */
  keys: readonly IGameKey[];
  /** `true` en cuanto se ha intentado leer una vez, salga bien o mal. */
  loaded: boolean;
  /** Vuelve a leer la tabla entera. `null` si fallo. */
  reload: () => Promise<readonly IGameKey[] | null>;
  /** Sustituye una clave en memoria, o la anade si no estaba. */
  patchKey: (clave: IGameKey) => void;
  /**
   * Parchea el resultado de una accion: una clave o una lista.
   *
   * Con la lista vacia **relee**: vacio puede ser «no hay nada que mostrar» o
   * «no he leido», y en el segundo caso parcheando nada la lista se quedaria
   * vacia para siempre.
   */
  patch: (cambios: IGameKey | readonly IGameKey[]) => Promise<void>;
  /** Quita claves de memoria. */
  removeKeys: (ids: readonly number[]) => void;
}

/** * Sustituye una clave en la lista, o la anade si no estaba.
 *
 * Va **fuera** del hook y exportada para poder probarla sin montar React. Es la
 * misma division que hacen `use-loading.helper.ts` con `conTiempoLimite` y
 * `undo.helper.ts` con `borradorDe`: el hook pega las piezas, estas son las que
 * tienen reglas, y las reglas se prueban.
 *
 * Solo sustituye, y no reordena: el orden lo pone `sortKeys` en cada repintado
 * a partir de la lista, asi que si el titulo o la fecha han cambiado la fila se
 * mueve sola.
 *
 * Y si la clave no estaba, **se anade** en vez de ignorarse: perder una fila es
 * peor que tenerla de mas, y quien llega aqui acaba de guardarla en la base de
 * datos. Pasa con las que vienen de una fusion o de un import, que traen ids
 * de otra base.
 *
 * Devuelve un array nuevo en los dos caminos. Mutar el anterior haria que React
 * no repintase, porque es el mismo objeto y `Object.is` da igual.
 */
export function patchKeyIn(
  list: readonly IGameKey[],
  clave: IGameKey,
): readonly IGameKey[] {
  const existe = list.some((otra) => otra.id === clave.id);

  if (!existe) return [...list, clave];

  return list.map((otra) => (otra.id === clave.id ? clave : otra));
}

/**
 * Quita de la lista las claves con los ids dados.
 *
 * Va fuera del hook por lo mismo que `patchKeyIn`, y por la misma regla: los
 * ids van en un `Set` porque la lista va camino de los quinientas y un
 * `includes` por cada clave seria cuadratico.
 */
export function removeKeysFrom(
  list: readonly IGameKey[],
  ids: readonly number[],
): readonly IGameKey[] {
  const fuera = new Set(ids);

  return list.filter((clave) => !fuera.has(clave.id));
}

/** * La coleccion de claves, y las cuatro maneras de cambiarla.
 *
 * Existe porque `keys` no la usa solo un trozo del componente: la pintan la
 * lista, el resumen del pie, los menus de filtro, el dialogo de etiquetas y el
 * emparejamiento con la biblioteca de Steam. Es el dato mas compartilhado que
 * hay, y estaba repartido entre el `useState` y cuatro `useCallback` al final
 * de un componente de dos mil lineas.
 *
 * Lo que mas se gana es `patchKey`. Antes, guardar una clave, borrarla o
 * cambiarla de estado releia la tabla entera: con cuatrocientas claves son
 * 6,5 MB y medio segundo para pintar un numero que ya se sabia. Ahora el
 * servicio devuelve la fila tal como ha quedado y solo se sustituye esa.
 *
 * `reload` sigue existiendo y es lo que se usa cuando el cambio afecta a
 * **muchas** claves de golpe —borrar una etiqueta las toca todas— o cuando
 * las filas vienen de otra parte y con otros ids. Ese caso no se puede
 * parchear: no sabes de aqui que mas ha cambiado.
 *
 * Nada reordena: el orden lo pone `sortKeys` en cada repintado a partir de
 * `keys`, asi que si cambia el titulo o la fecha la fila se mueve sola.
 */
export function useKeys(insumos: IUseKeysInsumos): IUseKeys {
  const [keys, setKeys] = useState<readonly IGameKey[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async (): Promise<readonly IGameKey[] | null> => {
    try {
      const cargadas = await insumos.listar();

      setKeys(cargadas);

      return cargadas;
    } catch (cause) {
      insumos.onError(cause instanceof Error ? cause.message : String(cause));

      return null;
    } finally {
      setLoaded(true);
    }
  }, [insumos]);

  /*
   * El `reload` de ahora, para poder llamarlo desde `patch` sin que `patch`
   * dependa de el.
   *
   * Aqui no es por el idioma —`notify` no cambia nunca, asi que `reload` tampoco
   * cambia de identidad— sino por la red de dependencias: sin este ref,
   * `patch` tendria a `reload` en su lista, y con el recrearia a `patch` y a
   * todos los manejadores que la usan.
   */
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const patchKey = useCallback((clave: IGameKey): void => {
    setKeys((actuales) => patchKeyIn(actuales, clave));
  }, []);

  const patch = useCallback(
    async (cambios: IGameKey | readonly IGameKey[]): Promise<void> => {
      /*
       * Se distingue por la forma, no por el tipo: lo que sale de
       * `gameKeyService` es un `IGameKey` para guardar una clave y una lista
       * para las acciones en bloque, y no hay una marca que los separe.
       */
      if (!Array.isArray(cambios)) {
        patchKey(cambios as IGameKey);

        return;
      }

      if (cambios.length === 0) {
        await reloadRef.current();

        return;
      }

      for (const clave of cambios) patchKey(clave);
    },
    [patchKey],
  );

  const removeKeys = useCallback((ids: readonly number[]): void => {
    setKeys((actuales) => removeKeysFrom(actuales, ids));
  }, []);

  return { keys, loaded, reload, patchKey, patch, removeKeys };
}