import { useCallback, useEffect, useState } from 'react';

import { BackupReason } from '@/contracts/enums/backup-reason.enum';
import { RestoreMode } from '@/contracts/enums/restore-mode.enum';
import { StorageHealth } from '@/contracts/enums/storage-health.enum';
import {
  getStorageMode,
  STORAGE_MODE_LABEL,
  STORAGE_MODE_NOTICE,
  supportsBackups,
} from '@/helpers/runtime.helper';
import { storageService } from '@/services/storage.service';
import { Button } from './ui.component';
import { Icon } from './icon.component';
import { useT } from '@/context/locale.context';
import type {
  IBackup,
  IRestoreSummary,
  IStorageInfo,
} from '@/contracts/interfaces/backup.interface';

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
  const { t } = useT();

  const [info, setInfo] = useState<IStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<IBackup | null>(null);

  const refresh = useCallback(async () => {
    try {
      setInfo(await storageService.info());
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : 'No se pudo leer el estado.',
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
      notify(`Copia creada: ${creada.name}`, 'success');
      await refresh();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : 'No se pudo crear la copia.',
        'error',
      );
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async (backup: IBackup): Promise<void> => {
    try {
      await storageService.deleteBackup(backup.name);
      notify('Copia eliminada.', 'success');
      await refresh();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : 'No se pudo eliminar.',
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
        `Restauradas ${resumen.total} claves: ${resumen.inserted} nuevas, ` +
          `${resumen.updated} actualizadas, ${resumen.skipped} sin cambios.`,
        'success',
      );

      setPendingRestore(null);
      await refresh();
      onChanged();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : 'No se pudo restaurar.',
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
              Datos y copias de seguridad
            </h2>
            <p className="text-xs text-t4">
              Donde vive tu coleccion y como recuperarla si algo sale mal.
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
              Comprobando…
            </p>
          ) : !info ? null : (
            <div className="space-y-5">
              {/* ------------------------------------------------- aviso */}
              {info.persistent ? (
                <Aviso
                  tone={info.health === StorageHealth.Ok ? 'blue' : 'amber'}
                  icon={info.health === StorageHealth.Ok ? 'info' : 'alert'}
                  titulo={STORAGE_MODE_LABEL[getStorageMode()]}
                  texto={info.health === StorageHealth.Ok
                    ? STORAGE_MODE_NOTICE[getStorageMode()]
                    : (info.healthDetail ?? 'La base de datos no responde como se espera.')}
                />
              ) : null}

              {info.health === StorageHealth.Degradado ? (
                <Aviso
                  tone="rose"
                  icon="alert"
                  titulo="La base de datos esta dañada"
                  texto={
                    info.healthDetail ??
                    'SQLite ha reportado un problema de integridad.'
                  }
                />
              ) : null}

              {/* ------------------------------------------------- rutas */}
              <section>
                <h3 className="mb-2 text-xs font-medium tracking-wide text-t3 uppercase">
                  Almacenamiento
                </h3>

                <dl className="grid gap-2 sm:grid-cols-2">
                  <Dato label="Claves guardadas" value={String(info.totalKeys)} />
                  <Dato
                    label="Tamaño del fichero"
                    value={formatBytes(info.databaseSizeBytes)}
                  />
                  <Dato
                    label="Almacenamiento"
                    value={STORAGE_MODE_LABEL[getStorageMode()]}
                    ayuda="Donde se estan guardando las claves ahora mismo."
                  />
                  <Dato
                    label="Pendientes de revisar"
                    value={String(info.unknownPlatform)}
                    ayuda="Claves cuya plataforma no se pudo determinar."
                  />
                </dl>

                {info.databasePath ? (
                  <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-line-soft">
                    <p className="text-[11px] tracking-wide text-t4 uppercase">
                      Ubicacion
                    </p>
                    <code className="mt-0.5 block break-all font-mono text-[11px] text-t2">
                      {info.databasePath}
                    </code>
                  </div>
                ) : null}
              </section>

              {/* ------------------------------------------------- copias */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-medium tracking-wide text-t3 uppercase">
                    Copias de seguridad
                  </h3>
                  <Button
                    size="sm"
                    variant="subtle"
                    icon="download"
                    onClick={handleBackup}
                    disabled={working || !supportsBackups() || info.totalKeys === 0}
                    title={
                      supportsBackups()
                        ? 'Crear una copia ahora'
                        : 'Solo disponible en la app de escritorio'
                    }
                  >
                    Copiar ahora
                  </Button>
                </div>

                {info.backups.length === 0 ? (
                  <p className="rounded-lg bg-surface-2 px-3 py-3 text-xs text-t4 ring-1 ring-line-soft">
                    {supportsBackups()
                      ? 'Todavia no hay copias. Se crean solas antes de cada importacion o restauracion, y tambien puedes pulsar «Copiar ahora».'
                      : 'Las copias de seguridad son una funcion de la app de escritorio. Aqui no hay ninguna.'}
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
                            {describeBackup(backup)}
                          </p>
                          <p className="truncate text-[11px] text-t4">
                            {backup.name} · {formatBytes(backup.sizeBytes)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingRestore(backup)}
                          disabled={working || !supportsBackups()}
                          className="rounded-lg px-2.5 py-1.5 text-xs text-t2 transition hover:bg-hover disabled:opacity-40"
                        >
                          Restaurar
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
                  Se guardan las 10 copias mas recientes en la carpeta
                  <code className="mx-1 font-mono">backups</code>
                  junto a la base de datos, y se crean solas antes de cada
                  importacion o restauracion.
                </p>
              </section>
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="subtle"
            icon="refresh"
            onClick={() => void refresh()}
            disabled={loading}
          >
            Actualizar
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
  const [mode, setMode] = useState<RestoreMode>(RestoreMode.Fusionar);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="animate-scale-in w-full max-w-md rounded-2xl bg-surface-1 p-5 shadow-2xl ring-1 ring-line">
        <h3 className="text-sm font-semibold text-t1">
          Restaurar {describeBackup(backup)}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-t3">
          Se creara una copia del estado actual antes de aplicar nada, asi que
          esto tambien se puede deshacer.
        </p>

        <div className="mt-4 space-y-2">
          <Opcion
            activo={mode === RestoreMode.Fusionar}
            titulo="Solo anadir lo que falte"
            texto="Recupera las claves que no tienes. No toca las que ya existen."
            onClick={() => setMode(RestoreMode.Fusionar)}
          />
          <Opcion
            activo={mode === RestoreMode.Sobrescribir}
            titulo="Anadir y actualizar estados"
            texto="Ademas, devuelve cada clave a como estaba en la copia. Util si has cambiado estados a mano por error."
            onClick={() => setMode(RestoreMode.Sobrescribir)}
          />
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-t4">
          <Icon name="info" size={12} className="mt-0.5" />
          Ninguna opcion borra claves: restaurar nunca reduce tu coleccion.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={working}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon="refresh"
            disabled={working}
            onClick={() => onConfirm(backup, mode)}
          >
            {working ? 'Restaurando…' : 'Restaurar'}
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

/** Nombre legible de una copia a partir de su fecha y su sufijo. */
function describeBackup(backup: IBackup): string {
  const fecha = new Date(backup.createdAtMs);

  if (Number.isNaN(fecha.getTime())) return backup.name;

  const sello = fecha.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const motivo = backup.name.replace(/^steam-keys-[\d-]+-/, '').replace(/\.db$/, '');

  return `${sello} · ${motivo.replace(/-/g, ' ')}`;
}

/** Tamano legible en KB o MB. */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}