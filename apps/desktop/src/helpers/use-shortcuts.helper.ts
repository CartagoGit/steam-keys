import { useEffect, useRef } from 'react';

import { SEARCH_SHORTCUT } from '@/contracts';

/** Que dialogos hay abiertos. */
export interface IDialogosAbiertos {
  giftDialog: boolean;
  bulkStatusDialog: boolean;
  expireDialog: boolean;
  tagsDialog: boolean;
  settingsDialog: boolean;
  storageDialog: boolean;
  editorDialog: boolean;
  shortcutsDialog: boolean;
}

export interface IShortcutsOptions {
  dialogs: IDialogosAbiertos;
  /** Como se cierra cada dialogo. Cada uno sabe como recogerse. */
  onClose: {
    gift: () => void;
    bulkStatus: () => void;
    expire: () => void;
    tags: () => void;
    settings: () => void;
    storage: () => void;
    editor: () => void;
    shortcuts: () => void;
  };
  /** Cuantas claves hay marcadas. */
  haySeleccion: boolean;
  onClearSelection: () => void;
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
 * Va en cascada y no todos a la vez porque si no Escape cerraria el de atras
 * sin llegar al de delante, que es como se siente al pulsarlo una vez y ver que
 * no pasa nada. El orden es el de las capas: la barra de seleccion flota sobre
 * el resto, asi que sus dialogos van los primeros.
 */
const CASCADA = [
  ['giftDialog', 'gift'],
  ['bulkStatusDialog', 'bulkStatus'],
  ['expireDialog', 'expire'],
  ['tagsDialog', 'tags'],
  ['shortcutsDialog', 'shortcuts'],
  ['settingsDialog', 'settings'],
  ['storageDialog', 'storage'],
  ['editorDialog', 'editor'],
] as const;

/**
 * Atajos de teclado de la aplicacion.
 *
 * Vive fuera del componente porque no depende de nada suyo: mira que dialogos
 * hay abiertos y llama a lo que le pasen. Ahi eran ochenta lineas de `useEffect`
 * entre el arranque, los filtros y las acciones, y era lo unico que se podia
 * sacar sin tocar nada de lo demas.
 *
 * **Escape va antes del filtro de escritura**, y no por capricho: si hay un
 * dialogo abierto se lo lleva el, tenga el foco donde tenga. Si el foco esta en
 * un `<input>` sin nada abierto encima, Escape no hace nada, porque ahi lo que
 * se quiere es salir del campo y no borrar lo escrito.
 *
 * `Ctrl+Z` tambien va antes de ese filtro: con el foco en un campo de texto,
 * deshacer la ultima accion de la aplicacion es lo que espera quien lo pulsa.
 */
export function useShortcuts({
  dialogs,
  onClose,
  haySeleccion,
  onClearSelection,
  onOpenShortcuts,
  onOpenNewKey,
  onUndo,
  searchRef,
}: IShortcutsOptions): void {
  // `onClose` llega en un objeto nuevo en cada render. Guardarlo en un ref
  // evita que el efecto se reinstale —y quite y vuelva a poner el oyente— solo
  // porque alguien ha pulsado una tecla.
  const cierreRef = useRef(onClose);
  cierreRef.current = onClose;

  useEffect(() => {
    const alPulsar = (event: KeyboardEvent): void => {
      const destino = event.target as HTMLElement | null;
      const escribiendo = destino !== null && ESCRITURA.has(destino.tagName);

      if (event.key === 'Escape') {
        const abierto = CASCADA.find(([dialogo]) => dialogs[dialogo]);

        if (abierto !== undefined) {
          cierreRef.current[abierto[1]]();
          return;
        }

        // Sin dialogos encima, Escape limpia la seleccion: es lo que se espera
        // cuando hay un boton «Limpiar» en pantalla.
        if (haySeleccion) onClearSelection();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        onUndo();
        return;
      }

      if (escribiendo) return;

      if (event.key === SEARCH_SHORTCUT) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        onOpenShortcuts();
        return;
      }

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        onOpenNewKey();
      }
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [
    dialogs,
    haySeleccion,
    onClearSelection,
    onOpenNewKey,
    onOpenShortcuts,
    onUndo,
    searchRef,
  ]);
}