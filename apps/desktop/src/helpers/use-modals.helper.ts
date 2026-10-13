import { useCallback, useState } from 'react';

import {
  type IGameKey,
  type IImportSummary,
  type SettingsTab,
} from '@/contracts';
import { useKeepMounted } from './use-exit-animation.helper';

/** Un fichero ya leido y previsualizado, a la espera de que se acepte. */
export interface IStagedImport {
  fileName: string;
  contents: string;
  preview: IImportSummary;
}

export interface IModals {
  // --------------------------------------------------------- por fila ---
  /** Que clave se edita, o `null` si se esta creando otra. */
  editing: IGameKey | null;
  editorAbierto: boolean;
  /** Sobre `entrada` si la hay; en blanco si se omite. */
  openEditor: (entrada?: IGameKey | null) => void;
  closeEditor: () => void;
  /** Que clave se va a borrar, o `null` si el dialogo no esta abierto. */
  deleting: IGameKey | null;
  openDelete: (entrada: IGameKey) => void;
  closeDelete: () => void;

  // ----------------------------------------------------- por seleccion ---
  giftAbierto: boolean;
  openGift: () => void;
  closeGift: () => void;
  /** Para cambiar el estado de toda la seleccion a la vez. */
  bulkStatusAbierto: boolean;
  openBulkStatus: () => void;
  closeBulkStatus: () => void;
  tagsAbierto: boolean;
  openTags: () => void;
  closeTags: () => void;

  // ----------------------------------------------------------- ajustes ---
  settingsAbierto: boolean;
  settingsTab: SettingsTab;
  /** En la pestana pedida; si se omite, en la que se dejo la ultima vez. */
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  /** Se abre encima de Ajustes, no al lado. */
  gestorAbierto: boolean;
  openGestor: () => void;
  closeGestor: () => void;

  // ----------------------------------------------------------- sueltos ---
  openStorage: () => void;
  closeStorage: () => void;
  shortcutsAbierto: boolean;
  openShortcuts: () => void;
  closeShortcuts: () => void;
  /** La importacion a medio camino: sin escribir todavia en la base de datos. */
  stagedImport: IStagedImport | null;
  stageImport: (entrada: IStagedImport) => void;
  closeImport: () => void;

  // ------------------------------------------------------ animacion ---
  /**
   * `true` un rato despues de cerrarse, mientras se reproduce la salida.
   *
   * Sin esto el dialogo se borra de golpe y no hay ni un fotograma en el que
   * se vea. Va al lado de la bandera que lo enciende porque es lo que hay que
   * mirar al escribir el JSX, y separarlos era como se olvidaba uno.
   */
  editorVivo: boolean;
  storageVivo: boolean;
  settingsVivo: boolean;
  giftVivo: boolean;
  bulkStatusVivo: boolean;
  tagsVivo: boolean;
  shortcutsVivo: boolean;
}

/**
 * Los dialogos de la pantalla: que esta abierto, con que datos, y como se
 * abren y se cierran.
 *
 * Antes eran trece `useState` repartidos por cuatro secciones del componente —
 * fila, seleccion, ajustes y sueltos— y cada uno con su `setAlgoOpen` de
 * pareja. Abrir el editor, por ejemplo, eran dos lineas y en el orden justo:
 *
 *   setEditing(null);      // crear...
 *   setEditorOpen(true);  // ...y abrir
 *
 * Esas dos lineas se pueden dejar en el orden equivocado, y el error no sale
 * por ningun sitio: el dialogo se abre editando la fila que hubiera, o se abre
 * vacio sobre una fila que se queria editar. Aqui es una sola accion, y el par
 * —que clave se edita y si se esta abierto— no se puede separar.
 *
 * Lo mismo con los ajustes: se llama desde la lista y desde el editor, y los
 * dos piden una pestana concreta. Bandera y pestana salen juntas porque abrir
 * sin ellas separarlas es el otro sitio donde se puede equivocar uno.
 */
export function useModals(): IModals {
  // ------------------------------------------------------------ por fila ---
  /**
   * Que clave se esta editando, o `null` si se esta creando otra.
   *
   * El valor es tambien la bandera de que se edita: hay editor abierto si esto
   * no es `null`, y por eso no se suelta al cerrar. Se suelta **al abrir** el
   * siguiente, que es donde importa: si se soltara al cerrar, mientras se
   * reproduce la salida el formulario perderia los datos que esta enseñando.
   */
  const [editing, setEditing] = useState<IGameKey | null>(null);
  const [editorAbierto, setEditorAbierto] = useState(false);

  const openEditor = useCallback((entrada?: IGameKey | null): void => {
    setEditing(entrada ?? null);
    setEditorAbierto(true);
  }, []);

  const closeEditor = useCallback((): void => setEditorAbierto(false), []);

  /** Que clave se va a borrar, o `null` si el dialogo no esta abierto. */
  const [deleting, setDeleting] = useState<IGameKey | null>(null);

  /** Abrirlo sin clave no significa nada, asi que el argumento es obligatorio. */
  const openDelete = useCallback((entrada: IGameKey): void => setDeleting(entrada), []);

  const closeDelete = useCallback((): void => setDeleting(null), []);

  // -------------------------------------------------------- por seleccion ---
  const [giftAbierto, setGiftAbierto] = useState(false);
  const [bulkStatusAbierto, setBulkStatusAbierto] = useState(false);
  const [tagsAbierto, setTagsAbierto] = useState(false);

  const openGift = useCallback((): void => setGiftAbierto(true), []);
  const closeGift = useCallback((): void => setGiftAbierto(false), []);

  const openBulkStatus = useCallback((): void => setBulkStatusAbierto(true), []);
  const closeBulkStatus = useCallback((): void => setBulkStatusAbierto(false), []);

  const openTags = useCallback((): void => setTagsAbierto(true), []);
  const closeTags = useCallback((): void => setTagsAbierto(false), []);

  // ------------------------------------------------------------- ajustes ---
  const [settingsAbierto, setSettingsAbierto] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('appearance');

  const openSettings = useCallback((tab?: SettingsTab): void => {
    if (tab !== undefined) setSettingsTab(tab);

    setSettingsAbierto(true);
  }, []);

  const closeSettings = useCallback((): void => setSettingsAbierto(false), []);

  /**
   * El gestor de etiquetas se abre **encima** de Ajustes.
   *
   * Vive dentro de los ajustes y no al lado porque edita el vocabulario de
   * toda la coleccion, no una fila. Montarlo aqui encima del dialogo hace que
   * al cerrar se vuelva a Ajustes en lugar de a la lista, que es donde se ha
   * elegido ir.
   */
  const [gestorAbierto, setGestorAbierto] = useState(false);

  const openGestor = useCallback((): void => setGestorAbierto(true), []);
  const closeGestor = useCallback((): void => setGestorAbierto(false), []);

  // ------------------------------------------------------------- sueltos ---
  const [storageAbierto, setStorageAbierto] = useState(false);
  const [shortcutsAbierto, setShortcutsAbierto] = useState(false);

  const openStorage = useCallback((): void => setStorageAbierto(true), []);
  const closeStorage = useCallback((): void => setStorageAbierto(false), []);

  const openShortcuts = useCallback((): void => setShortcutsAbierto(true), []);
  const closeShortcuts = useCallback((): void => setShortcutsAbierto(false), []);

  /**
   * La importacion a medio camino: el fichero ya leido y previsualizado, pero
   * sin escribir en la base de datos.
   *
   * El valor **es** la bandera. No hay un `importAbierto` al lado porque
   * entonces habria que mantener los dos sincronizados, y basta con que uno se
   * suelte un fotograma antes que el otro para que aparezca un dialogo vacio.
   */
  const [stagedImport, setStagedImport] = useState<IStagedImport | null>(null);

  const stageImport = useCallback(
    (entrada: IStagedImport): void => setStagedImport(entrada),
    [],
  );

  const closeImport = useCallback((): void => setStagedImport(null), []);

  return {
    editing,
    editorAbierto,
    openEditor,
    closeEditor,
    deleting,
    openDelete,
    closeDelete,

    giftAbierto,
    openGift,
    closeGift,
    bulkStatusAbierto,
    openBulkStatus,
    closeBulkStatus,
    tagsAbierto,
    openTags,
    closeTags,

    settingsAbierto,
    settingsTab,
    openSettings,
    closeSettings,
    gestorAbierto,
    openGestor,
    closeGestor,

    openStorage,
    closeStorage,
    shortcutsAbierto,
    openShortcuts,
    closeShortcuts,

    stagedImport,
    stageImport,
    closeImport,

    editorVivo: useKeepMounted(editorAbierto),
    storageVivo: useKeepMounted(storageAbierto),
    settingsVivo: useKeepMounted(settingsAbierto),
    giftVivo: useKeepMounted(giftAbierto),
    bulkStatusVivo: useKeepMounted(bulkStatusAbierto),
    tagsVivo: useKeepMounted(tagsAbierto),
    shortcutsVivo: useKeepMounted(shortcutsAbierto),
  };
}