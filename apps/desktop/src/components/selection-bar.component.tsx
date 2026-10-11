import { Icon } from './icon.component';
import { Button } from './ui.component';
import { useT } from '@/context/locale.context';
import { pluralKey } from '@/helpers/i18n.helper';
import type { ISelectionFacts } from '@/helpers/selection.helper';

export interface ISelectionBarProps {
  /** Hechos de la seleccion actual: que se puede hacer y que no. */
  facts: ISelectionFacts;
  /** Cuantas hay ahora mismo en la lista, para el "seleccionar todo". */
  visibles: number;
  onSelectAll: () => void;
  onClear: () => void;
  onExport: () => void;
  onMarkGifted: () => void;
  /** Abre el dialogo para cambiar el estado de todas a la vez. */
  onBulkStatus: () => void;
  onTags: () => void;
  /** Por que esta bloqueada cada accion, para el tooltip y el texto. */
  motivo: (action: 'export' | 'gift' | 'tags') => string | undefined;
}

/**
 * Barra flotante de la seleccion multiple.
 *
 * Aparece en cuanto hay algo seleccionado, sin ningun modo que activar: la
 * seleccion forma parte de la lista normal, no de un estado aparte.
 *
 * Se lee de arriba abajo, y en ese orden: **cuantas son y que va a pasar**
 * (cabecera), luego **que puedo hacer** (acciones agrupadas). Ese orden es el
 * que faltaba antes: eran siete botones en fila sin jerarquia, y no se sabia
 * cuales eran las importantes, cuales de mantenimiento ni por que dos estaban
 * apagados.
 *
 * Aqui **no hay interruptor de "solo las disponibles"**, y es a proposito.
 * Habia uno, pero hacia lo mismo que el filtro «Todos / Solo disponibles» de
 * la barra de filtros y lo hacia peor: duplicaba un control que ya estaba a la
 * vista, y encima el de aqui solo afectaba a la barra, mientras el de los
 * filtros afecta a la lista. Con dos controles para lo mismo, uno de ellos
 * acaba confondiendo: se activaba el de la barra y no cambiaba nada de lo que
 * se veia. Ahora hay un solo sitio donde decidirlo, y las acciones se activan
 * segun lo que haya seleccionado de verdad.
 *
 * Que un boton este apagado ya no depende de un interruptor escondido: depende
 * de lo que se ha seleccionado. El motivo va **en texto**, no solo en el
 * tooltip, porque nadie descubre un tooltip y lo primero que hace falta saber
 * al elegir es si la accion va a funcionar.
 */
export function SelectionBar({
  facts,
  visibles,
  onSelectAll,
  onClear,
  onExport,
  onMarkGifted,
  onBulkStatus,
  onTags,
  motivo,
}: ISelectionBarProps) {
  const { t } = useT();

  const todasSeleccionadas = facts.total > 0 && facts.total === visibles;
  const etiqueta = t(pluralKey(facts.total, 'select.one', 'select.many'), [facts.total]);

  const descartadas = facts.total - facts.giftable;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div className="animate-fade-in pointer-events-auto w-full max-w-[min(62rem,100%)] rounded-2xl bg-surface-2 shadow-2xl ring-1 ring-line">
        {/* ------------------------------------------------------- cabecera ---
            Que son y que va a pasar. Los botones de abajo son consecuencia de
            esta frase, asi que va antes. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-t1">
            <Icon name="check-circle" size={15} className="text-info" />
            {etiqueta}
          </span>

          {/*
            El recuento no es informativo: es la **explicacion** de por que
            hay botones apagados. Si de tres seleccionadas solo una se puede
            regalar, la accion de regalar tiene que estar apagada, y el numero
            dice por que sin tener que abrir nada.
          */}
          <span className="text-[11px] text-t4">
            {facts.giftable > 0 ? (
              <>
                <strong className="font-medium text-ok">
                  {facts.giftable === 1
                    ? t('select.giftableOne', [facts.giftable])
                    : t('select.giftableMany', [facts.giftable])}
                </strong>
                {descartadas > 0 ? t('select.giftableRest', [descartadas]) : ''}
              </>
            ) : (
              t('select.giftableNone')
            )}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              icon={todasSeleccionadas ? 'x' : 'check'}
              onClick={todasSeleccionadas ? onClear : onSelectAll}
              title={
                todasSeleccionadas ? t('select.clearAll') : t('select.allHere')
              }
            >
              {todasSeleccionadas ? t('select.untoggleAll') : t('select.all')}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              icon="x"
              onClick={onClear}
              title={t('select.clearAll')}
              aria-label={t('select.clearAll')}
            >
              {t('select.clear')}
            </Button>
          </div>
        </div>

        {/* -------------------------------------------------------- acciones ---
            Rejilla de columnas fijas: "regalar" es el motivo por el que se
            seleccionan claves, y lo demas es mantenimiento. Que cada grupo tenga
            su columna y no dependa del ancho es lo que hace que el panel se lea
            siempre igual. */}
        <div className="grid grid-cols-1 gap-x-7 gap-y-4 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          {/*
            El motivo va en el grupo, no debajo de cada boton. Exportar y
            Marcar regaladas se bloquean por lo mismo, asi que repetir el
            texto dos veces era ruido: el grupo entero esta bloqueado y basta
            con decirlo una vez, debajo.
          */}
          <ActionGroup
            title={t('select.groupGift')}
            icon="hand"
            motivo={facts.canExport ? undefined : motivo('export')}
          >
            <Button
              size="sm"
              variant="primary"
              icon="download"
              disabled={!facts.canExport}
              title={motivo('export') ?? t('select.exportHint')}
              onClick={onExport}
            >
              {t('select.export')}
            </Button>

            <Button
              size="sm"
              variant="primary"
              icon="check"
              disabled={!facts.canGift}
              title={motivo('gift') ?? t('select.giftedHint')}
              onClick={onMarkGifted}
            >
              {t('select.markGifted')}
            </Button>
          </ActionGroup>

          {/*
            "Cambiar el estado" sustituye al boton de "Marcar caducadas" y hace
            mas: los cinco estados, con el reparto calculado antes de aplicar.
            Era el hueco que quedaba: para volver a marcar como caducada habia
            que ir pulsando la pastilla de cada fila una por una.
          */}
          <ActionGroup title={t('select.groupState')} icon="layers">
            <Button
              size="sm"
              variant="subtle"
              icon="layers"
              onClick={onBulkStatus}
              title={t('bulk.hint')}
            >
              {t('bulk.title')}
            </Button>
          </ActionGroup>

          <ActionGroup title={t('select.groupOrganize')} icon="tag">
            <Button
              size="sm"
              variant="subtle"
              icon="tag"
              disabled={!facts.canTag}
              title={motivo('tags') ?? t('select.tagsHint')}
              onClick={onTags}
            >
              {t('select.tags')}
            </Button>
          </ActionGroup>
        </div>
      </div>
    </div>
  );
}

/**
 * Un grupo de acciones con su nombre encima.
 *
 * El motivo va aqui y no en cada boton por dos razones: las acciones del grupo
 * se bloquean normalmente por lo mismo, y repetir el texto dos veces por lo
 * mismo es ruido. Ademas asi todos los grupos quedan alineados por abajo.
 */
function ActionGroup({
  title,
  icon,
  motivo,
  children,
}: {
  title: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  /** Por que esta bloqueado el grupo entero, si lo esta. */
  motivo?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-t4 uppercase">
        <Icon name={icon} size={10} />
        {title}
      </span>

      <div className="flex flex-wrap items-center gap-2">{children}</div>

      {motivo ? (
        <span className="text-[10px] leading-snug text-warn">{motivo}</span>
      ) : null}
    </div>
  );
}