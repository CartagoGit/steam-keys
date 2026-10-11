import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { translate } from '@/helpers/i18n.helper';
import { LocaleContext, useT, type ITranslator } from './context/locale.context';

import { BulkStatusDialog } from './components/bulk-status-dialog.component';
import { ConfirmDialog, ToastStack, type IToast, type ToastTone } from './components/feedback.component';
import { GiftDialog } from './components/gift-dialog.component';
import { Icon } from './components/icon.component';
import { ImportPreview } from './components/import-preview.component';
import { KeyEditor } from './components/key-editor.component';
import { KeyRow } from './components/key-row.component';
import { SelectionBar } from './components/selection-bar.component';
import { SettingsDialog, type SettingsTab } from './components/settings-dialog.component';
import { StoragePanel } from './components/storage-panel.component';
import { SteamGamesTable } from './components/steam-games-table.component';
import { SteamNotConnected } from './components/view-switch.component';
import { TagsDialog } from './components/tags-dialog.component';
import { Toolbar } from './components/toolbar.component';
import { Button } from './components/ui.component';

import { PAGE_SIZE, SEARCH_SHORTCUT } from '@/contracts/constants/app.constants';
import { AppView, DEFAULT_VIEW } from '@/contracts/enums/app-view.enum';
import { KeyKind, KeyScope } from '@/contracts/enums/key-scope.enum';
import { KeySort } from '@/contracts/enums/key-sort.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { computeStats, emptyFilter, filterKeys, sortKeys } from '@/helpers/filter-keys.helper';
import { analyzeSelection, claveGrupo, groupByTitle, podarSeleccion, type SelectAction } from '@/helpers/selection.helper';
import { mergeTags, removeTags } from '@/contracts/constants/tag.constants';
import { useKeepMounted } from '@/helpers/use-exit-animation.helper';
import type { TranslationArgs, Translator } from '@/contracts/constants/i18n.constants';
import type { IStartup } from '@/services/startup.service';
import type { AppLocale } from '@/contracts/enums/app-locale.enum';
import { gameKeyService } from '@/services/game-key.service';
import { settingsService, DEFAULT_SETTINGS } from '@/services/settings.service';
import { storageService } from '@/services/storage.service';
import { inspectStartup } from '@/services/startup.service';
import {
  legacyBackupsMigrated,
  migrateLegacyBackups,
} from '@/services/legacy-backups.service';
import { FirstRun } from '@/components/first-run.component';
import { getDatabaseClient } from '@/repositories/repository.factory';
import { steamService, SteamError, resolveSteamId } from '@/services/steam.service';
import {
  getStorageMode,
  STORAGE_MODE_LABEL,
  STORAGE_MODE_NOTICE,
} from '@/helpers/runtime.helper';
import type {
  IGameKey,
  IGameKeyDraft,
} from '@/contracts/interfaces/game-key.interface';
import type { IKeyFilter } from '@/contracts/interfaces/key-filter.interface';
import type { IImportSummary } from '@/contracts/interfaces/import-summary.interface';
import type { IAppSettings } from '@/contracts/interfaces/app-settings.interface';
import type {
  ISteamOwnedGame,
  SteamAccountStatus,
} from '@/contracts/interfaces/steam-account.interface';

/** Ciclo de estados al pulsar sobre la pastilla de una fila. */
const STATUS_CYCLE: readonly KeyStatus[] = [
  KeyStatus.Available,
  KeyStatus.Gifted,
  KeyStatus.Redeemed,
  KeyStatus.Expired,
  KeyStatus.Unknown,
];

/**
 * El filtro arranca con lo que se dejo la ultima vez.
 *
 * Sin esto, cada vez que se abre la app hay que volver a decidir si se quiere
 * ver todo o solo lo disponible, y casi siempre es lo mismo de ayer.
 */
function initialFilter(cargados: IAppSettings): IKeyFilter {
  const base = emptyFilter();

  return {
    ...base,
    scope: (cargados.lastScope as KeyScope) || base.scope,
    kind: (cargados.lastKind as KeyKind) || base.kind,
  };
}

export function App() {
  const [keys, setKeys] = useState<readonly IGameKey[]>([]);
  const [filter, setFilter] = useState<IKeyFilter>(emptyFilter);
  const [sort, setSort] = useState<KeySort>(KeySort.Alfabetico);
  const [editing, setEditing] = useState<IGameKey | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<IGameKey | null>(null);
  const [toasts, setToasts] = useState<readonly IToast[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);

  // ------------------------------------------------------- seleccion ---
  /**
   * Ids de las claves seleccionadas. Un `Set` porque la lista va camino de los
   * quinientas y recorrerlo entero en cada pulsacion se nota.
   */
  const [selection, setSelection] = useState<ReadonlySet<number>>(new Set());

  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [expireDialogOpen, setExpireDialogOpen] = useState(false);
  /** Dialogo para cambiar el estado de toda la seleccion a la vez. */
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  // ---------------------------------------------------------- ajustes ---
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Con que pestana se abren los ajustes. Cambia al pedirlo desde fuera. */
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('appearance');
  const [settings, setSettings] = useState<IAppSettings>(DEFAULT_SETTINGS);

  /**
   * `true` cuando los ajustes ya se han leido de la base de datos.
   *
   * Existe para una sola cosa: que el filtro **no se guarde hasta haber sido
   * leido**. Al montar, el estado vale `emptyFilter` (solo disponibles, que es
   * el valor por defecto), y si el efecto de guardado se disparase ahi
   * escribiria ese valor por encima del que si habia quedado de la sesion
   * anterior. El resultado era que el filtro no se recordaba nunca.
   */
  const [ajustesListos, setAjustesListos] = useState(false);

  /**
   * Si al arrancar hay base de datos o no.
   *
   * `null` mientras se comprueba, que es un estado distinto de los dos: no se
   * puede pintar el aviso de "no hay base de datos" antes de saber si la hay, o
   * un arranque lento enseño un aviso falso.
   *
   * Mientras vale `empty` **no se abre la base de datos**, y por tanto no se
   * llama a `migrate()` ni se escribe nada. Es lo que evita que aparezca un
   * `steam-keys.db` de cero bytes el simple hecho de arrancar el programa.
   */
  const [arranque, setArranque] = useState<IStartup | null>(null);

  /**
   * Que tabla se ve: las claves o los juegos de Steam.
   *
   * No es un filtro sino otra coleccion, asi que no vive en `filter`. Se
   * guarda igualmente para que la app se abra donde se dejo.
   */
  const [vista, setVista] = useState<AppView>(DEFAULT_VIEW);

  /**
   * El idioma en pantalla, para que los componentes hijos traduzcan ya con el
   * idioma bueno desde el primer render y no un fotograma tarde.
   */
  const [idioma, setIdioma] = useState<AppLocale>(DEFAULT_SETTINGS.locale);

  const t = useMemo<ITranslator>(
    () => ({
      locale: idioma,
      setLocale: setIdioma,
      // Se declara como propiedad y no como metodo abreviado porque el
      // interfaz `ITranslator` declara el traducir como una llamada, y asi el
      // tipo es exactamente el mismo que el que consumen los componentes.
      t: (clave: string, args?: TranslationArgs) => translate(idioma, clave, args),
    }),
    [idioma],
  );

  /**
   * Traducir desde aqui, sin `useT()`.
   *
   * Este componente es el que **provee** el contexto de idioma, asi que no
   * puede consumirlo: seria pedir un valor a si mismo. Como es quien tiene
   * `idioma` a mano, traduce directamente. Antes no traducia nada y por eso
   * toda la vista principal (avisos, pie de pagina, avisos de error) salia en
   * castellano con la app en cualquier otro idioma.
   */
  const traducir = useCallback<Translator>(
    (clave, args) => translate(idioma, clave, args),
    [idioma],
  );

  const [owned, setOwned] = useState<readonly ISteamOwnedGame[]>([]);
  const [cuenta, setCuenta] = useState<SteamAccountStatus>({
    conectado: false,
    steamId: '',
    juegos: 0,
    sincronizadoAt: null,
    perfilPrivado: false,
  });

  const [stagedImport, setStagedImport] = useState<{
    fileName: string;
    contents: string;
    preview: IImportSummary;
  } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const nextToastId = useRef(1);

  // ------------------------------------------------------ cierre animado ---
  // Los dialogos se desmontan en cuanto su condicion pasa a `false`, y ahi no
  // hay ni un fotograma en el que se vea la animacion de salida. Estos hooks
  // los mantienen montados el tiempo justo para que se vea desaparecer.
  const editorVivo = useKeepMounted(editorOpen);
  const storageVivo = useKeepMounted(storageOpen);
  const settingsVivo = useKeepMounted(settingsOpen);
  const giftVivo = useKeepMounted(giftDialogOpen);
  const expireVivo = useKeepMounted(expireDialogOpen);
  const bulkVivo = useKeepMounted(bulkStatusOpen);
  const tagsVivo = useKeepMounted(tagsOpen);

  // ------------------------------------------------------------- avisos ---
  const notify = useCallback((message: string, tone: ToastTone = 'info'): void => {
    const id = nextToastId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: number): void => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  // --------------------------------------------------------- carga de datos ---
  /**
   * Comprueba si hay base de datos **antes** de abrirla.
   *
   * Va el primero de todo y por su cuenta. Abrir la base de datos la crea: por
   * eso la pregunta tiene que ser "mira el fichero", no "abre y mira si hay
   * tablas". Preguntar despues de abrir seria tarde, el fichero ya esta en disco.
   *
   * Si el idioma guardado se lee aqui se perderia el motivo de mirar el
   * fichero: `settingsService.load()` abre la base de datos, y con eso ya no se
   * puede saber si estaba antes. Por eso el arranque va aparte y, mientras valga
   * `empty`, los dos efectos de carga de abajo no llegan a dispararse.
   */
  useEffect(() => {
    const mirar = async (): Promise<void> => {
      const estado = await inspectStartup();

      // El idioma sale aqui, y no de los ajustes, porque todavia no hay ajustes
      // que leer: estan dentro de la base de datos que estamos comprobando.
      setIdioma(estado.locale);
      setArranque(estado);
    };

    void mirar();
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    try {
      setKeys(await gameKeyService.list());
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.loadFailed'),
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    // Sin base de datos no se toca nada: ni claves, ni ajustes. Es lo que
    // mantiene el programa sin crear un fichero vacio al abrirlo.
    if (arranque?.database !== 'ready') return;

    void reload();
  }, [reload, arranque]);

  /** Carga los ajustes y, si ya habia una cuenta conectada, su biblioteca. */
  useEffect(() => {
    if (arranque?.database !== 'ready') return;

    const cargar = async (): Promise<void> => {
      try {
        const cargados = await settingsService.load();
        setSettings(cargados);
        setIdioma(cargados.locale);
        applyTheme(cargados.theme);
        setFilter(initialFilter(cargados));
        setVista(cargados.lastView === AppView.Games ? AppView.Games : DEFAULT_VIEW);

        if (cargados.steamApiKey && cargados.steamId) {
          const juegos = await steamService.getOwnedGames(
            cargados.steamApiKey,
            cargados.steamId,
          );

          setOwned(juegos);
          setCuenta({
            conectado: true,
            steamId: cargados.steamId,
            juegos: juegos.length,
            sincronizadoAt: cargados.steamSyncedAt,
            perfilPrivado: false,
          });
        }
      } catch {
        // Sin ajustes, sin biblioteca, sin problema: la app sigue con las claves.
      } finally {
        // Se marca aqui y no dentro del `try`: aunque la carga falle, a partir
        // de este punto ya se puede guardar. Dejarlo en el `try` haria que una
        // base de datos que falla al leer nunca llegara a recordar el filtro,
        // que es justo cuando mas lo necesita uno.
        setAjustesListos(true);
      }
    };

    void cargar();
  }, [arranque]);

  /**
   * Trae las copias de seguridad que dejaron la version anterior.
   *
   * Hasta hace poco eran ficheros sueltos en una carpeta `backups/`; ahora son
   * filas de la tabla `backups`. Esta tarea las pasa de una cosa a la otra, una
   * sola vez, y **no borra los ficheros**: se quedan donde estaban por si algo
   * sale mal.
   *
   * Va despues de cargar los ajustes porque es quien fija la marca de "ya no
   * hace falta hacerlo"; si se hiciera antes, un fallo al guardar los ajustes
   * dejaria la migracion sin marcar y se repetiria en cada arranque.
   */
  useEffect(() => {
    if (arranque?.database !== 'ready') return;

    const migrar = async (): Promise<void> => {
      try {
        const db = await getDatabaseClient();

        if (await legacyBackupsMigrated(db)) return;

        await migrateLegacyBackups(db);
      } catch {
        // Sin carpeta de copias antiguas, o sin permisos para leerla: no hay
        // nada que hacer y la app sigue con lo que hay. Que la migracion no se
        // haya marcado como hecha no tiene consecuencia: los ficheros siguen
        // donde estaban y en el siguiente arranque se vuelve a mirar.
      }
    };

    void migrar();
  }, [arranque]);

  // --------------------------------------------------------------- filtros ---
  const patchFilter = useCallback((changes: Partial<IKeyFilter>): void => {
    setFilter((current) => ({ ...current, ...changes }));
  }, []);

  /**
   * Guarda el ambito, el tipo y la vista.
   *
   * Va en un efecto aparte y no dentro de `patchFilter` a proposito: si se
   * guardara ahi, cada pulsacion esperaria a la base de datos antes de repintar
   * la lista, que con cuatrocientas filas se nota. Aqui se guarda por detras y
   * la lista se actualiza al instante.
   *
   * La comprobacion de `ajustesListos` no es opcional: sin ella, el primer
   * volcado escribe los valores por defecto encima de los guardados.
   */
  useEffect(() => {
    if (!ajustesListos) return;

    void settingsService.setMany({
      lastScope: filter.scope,
      lastKind: filter.kind,
      lastView: vista,
    });
  }, [ajustesListos, filter.scope, filter.kind, vista]);

  const visible = useMemo(
    () => sortKeys(filterKeys(keys, filter), sort),
    [keys, filter, sort],
  );

  const stats = useMemo(() => computeStats(keys, visible.length), [keys, visible.length]);
  const page = useMemo(() => visible.slice(0, PAGE_SIZE), [visible]);

  /**
   * Deselecciona lo que el filtro deja fuera.
   *
   * Va en un efecto y no dentro de `patchFilter` porque en este punto ya se
   * conoce la lista **resultante**, que es la unica que importa: la poda
   * necesita saber que claves se ven de verdad, no cual sera el filtro nuevo.
   *
   * Solo mira `visible`, y por tanto solo cuando cambian las claves o el filtro,
   * no cuando se reordena la lista. Es lo que se quiere: cambiar el orden no
   * invalida nada, cambiar el filtro si.
   */
  useEffect(() => {
    setSelection((actual) => podarSeleccion(actual, visible));
  }, [visible]);

  /** Cuantas claves comparten cada titulo, para el contador de la fila. */
  const groups = useMemo(() => groupByTitle(keys), [keys]);

  /** Los nombres de los juegos que ya tienes en la cuenta de Steam. */
  const ownedNames = useMemo(
    () => new Set(owned.map((juego) => normalizar(juego.name))),
    [owned],
  );

  const esPropio = useCallback(
    (title: string): boolean => {
      const objetivo = normalizar(title);

      // Se busca tal cual primero: un DLC con su propio appid esta en la
      // biblioteca aunque el juego base no este.
      if (ownedNames.has(objetivo)) return true;

      // Y luego quitando la coletilla de edicion, porque "GOTY Edition" y la
      // edicion normal son el mismo juego y solo se compra una.
      const limpio = normalizar(stripEdition(title));
      return limpio.length > 0 && ownedNames.has(limpio);
    },
    [ownedNames],
  );

  // ----------------------------------------------------------- seleccion ---
  const selectedKeys = useMemo(
    () => keys.filter((key) => selection.has(key.id)),
    [keys, selection],
  );

  /**
   * Las seleccionadas que se pueden regalar.
   *
   * Se calculan solas, sin interruptor: si la vista esta en «Solo
   * disponibles» (que es lo unico que hay que decidir, y se decide en la barra
   * de filtros) lo que se ve ya son todas regalables, y la seleccion de esa
   * lista no puede contener ninguna que no lo sea. Con el filtro en «Todos» la
   * seleccion si puede mezclar estados, y entonces se descartan las que no.
   */
  const actionableKeys = useMemo(
    () => (filter.scope === KeyScope.Available ? selectedKeys : selectedKeys.filter(isAvailable)),
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

  /** El texto que explica por que un boton esta apagado. */
  const motivo = useCallback(
    (action: SelectAction): string | undefined => {
      if (selectedKeys.length === 0) return traducir('app.nothingSelected');

      return facts.blocked.find((bloqueo) => bloqueo.action === action)?.message;
    },
    [facts.blocked, selectedKeys.length],
  );

  // ------------------------------------------------------------- atajos ---
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';

      // Escape cierra primero lo que esta abierto encima. Se comprueba en orden de
      // capa, de mas nuevo a mas viejo: si no, Escape cerraria el dialogo de
      // atras sin llegar al de delante, que es como se siente al pulsar una vez
      // y ver que no pasa nada.
      if (event.key === 'Escape' && giftDialogOpen) {
        setGiftDialogOpen(false);
        return;
      }

      if (event.key === 'Escape' && bulkStatusOpen) {
        setBulkStatusOpen(false);
        return;
      }

      if (event.key === 'Escape' && expireDialogOpen) {
        setExpireDialogOpen(false);
        return;
      }

      if (event.key === 'Escape' && tagsOpen) {
        setTagsOpen(false);
        return;
      }

      if (event.key === 'Escape' && settingsOpen) {
        setSettingsOpen(false);
        return;
      }

      if (event.key === 'Escape' && storageOpen) {
        setStorageOpen(false);
        return;
      }

      if (event.key === 'Escape' && editorOpen) {
        setEditorOpen(false);
        setEditing(null);
        return;
      }

      // Escape limpia la seleccion antes que cualquier otra cosa: es lo que se
      // espera cuando hay un boton "Limpiar" en pantalla.
      if (event.key === 'Escape' && selection.size > 0) {
        clearSelection();
        return;
      }

      if (typing) return;

      if (event.key === SEARCH_SHORTCUT) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key.toLowerCase() === 'n') {
        setEditing(null);
        setEditorOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    bulkStatusOpen,
    editorOpen,
    expireDialogOpen,
    giftDialogOpen,
    selection.size,
    settingsOpen,
    storageOpen,
    tagsOpen,
    clearSelection,
  ]);

  // ------------------------------------------------------------ acciones ---
  const handleCreate = (): void => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleEdit = (entry: IGameKey): void => {
    setEditing(entry);
    setEditorOpen(true);
  };

  const handleSave = async (draft: IGameKeyDraft): Promise<void> => {
    if (editing) {
      await gameKeyService.update(editing.id, draft);
      notify(traducir('app.saved'), 'success');
    } else {
      await gameKeyService.create({
        title: draft.title,
        keyValue: draft.keyValue,
        platform: draft.platform,
        status: draft.status,
        giftedTo: draft.giftedTo,
        parentTitle: draft.parentTitle,
        note: draft.note,
        tags: draft.tags,
        addedOn: draft.addedOn,
      });
      notify(traducir('app.created'), 'success');
    }

    setEditorOpen(false);
    setEditing(null);
    await reload();
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) return;

    await gameKeyService.remove(deleting.id);
    setDeleting(null);
    notify(traducir('app.deleted'), 'success');
    await reload();
  };

  /**
   * Aplica un estado a varias claves de golpe.
   *
   * Se reciben los ids ya filtrados por el dialogo (que es quien decide que
   * transiciones tienen sentido), asi que aqui solo se escribe. Aun asi se
   * vuelve a comprobar el estado de cada una antes de escribir: entre que el
   * dialogo calcula el reparto y se pulsa el boton, la lista puede haber
   * cambiado, y escribir a ciegas dejaria claves en un estado que ya no
   * corresponde.
   */
  const handleApplyBulkStatus = async (
    ids: readonly number[],
    status: KeyStatus,
  ): Promise<number> => {
    /*
     * Los ids que llegan ya estan filtrados por el dialogo, que es quien sabe
     * que transiciones tienen sentido. Aun asi se vuelve a comprobar el estado
     * de cada una contra la lista **actual**, no contra la del render en el
     * que se creo el dialogo: entre abrirlo y pulsarlo la lista puede haber
     * cambiado, y escribir a ciegas dejaria claves en un estado que ya no
     * corresponde.
     */
    const porId = new Map(keys.map((key) => [key.id, key]));

    const aplicables = ids.filter((id) => {
      const entry = porId.get(id);

      if (!entry || entry.status === status) return false;

      // Cambiar a "regalada" exige decir a quien; sin destino no se escribe,
      // porque quedaria una clave regalada sin destinatario, que no significa
      // nada. El dialogo ya avisa de esto antes de aplicar.
      if (status === KeyStatus.Gifted && !entry.giftedTo?.trim()) return false;

      return true;
    });

    if (aplicables.length === 0) return 0;

    // Una sola operacion en vez de una por clave: con cuatrocientas filas
    // marcadas son cuatrocientas escrituras, y cada una es una ida y vuelta a
    // la base de datos. Ademas, escribir de una en una deja la coleccion a
    // medias si algo falla a mitad.
    await gameKeyService.setStatusMany(aplicables, status);
    await reload();

    // El aviso va **ademas** del mensaje del dialogo, no en vez de el: el
    // dialogo se puede cerrar sin leer y el cambio ya esta hecho.
    notify(traducir('bulk.done', [aplicables.length]), 'success');

    return aplicables.length;
  };

  const handleCycleStatus = async (entry: IGameKey): Promise<void> => {
    const index = STATUS_CYCLE.indexOf(entry.status);
    const next = STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length] ?? KeyStatus.Available;

    await gameKeyService.setStatus(entry.id, next);
    await reload();
  };

  /**
   * Guarda el TXT con las claves seleccionadas.
   *
   * El dialogo de guardado se abre **antes** de tocar los estados: si el
   * usuario cancela, las claves siguen disponibles y no se ha regalado nada.
   */
  const handleExportGift = async (): Promise<void> => {
    if (actionableKeys.length === 0) return;

    setBusy(true);

    try {
      const resultado = await gameKeyService.exportGiftSelection(actionableKeys);

      if (resultado === null) {
        notify(traducir('app.noFile'), 'info');
        return;
      }

      notify(
        resultado.total === 1
          ? traducir('app.exportOne', [resultado.path])
          : traducir('app.exportMany', [resultado.total, resultado.path]),
        'success',
      );
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.fileFailed'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmGift = async (destinatario: string): Promise<void> => {
    const limpio = destinatario.trim();

    // El boton ya esta apagado si va vacio; esto es la segunda red, por si
    // alguien llega aqui por el teclado o por una llamada directa.
    if (limpio.length === 0) {
      notify(traducir('app.needRecipient'), 'error');
      return;
    }

    if (actionableKeys.length === 0) return;

    setBusy(true);

    try {
      const total = actionableKeys.length;

      await gameKeyService.giftMany(
        actionableKeys.map((key) => ({ id: key.id, giftedTo: limpio })),
      );

      setSelection(new Set());
      setGiftDialogOpen(false);

      notify(
        total === 1
          ? traducir('app.giftedOne', [limpio])
          : traducir('app.giftedMany', [total, limpio]),
        'success',
      );
      await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.markFailed'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmExpire = async (): Promise<void> => {
    if (!facts.canExpire) return;

    const affected = selectedKeys.filter((key) => key.status !== KeyStatus.Expired);

    if (affected.length === 0) return;

    setBusy(true);

    try {
      const total = affected.length;

      await gameKeyService.setStatusMany(
        affected.map((key) => key.id),
        KeyStatus.Expired,
      );

      setSelection(new Set());
      setExpireDialogOpen(false);

      notify(
        total === 1
          ? traducir('app.expiredOne')
          : traducir('app.expiredMany', [total]),
        'success',
      );
      await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.markFailed'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * Aplica las etiquetas elegidas a la seleccion.
   *
   * Las etiquetas se **fusionan**, no se reemplazan: quien pulsa "etiquetas"
   * quiere añadir las que faltan, no borrar las que ya tenia la clave. El
   * boton de caducadas es el que cambia el estado.
   */
  const handleApplyTags = async (tags: readonly string[]): Promise<void> => {
    if (selectionIds.length === 0) return;

    setBusy(true);

    try {
      const total = selectionIds.length;

      for (const key of selectedKeys) {
        const juntadas = mergeTags(key.tags, tags);
        const sinLasNuevas = removeTags(juntadas, tags);
        const final = [...sinLasNuevas, ...tags.filter((tag) => !sinLasNuevas.includes(tag))];

        await gameKeyService.setTagsMany([key.id], final);
      }

      setSelection(new Set());
      setTagsOpen(false);

      notify(
        total === 1
          ? traducir('app.tagsOne')
          : traducir('app.tagsMany', [total]),
        'success',
      );
      await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.tagsFailed'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  // ----------------------------------------------------------- ajustes ---
  const handleSaveSettings = async (
    patch: Partial<IAppSettings>,
  ): Promise<string | null> => {
    try {
      await settingsService.setMany(patch);
      const cargados = await settingsService.load();
      setSettings(cargados);

      // El idioma se propaga al arbol entero para que los componentes traduzcan
      // ya, sin esperar al siguiente render del dialogo de ajustes.
      if (cargados.locale !== idioma) setIdioma(cargados.locale);

      applyTheme(cargados.theme);

      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : traducir('app.saveFailed');
    }
  };

  const handleLinkSteam = async (
    apiKey: string,
    steamId: string,
  ): Promise<string | null> => {
    if (apiKey.trim().length === 0) {
      return traducir('app.needApiKey');
    }

    setBusy(true);

    try {
      // Se resuelve lo que haya puesto: un numero de 17 cifras pasa tal cual
      // y un nombre de perfil se traduce contra el XML publico de Steam, que
      // no necesita clave.
      const id = await resolveSteamId(steamId);

      const juegos = await steamService.getOwnedGames(apiKey.trim(), id);
      const ahora = new Date().toISOString();

      await settingsService.setMany({
        steamApiKey: apiKey.trim(),
        steamId: id,
        steamLinked: true,
        steamSyncedAt: ahora,
      });

      setOwned(juegos);
      setSettings(await settingsService.load());
      setCuenta({
        conectado: true,
        steamId: id,
        juegos: juegos.length,
        sincronizadoAt: ahora,
        perfilPrivado: false,
      });

      notify(
        juegos.length === 1
          ? traducir('app.libraryOne')
          : traducir('app.libraryMany', [juegos.length]),
        'success',
      );

      return null;
    } catch (cause) {
      if (cause instanceof SteamError) {
        setCuenta((actual) => ({ ...actual, perfilPrivado: cause.codigo === 'perfilPrivado' }));
        return cause.message;
      }

      return traducir('app.linkFailed');
    } finally {
      setBusy(false);
    }
  };

  const handleForgetApiKey = async (): Promise<void> => {
    await settingsService.forgetApiKey();
    setSettings(await settingsService.load());
    setOwned([]);
    setCuenta({
      conectado: false,
      steamId: '',
      juegos: 0,
      sincronizadoAt: null,
      perfilPrivado: false,
    });
    notify(traducir('app.keyForgotten'), 'info');
  };

  // --------------------------------------------------------- importacion ---
  /**
   * Paso 1 de la importacion: leer el fichero y previsualizarlo.
   *
   * El dialogo nativo se abre **una sola vez** aqui. Antes se abria dos veces
   * (una para previsualizar y otra para confirmar), de modo que el usuario
   * podia acabar importando un fichero distinto del que habia visto.
   */
  const handleImport = async (): Promise<void> => {
    setBusy(true);

    try {
      const contents = await storageService.stageTxt();
      if (contents === null) return;

      const preview = await storageService.previewImport(contents);

      setStagedImport({ fileName: 'steam-keys.txt', contents, preview });
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.readFileFailed'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  /** Paso 2: confirmar e importar el contenido ya leido. */
  const handleConfirmImport = async (): Promise<void> => {
    if (!stagedImport) return;

    setBusy(true);

    try {
      const result = await storageService.commitImport(stagedImport.contents);

      notify(
        (result.inserted === 1
          ? traducir('app.importedOne')
          : traducir('app.importedMany', [result.inserted])) +
          (result.alreadyInDb > 0
            ? traducir('app.importedDupes', [result.alreadyInDb])
            : ''),
        'success',
      );

      setStagedImport(null);
      await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.importFailed'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    try {
      const result = await gameKeyService.exportToDialog();
      if (!result) return;

      notify(traducir('app.exported', [result.total]), 'success');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : traducir('app.exportFailed'), 'error');
    }
  };

  // ---------------------------------------------------------------- vista ---
  /** Abrir ajustes en una pestana concreta, sin tener que buscarla a mano. */
  const openSettingsAt = useCallback((tab: SettingsTab): void => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  /** AppIds de la coleccion, para marcar en la tabla que ya hay clave. */
  const appIdsConClave = useMemo(() => {
    const ids = new Set<number>();

    for (const key of keys) {
      const appId = (key as { steamAppId?: number | null }).steamAppId;

      if (typeof appId === 'number' && Number.isFinite(appId)) {
        ids.add(appId);
      }
    }

    return ids;
  }, [keys]);

  const handleRefreshSteam = useCallback(async (): Promise<void> => {
    setBusy(true);

    try {
      const juegos = await steamService.getOwnedGames(
        settings.steamApiKey,
        settings.steamId,
      );

      setOwned(juegos);
      setCuenta((current) => ({
        ...current,
        juegos: juegos.length,
        sincronizadoAt: new Date().toISOString(),
      }));

      await settingsService.set('steamSyncedAt', new Date().toISOString());
      notify(traducir('app.synced', [juegos.length]), 'success');
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.syncFailed'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  }, [notify, settings.steamApiKey, settings.steamId]);

  return (
    <LocaleContext.Provider value={t}>
    <div className="flex h-full flex-col bg-surface-0">
      {/*
       * Primer arranque. Va antes que la barra porque no hay coleccion todavia
       * y las dos cosas que se pueden hacer —traer la base de datos o empezar de
       * cero— son las unicas que existen: abrir la barra ofereceria filtros y
       * acciones sobre una lista vacia que todavia no esta ni en disco.
       */}
      {arranque === null ? null : arranque.database === 'empty' ? (
        <FirstRun
          databasePath={arranque.databasePath}
          onStartEmpty={() => setArranque({ ...arranque, database: 'ready' })}
        />
      ) : (
        <>
      <Toolbar
        filter={filter}
        stats={stats}
        sort={sort}
        busy={busy}
        searchRef={searchRef}
        view={vista}
        cuenta={cuenta}
        onFilterChange={patchFilter}
        onSortChange={setSort}
        onViewChange={setVista}
        onOpenSteamSettings={() => openSettingsAt('account')}
        onCreate={handleCreate}
        onImport={handleImport}
        onExport={handleExport}
        onOpenStorage={() => setStorageOpen(true)}
        onOpenSettings={() => openSettingsAt('appearance')}
      />

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {vista === AppView.Games ? (
          cuenta.conectado ? (
            <SteamGamesTable
              juegos={owned}
              cuenta={cuenta}
              conClave={appIdsConClave}
              onRefresh={handleRefreshSteam}
              busy={busy}
            />
          ) : (
            <SteamNotConnected onOpen={() => openSettingsAt('account')} />
          )
        ) : loading ? (
          <div className="flex h-full items-center justify-center text-sm text-t4">
            Cargando coleccion…
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            hasKeys={keys.length > 0}
            onCreate={handleCreate}
            onImport={handleImport}
            onClearFilters={() => setFilter(emptyFilter())}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {page.map((entry) => (
                <KeyRow
                  key={entry.id}
                  entry={entry}
                  onEdit={handleEdit}
                  onDelete={setDeleting}
                  onCycleStatus={handleCycleStatus}
                  selected={selection.has(entry.id)}
                  onToggleSelect={toggleSelect}
                  siblings={groups.get(claveGrupo(entry.title))?.total ?? 1}
                  ownedOnSteam={cuenta.conectado && esPropio(entry.title)}
                  tags={entry.tags}
                />
              ))}
            </div>

            {visible.length > page.length ? (
              <p className="mt-4 text-center text-xs text-t4">
                {traducir('footer.showing', [page.length, visible.length])}
              </p>
            ) : null}
          </>
        )}
      </main>

      <footer className="flex shrink-0 items-center justify-between border-t border-line bg-surface-1 px-4 py-2 text-[11px] text-t4">
        {vista === AppView.Games ? (
          <span>
            {traducir('footer.games', [cuenta.juegos])}
            {cuenta.steamId ? ` · ${cuenta.steamId}` : ''}
          </span>
        ) : (
        <span>
          {traducir('footer.count', [visible.length, keys.length])}
          {stats.available > 0 ? traducir('footer.giftable', [stats.available]) : ''}
        </span>
        )}
        <span className="flex items-center gap-3">
          <span
            title={traducir(STORAGE_MODE_NOTICE[getStorageMode()])}
            className={[
              'flex items-center gap-1.5',
              getStorageMode() === 'memory' ? 'text-warn' : 'text-t4',
            ].join(' ')}
          >
            <Icon name="package" size={12} />
            {traducir(STORAGE_MODE_LABEL[getStorageMode()])}
          </span>
          <span>
            <kbd className="rounded border border-white/10 px-1 py-0.5">{SEARCH_SHORTCUT}</kbd>{' '}
            {traducir('footer.shortcutSearch')} ·{' '}
            <kbd className="rounded border border-white/10 px-1 py-0.5">N</kbd> {traducir('footer.shortcutNew')}
          </span>
        </span>
      </footer>

      {stagedImport ? (
        <ImportPreview
          fileName={stagedImport.fileName}
          preview={stagedImport.preview}
          onConfirm={handleConfirmImport}
          onCancel={() => setStagedImport(null)}
        />
      ) : null}

      {storageVivo ? (
        <StoragePanel
          onClose={() => setStorageOpen(false)}
          onChanged={reload}
          notify={notify}
        />
      ) : null}

      {settingsVivo ? (
        <SettingsDialog
          open={settingsOpen}
          initialTab={settingsTab}
          settings={settings}
          cuenta={cuenta}
          onSave={handleSaveSettings}
          onLinkSteam={handleLinkSteam}
          onForgetApiKey={handleForgetApiKey}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {editorVivo ? (
        <KeyEditor
          entry={editing}
          onSave={handleSave}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={traducir('row.delete')}
          message={`Se eliminara "${deleting.title}" de tu coleccion. Esto no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}

      {/* ------------------------------------------------------- seleccion ---
          La barra solo aparece en la tabla de claves. En la de juegos no hay
          nada seleccionado ni seleccionable, asi que mostrarla seria un boton
          flotando sobre una tabla donde no hace nada. */}
      {vista === AppView.Keys && selectedKeys.length > 0 ? (
        <SelectionBar
          facts={facts}
          visibles={visible.length}
          onSelectAll={selectAll}
          onClear={clearSelection}
          onExport={handleExportGift}
          onMarkGifted={() => setGiftDialogOpen(true)}
          onBulkStatus={() => setBulkStatusOpen(true)}
          onTags={() => setTagsOpen(true)}
          motivo={motivo}
        />
      ) : null}

      {bulkVivo ? (
        <BulkStatusDialog
          open={bulkStatusOpen}
          entries={selectedKeys}
          onApply={handleApplyBulkStatus}
          onClose={() => setBulkStatusOpen(false)}
        />
      ) : null}

      {giftVivo ? (
        <GiftDialog
          open={giftDialogOpen}
          entries={actionableKeys}
          onConfirm={handleConfirmGift}
          onCancel={() => setGiftDialogOpen(false)}
        />
      ) : null}

      {expireVivo ? (
        <ConfirmDialog
          title={traducir('select.markExpired')}
          message={
            facts.expirable === 1
              ? `"${selectedKeys.find((key) => key.status !== KeyStatus.Expired)?.title}" quedara como caducada y saldra de la lista de disponibles. Puedes cambiarlo luego con el toggle de estado.`
              : `Las ${facts.expirable} claves seleccionadas quedaran como caducadas y saldran de la lista de disponibles. Puedes cambiarlas luego con el toggle de estado.`
          }
          confirmLabel="Marcar caducadas"
          onConfirm={handleConfirmExpire}
          onCancel={() => setExpireDialogOpen(false)}
        />
      ) : null}

      {tagsVivo ? (
        <TagsDialog
          open={tagsOpen}
          entries={selectedKeys}
          todas={keys}
          iniciales={etiquetasComunes(selectedKeys)}
          plataformas={[...new Set(selectedKeys.map((key) => key.platform))]}
          onConfirm={handleApplyTags}
          onCancel={() => setTagsOpen(false)}
        />
      ) : null}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
        </>
      )}
    </div>
    </LocaleContext.Provider>
  );
}

/** `true` si la clave se puede regalar todavia. */
function isAvailable(entry: IGameKey): boolean {
  return entry.status === KeyStatus.Available;
}

/** Minusculas, sin acentos y sin puntuacion, para comparar nombres. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Quita la coletilla de edicion de un titulo. */
function stripEdition(titulo: string): string {
  return titulo.replace(
    /\s*[:\-–—]?\s*(game of the year|goty|definitive|complete|ultimate|gold|collector'?s?|deluxe|limited|extended|anniversary|remastered)\s*edition\s*$/i,
    '',
  );
}

/** Las etiquetas que aparecen en todas las claves seleccionadas. */
function etiquetasComunes(entries: readonly IGameKey[]): readonly string[] {
  if (entries.length === 0) return [];

  const [primera, ...resto] = entries;

  if (!primera) return [];

  return primera.tags.filter((tag) =>
    resto.every((key) => key.tags.includes(tag)),
  );
}

/**
 * Aplica el tema al documento.
 *
 * Cuando el tema es `system` se traduce a `light` o `dark` segun lo que diga
 * el sistema operativo. No se puede dejar el atributo en `system` y confiar en
 * el CSS del todo, porque hay reglas de los componentes que dependen de
 * variables y hay que resolverlas aqui una sola vez y para todas.
 */
function applyTheme(tema: string): void {
  if (typeof document === 'undefined') return;

  if (tema !== 'system') {
    document.documentElement.dataset.theme = tema;
    return;
  }

  const claro =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-color-scheme: light)').matches;

  document.documentElement.dataset.theme = claro ? 'light' : 'dark';
}

interface IEmptyStateProps {
  hasKeys: boolean;
  onCreate: () => void;
  onImport: () => void;
  onClearFilters: () => void;
}

function EmptyState({ hasKeys, onCreate, onImport, onClearFilters }: IEmptyStateProps) {
  // Los dos estados (no hay nada / no hay resultados) estaban escritos en
  // español en el marcado, asi que con la app en cualquier otro idioma salian
  // en castellano justo en las pantallas que se ven la primera vez. Se traducen
  // con `useT()`, que es el mismo traductor que consume el resto del arbol.
  const { t } = useT();

  if (hasKeys) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-hover text-t4">
          <Icon name="search" size={22} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-t2">{t('empty.noResults')}</h3>
          <p className="mt-1 text-xs text-t4">{t('empty.noResultsHint')}</p>
        </div>
        <Button variant="subtle" size="sm" onClick={onClearFilters}>
          {t('empty.clearFilters')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10 text-info ring-1 ring-info/20">
        <Icon name="key" size={22} />
      </div>
      <div>
        <h3 className="text-sm font-medium text-t2">{t('empty.title')}</h3>
        <p className="mt-1 text-xs text-t4">{t('empty.hint')}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" icon="upload" onClick={onImport}>
          {t('empty.import')}
        </Button>
        <Button variant="subtle" icon="plus" onClick={onCreate}>
          {t('empty.create')}
        </Button>
      </div>
    </div>
  );
}