import { Icon } from './icon.component';
import { ExternalLink } from './ui.component';
import { useT } from '@/context/locale.context';
import { pluralKey } from '@/helpers/i18n.helper';
import {
  STORAGE_MODE_LABEL,
  STORAGE_MODE_NOTICE,
  getStorageMode,
} from '@/helpers/runtime.helper';
import {
  AppView,
  FIRMA_CODIGO,
  FIRMA_PERFIL,
  PERFIL_URL,
  PROYECTO_URL,
  SEARCH_SHORTCUT,
  StorageMode,
  type SteamAccountStatus,
} from '@/contracts';
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
 * Pie de la ventana: recuento, firma, estado del almacenamiento y atajos.
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
    /*
     * Tres bloques en fila: **el recuento y la firma en el centro**, el estado
     * del almacenamiento y los atajos a la derecha, y la izquierda vacia.
     *
     * El centro es el sitio de lo que no se busca con el raton: el recuento —que
     * no esta en ninguna parte mas— y el aviso de derechos, que en un pie de
     * escritorio es lo primero que se mira para saber quien firma. A la
     * izquierda, al lado del almacenamiento, el aviso se leia como una etiqueta
     * mas de las que hay y no como lo que es.
     *
     * Y la rejilla de tres columnas es lo que mantiene el bloque quieto. Con
     * `justify-between` los dos extremos tendrian que medir igual para que el
     * centro no se moviera, y el recuento —lo unico que cambia de texto— lo
     * empujaba cada vez que era mas largo.
     */
    <footer className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-line bg-surface-1 px-4 py-2 text-[11px] text-t4">
      <span className="min-w-0" />

      <span className="flex min-w-0 items-center justify-center gap-3">
        {vista === AppView.Games ? (
          <span className="whitespace-nowrap">
            {t('footer.games', [cuenta.juegos])}
            {cuenta.steamId ? ` · ${cuenta.steamId}` : ''}
          </span>
        ) : (
          <span className="whitespace-nowrap">
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

        {/*
          El aviso de derechos, con el icono delante del nombre en los dos
          enlaces.

          El icono primero porque es lo primero que se lee de un enlace a GitHub
          o a LinkedIn —el dibujo identifica la marca sin tener que leer— y el
          nombre detras porque es el que dice **quien** firma. Con el nombre
          primero y el icono detras se leia como un enlace mas de los que hay en
          la fila.

          Los dos iconos van dibujados y no con el generico de enlace exterior:
          en un pie lleno de cosas, una flecha no dice a donde lleva y hay que
          pasar el raton para enterarse.

          El ano se pide a `Date` al pintar y no esta escrito a mano: en una app
          que no se actualiza cada mes, un ano guardado se queda viejo y no hay
          quien lo arregle.
        */}
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 whitespace-nowrap">
            © {new Date().getFullYear()}
          </span>

          <ExternalLink
            url={PROYECTO_URL}
            title={`${t('footer.code')}: ${FIRMA_CODIGO}`}
            className="min-w-0 truncate"
          >
            <Icon name="github" size={13} className="shrink-0" />
            {FIRMA_CODIGO}
          </ExternalLink>

          <span className="shrink-0 text-t5" aria-hidden="true">
            ·
          </span>

          <ExternalLink
            url={PERFIL_URL}
            title={`${t('footer.author')}: ${FIRMA_PERFIL}`}
            className="min-w-0 truncate"
          >
            <Icon name="linkedin" size={13} className="shrink-0" />
            {FIRMA_PERFIL}
          </ExternalLink>
        </span>
      </span>

      <span className="flex min-w-0 items-center justify-end gap-3">
        {/*
          Deshacer vive en el pie y no solo como atajo: es la unica accion de
          las que no tienen boton en la barra de seleccion, y sin algo visible no
          se sabe que se puede deshacer. El `Ctrl+Z` del dialogo de atajos es la
          via rapida; esta, la que se ve.

          El texto va en imperativo —«Deshacer: …»— y no en pasado. Es un boton:
          si dijera «Deshecho» antes de pulsarlo, diria que ya se ha deshecho.
        */}
        {undo !== null ? (
          <button
            type="button"
            onClick={onUndo}
            title={t('shortcuts.undo')}
            className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-hover hover:text-t2"
          >
            <Icon name="undo" size={12} className="shrink-0" />
            <span className="max-w-40 truncate">{t('app.undoAvailable', [undo.label])}</span>
          </button>
        ) : null}

        <span
          title={t(STORAGE_MODE_NOTICE[modo])}
          className={[
            'flex shrink-0 items-center gap-1.5',
            modo === StorageMode.Memory ? 'text-warn' : 'text-t4',
          ].join(' ')}
        >
          <Icon name="package" size={12} className="shrink-0" />
          {t(STORAGE_MODE_LABEL[modo])}
        </span>

        <button
          type="button"
          onClick={onOpenShortcuts}
          title={t('shortcuts.thisDialog')}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-hover hover:text-t2"
        >
          <Icon name="help" size={12} />
          {t('toolbar.shortcuts')}
        </button>

        <span className="shrink-0 whitespace-nowrap">
          <kbd className="rounded border border-white/10 px-1 py-0.5">{SEARCH_SHORTCUT}</kbd>{' '}
          {t('footer.shortcutSearch')} ·{' '}
          <kbd className="rounded border border-white/10 px-1 py-0.5">N</kbd>{' '}
          {t('footer.shortcutNew')}
        </span>
      </span>
    </footer>
  );
}
