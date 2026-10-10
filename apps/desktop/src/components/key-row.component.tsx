import { useState } from 'react';
import { KEY_PLATFORM_META } from '@/contracts/constants/key-platform.constants';
import { KEY_STATUS_META } from '@/contracts/constants/key-status.constants';
import { formatShortDate } from '@/helpers/format-date.helper';
import { maskKey } from '@/helpers/mask-key.helper';
import { copyToClipboard } from '@/helpers/clipboard.helper';
import { Badge } from './ui.component';
import { Icon } from './icon.component';
import type { IGameKey } from '@/contracts/interfaces/game-key.interface';

export interface IKeyRowProps {
  entry: IGameKey;
  onEdit: (entry: IGameKey) => void;
  onDelete: (entry: IGameKey) => void;
  onCycleStatus: (entry: IGameKey) => void;
}

/**
 * Una fila de la lista.
 *
 * La clave se muestra enmascarada por defecto. Se revela con el boton del ojo
 * y se copia con un clic; nunca se escribe en la consola ni en logs.
 */
export function KeyRow({
  entry,
  onEdit,
  onDelete,
  onCycleStatus,
}: IKeyRowProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const platform = KEY_PLATFORM_META[entry.platform];
  const status = KEY_STATUS_META[entry.status];
  const isGiftable = entry.status === 'available';

  const handleCopy = async (): Promise<void> => {
    const done = await copyToClipboard(entry.keyValue);
    if (!done) return;

    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <article
      className={[
        'group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5',
        'bg-surface-1 ring-1 ring-white/5 transition-colors hover:bg-surface-2 hover:ring-white/10',
        isGiftable ? '' : 'opacity-75',
      ].join(' ')}
    >
      {/* ---------------------------------------------------------- nombre */}
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={[
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            platform.tone,
          ].join(' ')}
          title={platform.label}
        >
          <Icon name={platform.icon} size={16} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium text-slate-100">{entry.title}</h3>
            {entry.parentTitle ? (
              <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                DLC
              </span>
            ) : null}
          </div>

          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
            {entry.giftedTo ? (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Icon name="hand" size={11} />para {entry.giftedTo}
              </span>
            ) : null}
            {entry.note ? <span className="truncate">{entry.note}</span> : null}
            {entry.addedOn ? (
              <span className="inline-flex items-center gap-1">
                <Icon name="calendar" size={11} />
                {formatShortDate(entry.addedOn)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- clave */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          title={revealed ? 'Ocultar clave' : 'Mostrar clave'}
          className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 ring-1 ring-white/10 transition hover:bg-surface-3"
        >
          <Icon name={revealed ? 'eye-off' : 'eye'} size={13} className="text-slate-400" />
          <code className="font-mono text-xs tracking-wide text-slate-200">
            {revealed ? entry.keyValue : maskKey(entry.keyValue)}
          </code>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          title="Copiar clave"
          className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
        >
          <Icon name={copied ? 'check-circle' : 'copy'} size={15} className={copied ? 'text-emerald-400' : ''} />
        </button>

        <button
          type="button"
          onClick={() => onCycleStatus(entry)}
          title="Cambiar estado"
        >
          <Badge label={status.label} tone={status.tone} icon={status.icon} />
        </button>

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            title="Editar"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          >
            <Icon name="pencil" size={15} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry)}
            title="Eliminar"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}