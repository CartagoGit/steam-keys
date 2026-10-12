import { Icon } from './icon.component';
import { useT } from '@/context/locale.context';
import type { ILoadingTask } from '@/helpers/use-loading.helper';

export interface ILoadingIndicatorProps {
  tareas: readonly ILoadingTask[];
  onCancel: (id: number) => void;
}

/**
 * Indicador de carga discreto, con una X para dejarlo ir.
 *
 * Va **fijo sobre la barra** y no dentro: no empuja el contenido, de modo que
 * aparecer y desaparecer no mueve ni un pixel la lista. Solo se ve mientras hay
 * algo en curso, que es cuando hace falta.
 *
 * Con varias tareas a la vez se enseña la mas reciente y un contador con las
 * demas, porque lo que se cancela es lo que se ve: si sale «Sincronizando» con
 * un «2 mas», se sabe cual se va a parar.
 *
 * La X solo aparece en las que se pueden cortar de verdad. En las que no —una
 * escritura en la base— el boton no se pone disabled: sigue permitiendo dejar de
 * esperar, que es justo lo que se quiere, y el aviso explica que lo que hay
 * debajo sigue su curso.
 */
export function LoadingIndicator({ tareas, onCancel }: ILoadingIndicatorProps) {
  const { t } = useT();

  if (tareas.length === 0) return null;

  const principal = tareas[tareas.length - 1]!;
  const resto = tareas.length - 1;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-2"
      // `aria-live` para que un lector de pantalla anuncie el progreso; el
      // `polite` es porque interrumpir por cada guardado seria peor.
      role="status"
      aria-live="polite"
    >
      <div className="animate-fade-in pointer-events-auto flex items-center gap-2 rounded-full bg-surface-2 py-1.5 pr-1.5 pl-3 text-xs shadow-lg ring-1 ring-line-strong">
        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-accent"
        />

        <span className="max-w-56 truncate text-t2">{principal.label}</span>

        {resto > 0 ? (
          <span className="shrink-0 text-t4">
            {t('loading.more', [resto])}
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => onCancel(principal.id)}
          title={
            principal.abortable
              ? t('loading.cancel')
              : t('loading.cancelNoAbort')
          }
          aria-label={
            principal.abortable
              ? t('loading.cancel')
              : t('loading.cancelNoAbort')
          }
          className="ml-0.5 shrink-0 rounded-full p-1 text-t4 transition hover:bg-hover hover:text-t1"
        >
          <Icon name="x" size={12} />
        </button>
      </div>
    </div>
  );
}