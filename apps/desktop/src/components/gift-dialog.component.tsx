import { useMemo, useState } from 'react';
import { Icon } from './icon.component';
import { Modal } from './modal.component';
import { Button, INPUT_CLASS } from './ui.component';
import type { IGameKey } from '@/contracts/interfaces/game-key.interface';

/** Cuántos títulos se enseñan antes de resumir con un "y N más". */
const MAX_TITULOS = 6;

export interface IGiftDialogProps {
  entries: readonly IGameKey[];  /** `false` reproduce la animacion de salida antes de desaparecer. */
  open?: boolean;  onConfirm: (destino: string) => void;
  onCancel: () => void;
}

/**
 * Dialogo para decir a quien se han regalado las claves seleccionadas.
 *
 * El destino es obligatorio: una clave regalada sin saber a quien se le
 * dio no sirve de nada dentro de tres meses, asi que el boton no se habilita
 * hasta que hay algo escrito.
 */
export function GiftDialog({
  entries,
  open = true,
  onConfirm,
  onCancel,
}: IGiftDialogProps) {
  const [destino, setDestinatario] = useState('');

  const habilitado = destino.trim().length > 0;

  const titulos = useMemo(
    () => [...new Set(entries.map((entry) => entry.title))],
    [entries],
  );

  const visibles = titulos.slice(0, MAX_TITULOS);
  const resto = titulos.length - visibles.length;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="md"
      label="Marcar como regaladas"
    >
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
            value={destino}
            onChange={(event) => setDestinatario(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && habilitado) onConfirm(destino);
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
            onClick={() => onConfirm(destino)}
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
    </Modal>
  );
}