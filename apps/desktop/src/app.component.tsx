import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ConfirmDialog, ToastStack, type IToast, type ToastTone } from './components/feedback.component';
import { GiftDialog } from './components/gift-dialog.component';
import { Icon } from './components/icon.component';
import { ImportPreview } from './components/import-preview.component';
import { KeyEditor } from './components/key-editor.component';
import { KeyRow } from './components/key-row.component';
import { SelectionBar } from './components/selection-bar.component';
import { SettingsDialog } from './components/settings-dialog.component';
import { StoragePanel } from './components/storage-panel.component';
import { TagsDialog } from './components/tags-dialog.component';
import { Toolbar } from './components/toolbar.component';
import { Button } from './components/ui.component';

import { PAGE_SIZE, SEARCH_SHORTCUT } from '@/contracts/constants/app.constants';
import { KeySort } from '@/contracts/enums/key-sort.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { computeStats, emptyFilter, filterKeys, sortKeys } from '@/helpers/filter-keys.helper';
import { analyzeSelection, claveGrupo, groupByTitle, type SelectAction } from '@/helpers/selection.helper';
import { mergeTags, removeTags } from '@/contracts/constants/tag.constants';
import { useKeepMounted } from '@/helpers/use-exit-animation.helper';
import { gameKeyService } from '@/services/game-key.service';
import { settingsService, DEFAULT_SETTINGS } from '@/services/settings.service';
import { storageService } from '@/services/storage.service';
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

  /** El interruptor que decide si las acciones de regalar son validas. */
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [expireDialogOpen, setExpireDialogOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  // ---------------------------------------------------------- ajustes ---
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<IAppSettings>(DEFAULT_SETTINGS);
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
  const reload = useCallback(async (): Promise<void> => {
    try {
      setKeys(await gameKeyService.list());
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : 'No se pudo leer la coleccion.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Carga los ajustes y, si ya habia una cuenta conectada, su biblioteca. */
  useEffect(() => {
    const cargar = async (): Promise<void> => {
      try {
        const cargados = await settingsService.load();
        setSettings(cargados);

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
      }
    };

    void cargar();
  }, []);

  // --------------------------------------------------------------- filtros ---
  const patchFilter = useCallback((changes: Partial<IKeyFilter>): void => {
    setFilter((current) => ({ ...current, ...changes }));
  }, []);

  const visible = useMemo(
    () => sortKeys(filterKeys(keys, filter), sort),
    [keys, filter, sort],
  );

  const stats = useMemo(() => computeStats(keys, visible.length), [keys, visible.length]);
  const page = useMemo(() => visible.slice(0, PAGE_SIZE), [visible]);

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
   * Las claves sobre las que se actua de verdad.
   *
   * Con el interruptor activado se quedan solo las disponibles: no tiene
   * sentido intentar regalar algo que ya esta regalado, y hacerlo en silencio
   * seria peor que no hacerlo.
   */
  const actionableKeys = useMemo(
    () => (onlyAvailable ? selectedKeys.filter(isAvailable) : selectedKeys),
    [selectedKeys, onlyAvailable],
  );

  const facts = useMemo(
    () => analyzeSelection(selectedKeys, onlyAvailable),
    [selectedKeys, onlyAvailable],
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

  const toggleOnlyAvailable = useCallback((): void => {
    setOnlyAvailable((actual) => !actual);
  }, []);

  /** El texto que explica por que un boton esta apagado. */
  const motivo = useCallback(
    (action: SelectAction): string | undefined => {
      if (selectedKeys.length === 0) return 'No hay nada seleccionado.';

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
  }, [editorOpen, selection.size, clearSelection]);

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
      notify('Key actualizada.', 'success');
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
      notify('Key anadida.', 'success');
    }

    setEditorOpen(false);
    setEditing(null);
    await reload();
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) return;

    await gameKeyService.remove(deleting.id);
    setDeleting(null);
    notify('Key eliminada.', 'success');
    await reload();
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
        notify('No se guardo ningun fichero.', 'info');
        return;
      }

      notify(
        `${resultado.total} ${resultado.total === 1 ? 'clave guardada' : 'claves guardadas'} en ${resultado.path}`,
        'success',
      );
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : 'No se pudo guardar el fichero.',
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
      notify('Hay que decir a quien se lo has regalado.', 'error');
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
        `${total} ${total === 1 ? 'clave regalada' : 'claves regaladas'} a ${limpio}.`,
        'success',
      );
      await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : 'No se pudieron marcar.',
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
        `${total} ${total === 1 ? 'clave caducada' : 'claves caducadas'}.`,
        'success',
      );
      await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : 'No se pudieron marcar.',
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
        `Etiquetas actualizadas en ${total} ${total === 1 ? 'clave' : 'claves'}.`,
        'success',
      );
      await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : 'No se pudieron cambiar las etiquetas.',
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

      applyTheme(cargados.theme);

      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : 'No se pudieron guardar.';
    }
  };

  const handleLinkSteam = async (
    apiKey: string,
    steamId: string,
  ): Promise<string | null> => {
    if (apiKey.trim().length === 0) {
      return 'Antes hay que poner la clave de la API.';
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
        `${juegos.length} ${juegos.length === 1 ? 'juego' : 'juegos'} en tu biblioteca.`,
        'success',
      );

      return null;
    } catch (cause) {
      if (cause instanceof SteamError) {
        setCuenta((actual) => ({ ...actual, perfilPrivado: cause.codigo === 'perfilPrivado' }));
        return cause.message;
      }

      return 'No se ha podido conectar la cuenta.';
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
    notify('Clave borrada.', 'info');
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
        cause instanceof Error ? cause.message : 'No se pudo leer el fichero.',
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
        `Importadas ${result.inserted} claves` +
          (result.alreadyInDb > 0 ? ` (${result.alreadyInDb} ya estaban)` : ''),
        'success',
      );

      setStagedImport(null);
      await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : 'La importacion fallo.',
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

      notify(`Exportadas ${result.total} claves.`, 'success');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'La exportacion fallo.', 'error');
    }
  };

  // ---------------------------------------------------------------- vista ---
  return (
    <div className="flex h-full flex-col bg-surface-0">
      <Toolbar
        filter={filter}
        stats={stats}
        sort={sort}
        busy={busy}
        searchRef={searchRef}
        onFilterChange={patchFilter}
        onSortChange={setSort}
        onCreate={handleCreate}
        onImport={handleImport}
        onExport={handleExport}
        onOpenStorage={() => setStorageOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
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
              <p className="mt-4 text-center text-xs text-slate-500">
                Mostrando {page.length} de {visible.length}. Afina la busqueda para ver el
                resto.
              </p>
            ) : null}
          </>
        )}
      </main>

      <footer className="flex shrink-0 items-center justify-between border-t border-line bg-surface-1 px-4 py-2 text-[11px] text-slate-500">
        <span>
          {visible.length} de {keys.length} claves
          {stats.available > 0 ? ` · ${stats.available} regalables` : ''}
        </span>
        <span className="flex items-center gap-3">
          <span
            title={STORAGE_MODE_NOTICE[getStorageMode()]}
            className={[
              'flex items-center gap-1.5',
              getStorageMode() === 'memory' ? 'text-amber-400/80' : 'text-slate-500',
            ].join(' ')}
          >
            <Icon name="package" size={12} />
            {STORAGE_MODE_LABEL[getStorageMode()]}
          </span>
          <span>
            <kbd className="rounded border border-white/10 px-1 py-0.5">{SEARCH_SHORTCUT}</kbd>{' '}
            buscar ·{' '}
            <kbd className="rounded border border-white/10 px-1 py-0.5">N</kbd> nueva
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
          title="Eliminar key"
          message={`Se eliminara "${deleting.title}" de tu coleccion. Esto no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}

      {/* ------------------------------------------------------- seleccion --- */}
      {selectedKeys.length > 0 ? (
        <SelectionBar
          facts={facts}
          visibles={visible.length}
          onlyAvailable={onlyAvailable}
          onToggleOnlyAvailable={toggleOnlyAvailable}
          onSelectAll={selectAll}
          onClear={clearSelection}
          onExport={handleExportGift}
          onMarkGifted={() => setGiftDialogOpen(true)}
          onMarkExpired={() => setExpireDialogOpen(true)}
          onTags={() => setTagsOpen(true)}
          motivo={motivo}
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
          title="Marcar como caducadas"
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
    </div>
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

/** Aplica el tema al documento. */
function applyTheme(tema: string): void {
  if (typeof document === 'undefined') return;

  document.documentElement.dataset.theme = tema;
}

interface IEmptyStateProps {
  hasKeys: boolean;
  onCreate: () => void;
  onImport: () => void;
  onClearFilters: () => void;
}

function EmptyState({ hasKeys, onCreate, onImport, onClearFilters }: IEmptyStateProps) {
  if (hasKeys) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-slate-500">
          <Icon name="search" size={22} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-300">Ningun resultado</h3>
          <p className="mt-1 text-xs text-slate-500">
            Prueba a cambiar la busqueda o quitar algun filtro.
          </p>
        </div>
        <Button variant="subtle" size="sm" onClick={onClearFilters}>
          Limpiar filtros
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
        <Icon name="key" size={22} />
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-300">Todavia no hay claves</h3>
        <p className="mt-1 text-xs text-slate-500">
          Importa tu TXT o anade una clave a mano.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" icon="upload" onClick={onImport}>
          Importar TXT
        </Button>
        <Button variant="subtle" icon="plus" onClick={onCreate}>
          Anadir clave
        </Button>
      </div>
    </div>
  );
}