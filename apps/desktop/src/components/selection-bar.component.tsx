import { Icon } from './icon.component';
import { Button } from './ui.component';
import type { ISelectionFacts } from '@/helpers/selection.helper';

export interface ISelectionBarProps {
  /** Hechos de la seleccion actual: que se puede hacer y que no. */
  facts: ISelectionFacts;
  /** Cuantas hay ahora mismo en la lista, para el "seleccionar todo". */
  visibles: number;
  /** `true` si esta activo el filtro «Solo disponibles». */
  onlyAvailable: boolean;
  onToggleOnlyAvailable: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onExport: () => void;
  onMarkGifted: () => void;
  onMarkExpired: () => void;
  onTags: () => void;
  /** Por que esta bloqueada cada accion, para el tooltip. */
  motivo: (action: 'export' | 'gift' | 'expire' | 'tags') => string | undefined;
}

/**
 * Barra flotante de la seleccion multiple.
 *
 * Aparece en cuanto hay algo seleccionado, sin ningun modo que activar: la
 * seleccion forma parte de la lista normal, no de un estado aparte. Los
 * botones que no se pueden pulsar no desaparecen, se quedan apagados y explican
 * el motivo al pasar el raton, que es mas util que un boton invisible porque
 * asi se ve que la accion existe y por que no esta disponible.
 */
export function SelectionBar({
  facts,
  visibles,
  onlyAvailable,
  onToggleOnlyAvailable,
  onSelectAll,
  onClear,
  onExport,
  onMarkGifted,
  onMarkExpired,
  onTags,
  motivo,
}: ISelectionBarProps) {
  const todasSeleccionadas = facts.total > 0 && facts.total === visibles;
  const etiqueta =
    facts.total === 1 ? '1 seleccionada' : `${facts.total} seleccionadas`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5">
      <div className="animate-fade-in pointer-events-auto flex max-w-[min(72rem,100%)] flex-wrap items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 shadow-2xl ring-1 ring-white/10">
        <span className="inline-flex items-center gap-2 pl-1 text-sm font-medium text-slate-100">
          <Icon name="check-circle" size={15} className="text-blue-400" />
          {etiqueta}
        </span>

        <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />

        <Button
          size="sm"
          variant="ghost"
          icon={todasSeleccionadas ? 'x' : 'check'}
          onClick={todasSeleccionadas ? onClear : onSelectAll}
          title={
            todasSeleccionadas
              ? 'Quitar la seleccion de toda la lista'
              : 'Seleccionar todo lo que hay ahora mismo en la lista'
          }
        >
          {todasSeleccionadas ? 'Quitar todo' : 'Seleccionar todo'}
        </Button>

        {/* El interruptor que decide si las acciones de regalar son validas. */}
        <button
          type="button"
          onClick={onToggleOnlyAvailable}
          aria-pressed={onlyAvailable}
          title={
            onlyAvailable
              ? 'Solo se actua sobre las claves disponibles de la seleccion'
              : 'Con esto activado, exportar y marcar regaladas solo afectan a las claves disponibles'
          }
          className={[
            'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
            onlyAvailable
              ? 'bg-emerald-600 text-white'
              : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10',
          ].join(' ')}
        >
          <Icon
            name={onlyAvailable ? 'check' : 'x'}
            size={12}
            className={onlyAvailable ? '' : 'opacity-50'}
          />
          Solo disponibles
          {onlyAvailable && facts.giftable < facts.total ? (
            <span className="ml-0.5 opacity-70">
              ({facts.giftable}/{facts.total})
            </span>
          ) : null}
        </button>

        <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />

        <Button
          size="sm"
          variant="primary"
          icon="download"
          onClick={onExport}
          disabled={!facts.canExport}
          title={
            motivo('export') ?? 'Guardar las claves seleccionadas en un TXT para regalar'
          }
        >
          Exportar
        </Button>

        <Button
          size="sm"
          variant="subtle"
          icon="hand"
          onClick={onMarkGifted}
          disabled={!facts.canGift}
          title={motivo('gift') ?? 'Marcar como regaladas y decir a quien'}
        >
          Marcar regaladas
        </Button>

        <Button
          size="sm"
          variant="subtle"
          icon="alert"
          onClick={onMarkExpired}
          disabled={!facts.canExpire}
          title={motivo('expire') ?? 'Marcar como caducadas'}
        >
          Marcar caducadas
        </Button>

        <Button
          size="sm"
          variant="subtle"
          icon="tag"
          onClick={onTags}
          disabled={!facts.canTag}
          title={motivo('tags') ?? 'Cambiar las etiquetas de la seleccion'}
        >
          Etiquetas
        </Button>

        <Button
          size="sm"
          variant="ghost"
          icon="x"
          onClick={onClear}
          title="Quitar la seleccion"
        >
          Limpiar
        </Button>
      </div>
    </div>
  );
}