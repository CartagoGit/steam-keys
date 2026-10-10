import { useEffect, useState } from 'react';
import { Button } from './ui.component';
import { Icon } from './icon.component';

export interface IGiftDialogProps {
  total: number;
  /** Nombres de los juegos seleccionados, para que se vea que se ha acertado. */
  titles: readonly string[];
  onConfirm: (destinatario: string) => void;
  onCancel: () => void;
}

/** Cuantos nombres se listan antes de resumir el resto. */
const MAX_TITULOS = 6;

/**
 * Pedir a quien se le regalan las claves seleccionadas.
 *
 * El destinatario es **obligatorio**: el boton de confirmar se queda apagado
 * mientras el campo este vacio. Una clave marcada como regalada sin saber a
 * quien se le dio deja la coleccion peor que antes, porque el estado ya no
 * dice la verdad.
 */
export function GiftDialog({ total, titles, onConfirm, onCancel }: IGiftDialogProps) {
  const [destinatario, setDestinatario] = useState('');

  const limpio = destinario.trim();
  const habilitado = limpio.length > 0;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel();

      // Enter confirma, igual que en el resto de formularios.
      if (event.key === 'Enter' && habilitado) {
        event.preventDefault();
        onConfirm(limpio);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, onConfirm, habilitado, limpio]);

  const visibles = titles.slice(0, MAX_TITULOS);
  const resto = titles.length - visibles.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="animate-scale-in w-full max-w-md rounded-2xl bg-surface-1 p-5 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            <Icon name="hand" size={17} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100">
              Marcar {total === 1 ? '1 juego como regalado' : `${total} juegos como regalados`}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Se quedan guardados como regalados y salen de la lista de disponibles.
              Dime a quien se los has dado para saberlo luego.
            </p>
          </div>
        </div>

        {/* Que juegos son, para no confirmar a ciegas. */}
        <ul className="mt-4 max-h-40 space-y-1 overflow-y-auto rounded-lg bg-surface-2 p-3 text-xs text-slate-300">
          {visibles.map((titulo) => (
            <li key={titulo} className="truncate">
              {titulo}
            </li>
          ))}
          {resto > 0 ? (
            <li className="text-slate-500">y {resto} mas…</li>
          ) : null}
        </ul>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            A quien se lo has regalado
            <span className="ml-1 text-rose-400">*</span>
          </span>
          <input
            autoFocus
            type="text"
            value={destinatario}
            onChange={(event) => setDestinatario(event.target.value)}
            placeholder="Fran, Quique, Quique Beateam…"
            className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 transition focus:bg-surface-3 focus:ring-2 focus:ring-blue-500/60 focus:outline-none"
          />
          <span className="text-xs text-slate-500">
            {habilitado
              ? 'Se guardara junto a cada clave.'
              : 'Obligatorio: sin esto no se puede continuar.'}
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(limpio)}
            disabled={!habilitado}
            icon="gift"
          >
            Marcar como regalado
          </Button>
        </div>
      </div>
    </div>
  );
}