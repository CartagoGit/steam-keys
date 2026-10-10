import { Button } from './ui.component';
import { Icon } from './icon.component';

export interface IGiftBarProps {
  total: number;
  /** Cuantas hay ahora mismo en la lista, para el "seleccionar todas". */
  available: number;
  onSelectAll: () => void;
  onExport: () => void;
  onMarkGifted: () => void;
  onMarkExpired: () => void;
  onClear: () => void;
}

/**
 * Barra flotante del modo "regalar".
 *
 * Solo aparece con el modo activo y con algo seleccionado. El contador va en
 * plurales correctos porque se leen seguidos y "1 juegos" canta mucho.
 */
export function GiftBar({
  total,
  available,
  onSelectAll,
  onExport,
  onMarkGifted,
  onMarkExpired,
  onClear,
}: IGiftBarProps) {
  const etiqueta = total === 1 ? '1 juego' : `${total} juegos`;
  const todas = total === available;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5">
      <div className="animate-fade-in pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 shadow-2xl ring-1 ring-white/10">
        <span className="inline-flex items-center gap-2 pl-1 text-sm font-medium text-slate-100">
          <Icon name="hand" size={15} className="text-emerald-400" />
          {etiqueta} seleccionados
        </span>

        <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />

        <Button
          size="sm"
          variant="ghost"
          icon={todas ? 'x' : 'check'}
          onClick={todas ? onClear : onSelectAll}
          title={todas ? 'Quitar la seleccion' : 'Seleccionar todo lo que hay en la lista'}
        >
          {todas ? 'Quitar todo' : 'Seleccionar todo'}
        </Button>

        <Button size="sm" variant="primary" icon="download" onClick={onExport} title="Guardar las claves seleccionadas en un TXT para regalar">
          Exportar para regalar
        </Button>

        <Button size="sm" variant="subtle" icon="gift" onClick={onMarkGifted} title="Marcar como regalados y decir a quien">
          Marcar regalados
        </Button>

        <Button size="sm" variant="subtle" icon="alert" onClick={onMarkExpired} title="Marcar como caducados">
          Marcar caducados
        </Button>

        <Button size="sm" variant="ghost" icon="x" onClick={onClear} title="Quitar la seleccion">
          Limpiar
        </Button>
      </div>
    </div>
  );
}