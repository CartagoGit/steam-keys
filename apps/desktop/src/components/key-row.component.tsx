import { useState } from 'react';
import { KEY_PLATFORM_META } from '@/contracts/constants/key-platform.constants';
import { KEY_STATUS_META } from '@/contracts/constants/key-status.constants';
import { formatShortDate } from '@/helpers/format-date.helper';
import { maskKey } from '@/helpers/mask-key.helper';
import { copyToClipboard } from '@/helpers/clipboard.helper';
import { isGiftable } from '@/helpers/selection.helper';
import { Badge } from './ui.component';
import { Icon } from './icon.component';
import type { IGameKey } from '@/contracts/interfaces/game-key.interface';

export interface IKeyRowProps {
  entry: IGameKey;
  onEdit: (entry: IGameKey) => void;
  onDelete: (entry: IGameKey) => void;
  onCycleStatus: (entry: IGameKey) => void;
  /** La fila esta seleccionada. */
  selected?: boolean;
  onToggleSelect?: (entry: IGameKey) => void;
  /** Cuantas claves comparten este titulo en la coleccion, esta incluida. */
  siblings?: number;
  /** `true` si la cuenta de Steam ya tiene este juego. */
  ownedOnSteam?: boolean;
  /** Etiquetas del juego, para mostrarlas resumidas. */
  tags?: readonly string[];
}

/**
 * Una fila de la lista.
 *
 * La casilla de la izquierda esta siempre: la seleccion no es un modo aparte,
 * es parte de la lista. Esconderla tras un boton "Regalar" obligaba a cambiar
 * de forma de pensar para hacer algo tan normal como marcar tres claves.
 *
 * La clave se muestra enmascarada por defecto. Se revela con el boton del ojo
 * y se copia con un clic; nunca se escribe en la consola ni en logs.
 */
export function KeyRow({
  entry,
  onEdit,
  onDelete,
  onCycleStatus,
  selected = false,
  onToggleSelect,
  siblings = 1,
  ownedOnSteam = false,
  tags = [],
}: IKeyRowProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const platform = KEY_PLATFORM_META[entry.platform];
  const status = KEY_STATUS_META[entry.status];
  const giftable = isGiftable(entry);

  const handleCopy = async (): Promise<void> => {
    const done = await copyToClipboard(entry.keyValue);
    if (!done) return;

    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <article
      className={[
        'group grid cursor-pointer items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2.5',
        'grid-cols-[auto_minmax(0,1fr)_auto]',
        'max-[900px]:grid-cols-[auto_minmax(0,1fr)]',
        'max-[900px]:[&>*:last-child]:col-span-2',
        'ring-1 transition-colors',
        selected
          ? 'bg-blue-500/10 ring-blue-500/40 hover:bg-blue-500/15'
          : 'bg-surface-1 ring-white/5 hover:bg-surface-2 hover:ring-white/10',
        giftable ? '' : 'opacity-75',
      ].join(' ')}
      onClick={(event) => {
        // Los botones de dentro (ojo, copiar, estado, editar…) tienen su propia
        // accion. Sin este corte, pulsarlos seleccionaria la fila ademas de
        // hacer lo suyo, que es la sorpresa que hace que la gente deje de usar
        // la seleccion multiple.
        if ((event.target as HTMLElement).closest('button')) return;

        onToggleSelect?.(entry);
      }}
    >
      {/* --------------------------------------------------------- seleccion */}
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect?.(entry)}
        onClick={(event) => event.stopPropagation()}
        aria-label={`Seleccionar ${entry.title}`}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
      />

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
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-medium text-slate-100">{entry.title}</h3>

            {entry.parentTitle ? (
              <span
                title="Contenido adicional de otro juego"
                className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400"
              >
                DLC
              </span>
            ) : null}

            {/* Varias claves del mismo juego son claves distintas, no filas
                repetidas: cada una tiene su estado y su destinatario. El
                contador lo deja claro de un vistazo. */}
            {siblings > 1 ? (
              <span
                title={`${siblings} claves de este juego en la coleccion`}
                className="shrink-0 rounded-full bg-slate-500/15 px-1.5 py-0.5 text-[10px] text-slate-400"
              >
                ×{siblings}
              </span>
            ) : null}

            {/* Cuando la cuenta de Steam ya tiene este juego, la key sobra. */}
            {ownedOnSteam ? (
              <span
                title="Ya tienes este juego en tu cuenta de Steam"
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300 ring-1 ring-sky-500/30"
              >
                <Icon name="check" size={9} />
                En Steam
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
            {tags.length > 0 ? (
              <span className="inline-flex items-center gap-1 truncate">
                <Icon name="tag" size={11} />
                {tags.slice(0, 3).join(', ')}
                {tags.length > 3 ? ` +${tags.length - 3}` : ''}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- clave */}
      <div className="flex flex-wrap items-center gap-2 max-[900px]:justify-end">
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
          <Icon
            name={copied ? 'check-circle' : 'copy'}
            size={15}
            className={copied ? 'text-emerald-400' : ''}
          />
        </button>

        <button
          type="button"
          onClick={() => onCycleStatus(entry)}
          title={`Estado: ${status.label}. ${status.hint} Pulsa para cambiarlo.`}
          // Sin estas clases, el boton sale con el estilo por defecto del
          // navegador: fondo gris del sistema operativo, sin esquinas redondeadas
          // y sin el espacio de la pastilla. En Windows sobre todo, donde el
          // aspecto por defecto es un marco gris que desentona.
          className="shrink-0 rounded-full transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
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