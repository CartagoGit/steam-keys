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
import type { IRecuentoVisible } from '@/helpers/filter-keys.helper';

export interface IAppFooterProps {
  vista: AppView;
  /** Lo que se ve ahora y lo que hay en total, para el recuento con filtro. */
  visibleCount: number;
  totalCount: number;
  /**
   * El reparto de **lo que se ve** con los filtros de ahora.
   *
   * No es el mismo que el de la barra de filtros, que va sobre la coleccion
   * entera: los menus tienen que seguir diciendo cuantos hay de cada cosa para
   * poder elegirla. Este es el que responde a «y de estas que veo, cuantas hay
   * de cada tipo».
   */
  recuento: IRecuentoVisible;
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
  recuento,
  cuenta,
  undo,
  onUndo,
  onOpenShortcuts,
}: IAppFooterProps) {
  const { t } = useT();

  const modo = getStorageMode();

  return (
    /*
     * Tres bloques en fila: **los recuentos a la izquierda**, la firma en el
     * centro, y el estado del almacenamiento y los atajos a la derecha.
     *
     * Los recuentos a la izquierda porque son **lo que cambia con el filtro**,
     * y a la izquierda es donde se mira cuando se acaba de cambiar algo. En el
     * centro competedian con la firma, que es lo unico que no cambia nunca y
     * que no se busca con el raton: dos cosas quietas no pueden compartir sitio
     * con una que cambia de largo cada vez que se toca un filtro.
     *
     * Y la rejilla de tres columnas es lo que mantiene el bloque quieto. Con
     * `justify-between` los dos extremos tendrian que medir igual para que el
     * centro no se moviera, y el recuento de la izquierda —que cambia de
     * longitud cada vez que se filtra— lo empujaria.
     */
    <footer className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-line bg-surface-1 px-4 py-2 text-[11px] text-t4">
      <span className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
        {vista === AppView.Games ? (
          <span className="truncate">
            {t('footer.games', [cuenta.juegos])}
            {cuenta.steamId ? ` · ${cuenta.steamId}` : ''}
          </span>
        ) : (
          <>
            {/*
              La forma la decide el TOTAL, no lo que se ve: con un filtro activo
              puede haber 1 clave visible de 200, y «1 clave» a secas diria que
              solo hay una. `footer.countMany` es «{0} de {1} claves»
              justamente para eso; el singular es solo el caso de una unica.
            */}
            <span className="shrink-0">
              {t(
                pluralKey(totalCount, 'footer.countOne', 'footer.countMany'),
                [visibleCount, totalCount],
              )}
            </span>

            {/*
              El reparto de lo que se ve, y **solo** lo que no sea cero.

              Cada estado sale con su punto delante, porque son trozos sueltos de
              una linea mas larga y sin el separador se leerian como una cifra
              mal puesta. Lo que esta a cero no se enseña: «· 0 regaladas» ocupa
              sitio para decir que no hay ninguna, y con cuatro estados mas los
              DLC son justo el dato que se pierde de vista.

              Y sale con los filtros puestos, que es lo que hace que responda a
              algo: si se filtra por estado, «3 disponibles» habla de las que se
              estan viendo, no de las 181 que hay en la coleccion.
            */}
            {recuento.available > 0
              ? t('footer.available', [recuento.available])
              : ''}
            {recuento.gifted > 0 ? t('footer.gifted', [recuento.gifted]) : ''}
            {recuento.redeemed > 0
              ? t('footer.redeemed', [recuento.redeemed])
              : ''}
            {recuento.expired > 0
              ? t('footer.expired', [recuento.expired])
              : ''}
            {recuento.addOns > 0 ? t('footer.addOns', [recuento.addOns]) : ''}
          </>
        )}
      </span>

      <span className="flex min-w-0 items-center justify-center gap-2">
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
