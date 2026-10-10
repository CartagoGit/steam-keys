import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ConfirmDialog, ToastStack, type IToast, type ToastTone } from './components/feedback.component';
import { Icon } from './components/icon.component';
import { ImportPreview } from './components/import-preview.component';
import { KeyEditor } from './components/key-editor.component';
import { KeyRow } from './components/key-row.component';
import { StoragePanel } from './components/storage-panel.component';
import { Toolbar } from './components/toolbar.component';
import { Button } from './components/ui.component';

import { PAGE_SIZE, SEARCH_SHORTCUT } from '@/contracts/constants/app.constants';
import { KeySort } from '@/contracts/enums/key-sort.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { computeStats, emptyFilter, filterKeys, sortKeys } from '@/helpers/filter-keys.helper';
import { gameKeyService } from '@/services/game-key.service';
import { storageService } from '@/services/storage.service';
import { isBrowserPreview } from '@/helpers/runtime.helper';
import type {
  IGameKey,
  IGameKeyDraft,
} from '@/contracts/interfaces/game-key.interface';
import type { IKeyFilter } from '@/contracts/interfaces/key-filter.interface';
import type { IImportSummary } from '@/contracts/interfaces/import-summary.interface';

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState<IGameKey | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<IGameKey | null>(null);
  const [toasts, setToasts] = useState<readonly IToast[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);

  /** Contenido del TXT ya leido, pendiente de confirmar la importacion. */
  const [stagedImport, setStagedImport] = useState<{
    fileName: string;
    contents: string;
    preview: IImportSummary;
  } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const nextToastId = useRef(1);

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
  }, [editorOpen]);

  // -------------------------------------------------------------- acciones ---
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

      setStagedImport({
        fileName: 'steam-keys.txt',
        contents,
        preview,
      });
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
        filtersOpen={filtersOpen}
        searchRef={searchRef}
        onFilterChange={patchFilter}
        onSortChange={setSort}
        onCreate={handleCreate}
        onImport={handleImport}
        onExport={handleExport}
        onOpenStorage={() => setStorageOpen(true)}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
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
          {isBrowserPreview() ? (
            <span className="text-amber-400/80">
              Vista previa en navegador: datos en memoria, no se guardan en disco
            </span>
          ) : null}
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

      {storageOpen ? (
        <StoragePanel
          onClose={() => setStorageOpen(false)}
          onChanged={reload}
          notify={notify}
        />
      ) : null}

      {editorOpen ? (
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

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
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
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-400 ring-1 ring-blue-500/25">
        <Icon name="package" size={26} />
      </div>
      <div>
        <h3 className="text-base font-medium text-slate-200">Tu coleccion esta vacia</h3>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
          Importa el TXT original para traerte todas las claves de golpe, o anade una a
          mano. Todo se guarda en tu disco, en una base de datos SQLite local.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" icon="upload" onClick={onImport}>
          Importar TXT
        </Button>
        <Button variant="subtle" icon="plus" onClick={onCreate}>
          Anadir a mano
        </Button>
      </div>
    </div>
  );
}