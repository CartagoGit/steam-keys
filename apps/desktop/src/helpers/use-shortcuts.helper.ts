import { useEffect, useRef } from 'react';

import { SEARCH_SHORTCUT } from '@/contracts';

/** Que dialogos hay abiertos. */
export interface IDialogosAbiertos {
  giftDialog: boolean;
  bulkStatusDialog: boolean;
  expireDialog: boolean;
  tagsDialog: boolean;
  shortcutsDialog: boolean;
  settingsDialog: boolean;
  storageDialog: boolean;
  editorDialog: boolean;
  /** Confirmacion de borrar. No es un `Modal`, pero ocupa la misma capa. */
  deleteDialog: boolean;
  /** Previsualizacion de la importacion. Igual que el anterior. */
  importDialog: boolean;
}

/** Nombres de los cierres, uno por dialogo. */
export type TDialogoId =
  | 'gift'
  | 'bulkStatus'
  | 'expire'
  | 'tags'
  | 'shortcuts'
  | 'settings'
  | 'storage'
  | 'editor'
  | 'deleteDialog'
  | 'importDialog';

export interface IShortcutsOptions {
  dialogs: IDialogosAbiertos;
  /** Como se cierra cada dialogo. Cada uno sabe como recogerse. */
  onClose: Record<TDialogoId, () => void>;
  /** Cuantas claves hay marcadas. */
  haySeleccion: boolean;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onOpenShortcuts: () => void;
  onOpenNewKey: () => void;
  onUndo: () => void;
  /** El campo de busqueda, para el atajo `/`. */
  searchRef: React.RefObject<HTMLInputElement | null>;
}

/** Etiquetas que reciben el foco, donde una tecla es texto y no atajo. */
const ESCRITURA = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * El orden en que Escape va cerrando, del mas reciente al mas viejo.
 *
 * Todos los dialogos comparten `z-50`, asi que el de encima es el **ultimo** del
 * arbol, no el de mayor indice: el orden de esta tabla es el inverso al orden en
 * que se montan. Sacarlo mal tiene una consecuencia concreta: con los ajustes
 * abiertos, `n` pone el editor encima, Escape cierra los ajustes, y el editor se
 * queda solo en pantalla con el fondo oscurecido y sin forma de cerrarse con la
 * tecla que se acaba de usar.
 *
 * Va como lista y no como objeto porque en JavaScript el orden de las claves de
 * un objeto no esta garantizado, y aqui el orden es lo unico que importa.
 */
const CASCADA: readonly (readonly [keyof IDialogosAbiertos, TDialogoId])[] = [
  ['importDialog', 'importDialog'],
  ['deleteDialog', 'deleteDialog'],
  ['giftDialog', 'gift'],
  ['bulkStatusDialog', 'bulkStatus'],
  ['expireDialog', 'expire'],
  ['tagsDialog', 'tags'],
  ['shortcutsDialog', 'shortcuts'],
  ['editorDialog', 'editor'],
  ['settingsDialog', 'settings'],
  ['storageDialog', 'storage'],
];

/** El cierre mas reciente que esta abierto, o `undefined` si no hay ninguno. */
export function dialogoSuperior(
  dialogs: IDialogosAbiertos,
): TDialogoId | undefined {
  const abierto = CASCADA.find(([dialogo]) => dialogs[dialogo]);

  return abierto === undefined ? undefined : abierto[1];
}

/**
 * Atajos de teclado de la aplicacion.
 *
 * Vive fuera del componente porque no depende de nada suyo: mira que dialogos
 * hay abiertos y llama a lo que le pasen. Ahi eran ochenta lineas de `useEffect`
 * entre el arranque, los filtros y las acciones.
 *
 * **Escape va antes del filtro de escritura**, y no por capricho: si hay un
 * dialogo abierto se lo lleva el, tenga el foco donde tenga. Si el foco esta en
 * un `<input>` sin nada abierto encima, Escape no hace nada, porque ahi lo que
 * se quiere es salir del campo y no borrar lo escrito.
 *
 * **`Ctrl+Z` tambien va antes**, por el mismo motivo: con el foco en un campo,
 * deshacer la ultima accion de la aplicacion es lo que espera quien lo pulsa.
 *
 * El resto de atajos, en cambio, **no** saltan con un dialogo abierto. Antes si,
 * y era un fallo: `n` ponia el editor de claves encima de los ajustes, `?`
 * apilaba un dialogo sobre otro y `/` robaba el foco de lo que hubiera detrás.
 * Un atajo que apila ventanas sin querer no es un atajo.
 */
export function useShortcuts({
  dialogs,
  onClose,
  haySeleccion,
  onClearSelection,
  onSelectAll,
  onOpenShortcuts,
  onOpenNewKey,
  onUndo,
  searchRef,
}: IShortcutsOptions): void {
  /**
   * Todo lo que cambia de identidad en cada render va en un ref.
   *
   * `dialogs` y `onClose` llegan como objetos literales construidos en el JSX
   * del componente, asi que son nuevos en cada repintado. Metidos en la lista de
   * dependencias, reinstalarian el oyente entero en cada repintado: quitar y
   * volver a poner el listener es justo lo que hace que un teclado deje de
   * responder sin que se vea por que.
   */
  const loVivo = useRef({
    dialogs,
    onClose,
    haySeleccion,
    onClearSelection,
    onSelectAll,
    onOpenShortcuts,
    onOpenNewKey,
    onUndo,
  });
  loVivo.current = {
    dialogs,
    onClose,
    haySeleccion,
    onClearSelection,
    onSelectAll,
    onOpenShortcuts,
    onOpenNewKey,
    onUndo,
  };

  useEffect(() => {
    const alPulsar = (event: KeyboardEvent): void => {
      const ahora = loVivo.current;
      const destino = event.target as HTMLElement | null;
      const escribiendo = destino !== null && ESCRITURA.has(destino.tagName);
      const abierto = dialogoSuperior(ahora.dialogs);

      if (event.key === 'Escape') {
        if (abierto !== undefined) {
          ahora.onClose[abierto]();
          return;
        }

        // Sin dialogos encima, Escape limpia la seleccion: es lo que se espera
        // cuando hay un boton «Limpiar» en pantalla.
        if (ahora.haySeleccion) ahora.onClearSelection();
        return;
      }

      const conModificador = event.ctrlKey || event.metaKey;
      const tecla = event.key.toLowerCase();

      if (conModificador && tecla === 'z') {
        event.preventDefault();
        ahora.onUndo();
        return;
      }

      // `Ctrl+A` marca todo lo que se ve. Solo con la lista: encima de un dialogo
      // no tiene sentido marcar cosas que quedan tapadas.
      if (conModificador && tecla === 'a' && abierto === undefined) {
        event.preventDefault();
        ahora.onSelectAll();
        return;
      }

      // Con un dialogo abierto no se apila nada mas encima, y dentro de un
      // campo de texto una tecla es texto.
      if (abierto !== undefined || escribiendo) return;

      // Los atajos de una sola tecla no deben pisar los del navegador: `Ctrl+P`
      // imprime. Va despues del bloque de los que si llevan modificador, no
      // antes, porque esos no se deben anular.
      if (conModificador || event.altKey) return;

      if (event.key === SEARCH_SHORTCUT) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        ahora.onOpenShortcuts();
        return;
      }

      if (tecla === 'n') {
        event.preventDefault();
        ahora.onOpenNewKey();
      }
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [searchRef]);
}