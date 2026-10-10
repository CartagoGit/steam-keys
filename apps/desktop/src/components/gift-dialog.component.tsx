import { useMemo, useState } from 'react';
import { Icon } from './icon.component';
import { Button, INPUT_CLASS } from './ui.component';
import type { IGameKey } from '@/contracts/interfaces/game-key.interface';

/** Cuántos títulos se enseñan antes de resumir con un "y N más". */
const MAX_TITULOS = 6;

export interface IGiftDialogProps {
  entries: readonly IGameKey[];
  onConfirm: (destinatario: string) => void;
  onCancel: () => void;
}

/**
 * Dialogo para decir a quien se han regalado las claves seleccionadas.
 *
 * El destinatario es obligatorio: una clave regalada sin saber a quien se le
 * dio no sirve de nada dentro de tres meses, asi que el boton no se habilita
 * hasta que hay algo escrito.
 */
export function GiftDialog({ entries, onConfirm, onCancel }: IGiftDialogProps) {
  const [destinatario, setDestinatario] = useState('');

  const habilitado = destinario.trim().length > 0;

  const titulos = useMemo(
    () => [...new Set(entries.map((entry) => entry.title))],
    [entries],
  );

  const visibles = titulos.slice(0, MAX_TITULOS);
  const resto = titulos.length - visibles.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="animate-fade-in w-full max-w-md overflow-hidden rounded-2xl bg-surface-1 shadow-2xl ring-1 ring-white/10">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Icon name="hand" size={16} className="text-emerald-400" />
              Marcar como regaladas
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {entries.length === 1
                ? '1 clave seleccionada'
                : `${entries.length} claves seleccionadas`}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            title="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
          <ul className="mb-4 flex flex-col gap-1">
            {visibles.map((titulo) => (
              <li
                key={titulo}
                className="flex items-center gap-2 text-xs text-slate-300"
              >
                <Icon name="check" size={11} className="shrink-0 text-emerald-500" />
                <span className="truncate">{titulo}</span>
              </li>
            ))}
            {resto > 0 ? (
              <li className="text-[11px] text-slate-500">y {resto} juego más</li>
            ) : null}
          </ul>

          <label className="mb-1.5 block text-[11px] font-medium text-slate-400">
            ¿A quién se lo has regalado?
          </label>

          <input
            type="text"
            autoFocus
            value={destinatario}
            onChange={(event) => setDestinatario(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && habilitado) onConfirm(destinatario);
            }}
            placeholder="Nombre de quien lo recibe"
            className={INPUT_CLASS}
          />

          <p className="mt-2 text-[11px] text-slate-500">
            Se guarda con cada clave, para saber a quién se la diste.
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon="hand"
            onClick={() => onConfirm(destinatario)}
            disabled={!habilitado}
            title={
              habilitado
                ? 'Marcar las claves seleccionadas como regaladas'
                : 'Escribe primero a quién se lo regalas'
            }
          >
            Marcar regaladas
          </Button>
        </footer>
      </div>
    </div>
  );
}