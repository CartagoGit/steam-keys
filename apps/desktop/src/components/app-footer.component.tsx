import { Icon } from './icon.component';
import { useT } from '@/context/locale.context';
import { pluralKey } from '@/helpers/i18n.helper';
import {
  STORAGE_MODE_LABEL,
  STORAGE_MODE_NOTICE,
  getStorageMode,
} from '@/helpers/runtime.helper';
import { AppView, SEARCH_SHORTCUT, StorageMode, type SteamAccountStatus } from '@/contracts';
import type { IUndoEntry } from '@/helpers/undo.helper';

export interface IAppFooterProps {
  vista: AppView;
  /** Lo que se ve ahora y lo que hay en total, para el recuento con filtro. */
  visibleCount: number;
  totalCount: number;
  /** Cuantas quedan regalables. */
  giftable: number;
  cuenta: SteamAccountStatus;
  /** Ultima accion que se puede deshacer, o `null`. */
  undo: IUndoEntry | null;
  onUndo: () => void;
  onOpenShortcuts: () => void;
}

/**
 * Pie de la ventana: recuento, estado del almacenamiento y atajos.
 *
 * Vive aparte porque no tiene estado propio y porque es donde se acumulan tres
 * cosas que cambian por motivos distintos: lo que se ve, como esta la base de
 * datos y que se puede deshacer. En el componente eran treinta lineas de JSX
 * entre la lista y los dialogos.
 */
export function AppFooter({
  vista,
  visibleCount,
  totalCount,
  giftable,
  cuenta,
  undo,
  onUndo,
  onOpenShortcuts,
}: IAppFooterProps) {
  const { t } = useT();

  const modo = getStorageMode();

  return (
    <footer className="flex shrink-0 items-center justify-between border-t border-line bg-surface-1 px-4 py-2 text-[11px] text-t4">
      {vista === AppView.Games ? (
        <span>
          {t('footer.games', [cuenta.juegos])}
          {cuenta.steamId ? ` · ${cuenta.steamId}` : ''}
        </span>
      ) : (
        <span>
          {/*
            La forma la decide el TOTAL, no lo que se ve: con un filtro activo
            puede haber 1 clave visible de 200, y «1 clave» a secas diria que
            solo hay una. `footer.countMany` es «{0} de {1} claves» justamente
            para eso; el singular es solo el caso de una unica.
          */}
          {t(pluralKey(totalCount, 'footer.countOne', 'footer.countMany'), [
            visibleCount,
            totalCount,
          ])}
          {giftable > 0 ? t('footer.giftable', [giftable]) : ''}
        </span>
      )}

      <span className="flex items-center gap-3">
        {/*
          Deshacer vive en el pie y no solo como atajo: es la unica accion de
          las que no tienen boton en la barra de seleccion, y sin algo visible no
          se sabe que se puede deshacer. El `Ctrl+Z` del dialogo de atajos es la
          via rapida; esta, la que se ve.

          El texto va en imperativo —«Deshacer: …»— y no en pasado. Es un boton:
          si dijera «Deshecho» antes de pulsarlo, diria que ya se ha deshecho. El
          punto final lo trae la etiqueta de la accion.
        */}
        {undo !== null ? (
          <button
            type="button"
            onClick={onUndo}
            title={t('shortcuts.undo')}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-hover hover:text-t2"
          >
            <Icon name="undo" size={12} />
            <span className="max-w-40 truncate">{t('app.undoAvailable', [undo.label])}</span>
          </button>
        ) : null}

        <span
          title={t(STORAGE_MODE_NOTICE[modo])}
          className={[
            'flex items-center gap-1.5',
            modo === StorageMode.Memory ? 'text-warn' : 'text-t4',
          ].join(' ')}
        >
          <Icon name="package" size={12} />
          {t(STORAGE_MODE_LABEL[modo])}
        </span>

        <button
          type="button"
          onClick={onOpenShortcuts}
          title={t('shortcuts.thisDialog')}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-hover hover:text-t2"
        >
          <Icon name="help" size={12} />
          {t('toolbar.shortcuts')}
        </button>

        <span>
          <kbd className="rounded border border-white/10 px-1 py-0.5">{SEARCH_SHORTCUT}</kbd>{' '}
          {t('footer.shortcutSearch')} ·{' '}
          <kbd className="rounded border border-white/10 px-1 py-0.5">N</kbd>{' '}
          {t('footer.shortcutNew')}
        </span>
      </span>
    </footer>
  );
}