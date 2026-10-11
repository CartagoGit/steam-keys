import { useCallback, useEffect, useState } from 'react';

import { AppLocale, BackupReason, BACKUP_REASON_LABEL, RestoreMode, StorageHealth, type IBackup, type IRestoreSummary, type IStorageInfo, type Translator } from '@/contracts';
import {
  getStorageMode,
  STORAGE_MODE_LABEL,
  STORAGE_MODE_NOTICE,
  supportsBackups,
} from '@/helpers/runtime.helper';
import { storageService } from '@/services/storage.service';
import { formatBytes } from '@/helpers/format-bytes.helper';
import { formatDateTime } from '@/helpers/format-date.helper';
import { Button } from './ui.component';
import { Icon } from './icon.component';
import { useT } from '@/context/locale.context';

export interface IStoragePanelProps {
  onClose: () => void;
  /** Se avisa a la vista principal para que recargue la lista. */
  onChanged: () => void;
  /** Aviso de una operacion terminada. */
  notify: (message: string, tone?: 'info' | 'success' | 'error') => void;
}

/**
 * Panel de datos: donde vive la informacion, si esta sana y como recuperarla.
 *
 * Es la respuesta a "¿mis claves siguen ahi?" sin tener que bucear en el disco.
 */
export function StoragePanel({ onClose, onChanged, notify }: IStoragePanelProps) {
  const { t, locale } = useT();

  const [info, setInfo] = useState<IStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<IBackup | null>(null);

  const refresh = useCallback(async () => {
    try {
      setInfo(await storageService.info());
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : t('storage.error.read'),
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ---------------------------------------------------------------- acciones ---
  const handleBackup = async (): Promise<void> => {
    setWorking(true);
    try {
      const creada = await storageService.backupNow(BackupReason.Manual);
      notify(t('storage.created', [creada.name]), 'success');
      await refresh();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : t('storage.error.backup'),
        'error',
      );
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async (backup: IBackup): Promise<void> => {
    try {
      await storageService.deleteBackup(backup.name);
      notify(t('storage.deleted'), 'success');
      await refresh();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : t('storage.error.delete'),
        'error',
      );
    }
  };

  const handleRestore = async (
    backup: IBackup,
    mode: RestoreMode,
  ): Promise<void> => {
    setWorking(true);
    try {
      const resumen: IRestoreSummary = await storageService.restore(
        backup.name,
        mode,
      );

      notify(
        t('storage.restored', [
          resumen.total,
          resumen.inserted,
          resumen.updated,
          resumen.skipped,
        ]),
        'success',
      );

      setPendingRestore(null);
      await refresh();
      onChanged();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : t('storage.error.restore'),
        'error',
      );
    } finally {
      setWorking(false);
    }
  };

  // ------------------------------------------------------------------ vista ---
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="animate-scale-in flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface-1 shadow-2xl ring-1 ring-line">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-t1">
              {t('data.title')}
            </h2>
            <p className="text-xs text-t4">
              {t('data.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-t4 transition hover:bg-hover hover:text-t1"
            title={t('data.close')}
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-t4">
              {t('storage.checking')}
            </p>
          ) : !info ? null : (
            <div className="space-y-5">
              {/* ------------------------------------------------- aviso */}
              {info.persistent ? (
                <Aviso
                  tone={info.health === StorageHealth.Ok ? 'blue' : 'amber'}
                  icon={info.health === StorageHealth.Ok ? 'info' : 'alert'}
                  titulo={t(STORAGE_MODE_LABEL[getStorageMode()])}
                  texto={info.health === StorageHealth.Ok
                    ? t(STORAGE_MODE_NOTICE[getStorageMode()])
                    : (info.healthDetail ?? t('storage.unexpected'))}
                />
              ) : null}

              {info.health === StorageHealth.Degradado ? (
                <Aviso
                  tone="rose"
                  icon="alert"
                  titulo={t('storage.corruptedTitle')}
                  texto={
                    info.healthDetail ??
                    t('storage.corrupted')
                  }
                />
              ) : null}

              {/* ------------------------------------------------- rutas */}
              <section>
                <h3 className="mb-2 text-xs font-medium tracking-wide text-t3 uppercase">
                  {t('storage.section.storage')}
                </h3>

                <dl className="grid gap-2 sm:grid-cols-2">
                  <Dato label={t('storage.data.keys')} value={String(info.totalKeys)} />
                  <Dato
                    label={t('storage.data.size')}
                    value={formatBytes(info.databaseSizeBytes)}
                  />
                  <Dato
                    label={t('storage.data.where')}
                    value={t(STORAGE_MODE_LABEL[getStorageMode()])}
                    ayuda={t('storage.data.whereHint')}
                  />
                  <Dato
                    label={t('storage.data.unknown')}
                    value={String(info.unknownPlatform)}
                    ayuda={t('storage.data.unknownHint')}
                  />
                </dl>

                {info.databasePath ? (
                  <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-line-soft">
                    <p className="text-[11px] tracking-wide text-t4 uppercase">
                      {t('storage.data.location')}
                    </p>
                    <code className="mt-0.5 block break-all font-mono text-[11px] text-t2">
                      {info.databasePath}
                    </code>
                  </div>
                ) : null}

                {/*
                  En modo portable el aviso no es un extra: es la unica
                  advertencia que impide perder la coleccion. Si mueves el
                  ejecutable a otra carpeta sin copiar tambien el `.db`, las
                  claves se quedan atras y no hay forma de que la app lo note.
                */}
                {info.portable ? (
                  <Aviso
                    tone="blue"
                    icon="info"
                    titulo={t('storage.portable.title')}
                    texto={t('storage.portable.text')}
                  />
                ) : null}
              </section>

              {/* ------------------------------------------------- copias */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-medium tracking-wide text-t3 uppercase">
                    {t('storage.section.backups')}
                  </h3>
                  <Button
                    size="sm"
                    variant="subtle"
                    icon="download"
                    onClick={handleBackup}
                    disabled={working || !supportsBackups() || info.totalKeys === 0}
                    title={
                      supportsBackups()
                        ? t('storage.backupNow')
                        : t('storage.desktopOnly')
                    }
                  >
                    {t('storage.copyNow')}
                  </Button>
                </div>

                {info.backups.length === 0 ? (
                  <p className="rounded-lg bg-surface-2 px-3 py-3 text-xs text-t4 ring-1 ring-line-soft">
                    {supportsBackups()
                      ? t('storage.backups.none')
                      : t('storage.backups.desktopOnly')}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {info.backups.map((backup) => (
                      <li
                        key={backup.name}
                        className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-line-soft"
                      >
                        <Icon name="package" size={15} className="text-t4" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-t1">
                            {describeBackup(backup, locale, t)}
                          </p>
                          <p className="truncate text-[11px] text-t4">
                            {backup.rowCount >= 0
                              ? `${t('storage.backups.keys', [backup.rowCount])} · ${formatBytes(backup.sizeBytes)}`
                              : formatBytes(backup.sizeBytes)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingRestore(backup)}
                          disabled={working || !supportsBackups()}
                          className="rounded-lg px-2.5 py-1.5 text-xs text-t2 transition hover:bg-hover disabled:opacity-40"
                        >
                          {t('storage.restore')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(backup)}
                          disabled={working}
                          title={t('action.delete')}
                          className="rounded-lg p-1.5 text-t4 transition hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-2 text-[11px] leading-relaxed text-t4">
                  {t('storage.backups.keep')}
                </p>
              </section>
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            {t('action.close')}
          </Button>
          <Button
            variant="subtle"
            icon="refresh"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {t('storage.refresh')}
          </Button>
        </footer>
      </div>

      {pendingRestore ? (
        <RestoreDialog
          backup={pendingRestore}
          working={working}
          onCancel={() => setPendingRestore(null)}
          onConfirm={handleRestore}
        />
      ) : null}
    </div>
  );
}

interface IRestoreDialogProps {
  backup: IBackup;
  working: boolean;
  onCancel: () => void;
  onConfirm: (backup: IBackup, mode: RestoreMode) => void;
}

/** Confirmacion de restauracion, con las dos formas de aplicarla. */
function RestoreDialog({
  backup,
  working,
  onCancel,
  onConfirm,
}: IRestoreDialogProps) {
  const { t, locale } = useT();
  const [mode, setMode] = useState<RestoreMode>(RestoreMode.Fusionar);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="animate-scale-in w-full max-w-md rounded-2xl bg-surface-1 p-5 shadow-2xl ring-1 ring-line">
        <h3 className="text-sm font-semibold text-t1">
          {t('storage.restoreTitle', [describeBackup(backup, locale, t)])}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-t3">
          {t('storage.restoreHint')}
        </p>

        <div className="mt-4 space-y-2">
          <Opcion
            activo={mode === RestoreMode.Fusionar}
            titulo={t('storage.merge.title')}
            texto={t('storage.merge.text')}
            onClick={() => setMode(RestoreMode.Fusionar)}
          />
          <Opcion
            activo={mode === RestoreMode.Sobrescribir}
            titulo={t('storage.overwrite.title')}
            texto={t('storage.overwrite.text')}
            onClick={() => setMode(RestoreMode.Sobrescribir)}
          />
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-t4">
          <Icon name="info" size={12} className="mt-0.5" />
          {t('storage.restoreSafe')}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={working}>
            {t('action.cancel')}
          </Button>
          <Button
            variant="primary"
            icon="refresh"
            disabled={working}
            onClick={() => onConfirm(backup, mode)}
          >
            {working ? t('storage.restoring') : t('storage.restore')}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface IOpcionProps {
  activo: boolean;
  titulo: string;
  texto: string;
  onClick: () => void;
}

function Opcion({ activo, titulo, texto, onClick }: IOpcionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-lg px-3 py-2.5 text-left transition',
        activo
          ? 'bg-info/15 ring-2 ring-info/50'
          : 'bg-surface-2 ring-1 ring-line-soft hover:bg-hover',
      ].join(' ')}
    >
      <p className="text-xs font-medium text-t1">{titulo}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-t3">
        {texto}
      </p>
    </button>
  );
}

interface IAvisoProps {
  tone: 'amber' | 'rose' | 'blue';
  icon: 'alert' | 'info';
  titulo: string;
  texto: string;
}

function Aviso({ tone, icon, titulo, texto }: IAvisoProps) {
  const clases = {
    rose: 'bg-danger/10 text-danger ring-danger/30',
    amber: 'bg-warn/10 text-warn ring-warn/25',
    blue: 'bg-info/10 text-info ring-info/25',
  }[tone];

  return (
    <div className={`rounded-lg px-3 py-2.5 ring-1 ${clases}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <Icon name={icon} size={13} />
        {titulo}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed opacity-80">{texto}</p>
    </div>
  );
}

interface IDatoProps {
  label: string;
  value: string;
  ayuda?: string;
}

function Dato({ label, value, ayuda }: IDatoProps) {
  return (
    <div
      title={ayuda}
      className="rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-line-soft"
    >
      <dt className="text-[11px] tracking-wide text-t4 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-t1">{value}</dd>
    </div>
  );
}

/**
 * Nombre legible de una copia: su fecha y su motivo, los dos ya traducidos.
 *
 * El motivo antes se sacaba con `reason.replace(/-/g, ' ')`, deshaciendo el
 * saneo del nombre. Eso es perder el dato por el camino —un motivo que contenga
 * un guion de verdad se parte mal— y ademas salia siempre en castellano. Ahora
 * `reason` es un `BackupReason` y se traduce con su clave.
 */
function describeBackup(backup: IBackup, locale: AppLocale, t: Translator): string {
  if (Number.isNaN(new Date(backup.createdAtMs).getTime())) return backup.name;

  const sello = formatDateTime(backup.createdAtMs, locale);

  return `${sello} · ${t(BACKUP_REASON_LABEL[backup.reason])}`;
}