import { useState } from 'react';
import { KEY_PLATFORM_META, TRANSLATIONS, platformLabel, statusMeta, type IGameKey } from '@/contracts';
import { formatShortDate } from '@/helpers/format-date.helper';
import { maskKey } from '@/helpers/mask-key.helper';
import { copyToClipboard } from '@/helpers/clipboard.helper';
import { isGiftable } from '@/helpers/selection.helper';
import { Badge } from './ui.component';
import { Icon } from './icon.component';
import { useT } from '@/context/locale.context';

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
  const { t, locale } = useT();

  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const platform = KEY_PLATFORM_META[entry.platform];
  const status = statusMeta(entry.status, TRANSLATIONS[locale]);
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
          ? 'bg-info/10 ring-info/40 hover:bg-info/15'
          : 'bg-surface-1 ring-line-soft hover:bg-surface-2 hover:ring-line',
        giftable ? '' : 'opacity-75',
      ].join(' ')}
      onClick={(event) => {
        // Los botones de dentro (ojo, copiar, estado, editar…) y la casilla
        // tienen su propia accion. Sin este corte, pulsarlos seleccionaria la
        // fila ademas de hacer lo suyo, que es la sorpresa que hace que la
        // gente deje de usar la seleccion multiple.
        const objetivo = event.target as HTMLElement;

        if (objetivo.closest('button') || objetivo.closest('input[type=checkbox]')) return;

        onToggleSelect?.(entry);
      }}
    >
      {/* --------------------------------------------------------- seleccion */}
      {/*
        La casilla no lleva `stopPropagation` en su clic: al pulsar el raton
        sobre ella el evento sube a la fila y acaba selectingla igualmente.
        Lo que hace falta es lo contrario: que la fila **no** selectede cuando
        el objetivo del clic es la propia casilla, que ya se ha encargo de
        cambiar su estado. Eso lo resuelve el corte del `onClick` de la fila.
      */}
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect?.(entry)}
        aria-label={t('row.select', [entry.title])}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />

      {/* ---------------------------------------------------------- nombre */}
      <div className="flex min-w-0 items-center gap-3">
        {/*
          El cuadrado de la izquierda es el **estado**, no la plataforma.
          Es lo unico que cambia con la vida de la clave: lo primero que uno
          necesita ver al recorrer la lista es si se puede regalar, y con el
          icono de plataforma delante habia que leer la pastilla de la derecha
          en cada fila. La plataforma es fija (casi siempre la misma) y se ha
          ido a una insignia al lado del titulo, donde no compite.
        */}
        <div
          className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', status.tone].join(
            ' ',
          )}
          title={`${status.label} — ${status.hint}`}
        >
          <Icon name={status.icon} size={16} />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-medium text-t1">{entry.title}</h3>

            <span
              title={platformLabel(entry.platform, TRANSLATIONS[locale])}
              className="inline-flex shrink-0 items-center gap-1 rounded bg-hover px-1.5 py-0.5 text-[10px] text-t3"
            >
              <Icon name={platform.icon} size={10} />
              {platform.short}
            </span>

            {entry.parentTitle ? (
              <span
                title={t('row.dlc')}
                className="shrink-0 rounded bg-hover px-1.5 py-0.5 text-[10px] text-t3"
              >
                DLC
              </span>
            ) : null}

            {/* Varias claves del mismo juego son claves distintas, no filas
                repetidas: cada una tiene su estado y su destinatario. El
                contador lo deja claro de un vistazo. */}
            {siblings > 1 ? (
              <span
                title={t('row.siblings', [siblings])}
                className="shrink-0 rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-t3"
              >
                ×{siblings}
              </span>
            ) : null}

            {/* Cuando la cuenta de Steam ya tiene este juego, la key sobra. */}
            {ownedOnSteam ? (
              <span
                title={t('row.owned')}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-info/15 px-1.5 py-0.5 text-[10px] text-info ring-1 ring-info/30"
              >
                <Icon name="check" size={9} />
                {t('row.onSteam')}
              </span>
            ) : null}
          </div>

          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-t4">
            {entry.giftedTo ? (
              <span className="inline-flex items-center gap-1 text-t3">
                <Icon name="hand" size={11} />{t('row.forRecipient', [entry.giftedTo])}
              </span>
            ) : null}
            {entry.note ? <span className="truncate">{entry.note}</span> : null}
            {entry.addedOn ? (
              <span className="inline-flex items-center gap-1">
                <Icon name="calendar" size={11} />
                {formatShortDate(entry.addedOn, locale)}
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
          title={revealed ? t('row.hideKey') : t('row.showKey')}
          className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 ring-1 ring-line transition hover:bg-surface-3"
        >
          <Icon name={revealed ? 'eye-off' : 'eye'} size={13} className="text-t3" />
          <code className="font-mono text-xs tracking-wide text-t1">
            {revealed ? entry.keyValue : maskKey(entry.keyValue)}
          </code>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          title={t('row.copyKey')}
          className="rounded-lg p-2 text-t4 transition hover:bg-hover hover:text-t1"
        >
          <Icon
            name={copied ? 'check-circle' : 'copy'}
            size={15}
            className={copied ? 'text-ok' : ''}
          />
        </button>

        <button
          type="button"
          onClick={() => onCycleStatus(entry)}
          title={t('row.status', [status.label, status.hint])}
          // Sin estas clases, el boton sale con el estilo por defecto del
          // navegador: fondo gris del sistema operativo, sin esquinas redondeadas
          // y sin el espacio de la pastilla. En Windows sobre todo, donde el
          // aspecto por defecto es un marco gris que desentona.
          className="shrink-0 rounded-full transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Badge label={status.label} tone={status.tone} icon={status.icon} />
        </button>

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            title={t('action.edit')}
            className="rounded-lg p-2 text-t4 transition hover:bg-hover hover:text-t1"
          >
            <Icon name="pencil" size={15} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry)}
            title={t('action.delete')}
            className="rounded-lg p-2 text-t4 transition hover:bg-danger/10 hover:text-danger"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}