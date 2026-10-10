import { Button } from './ui.component';
import { Icon } from './icon.component';
import type { IImportSummary } from '@/contracts/interfaces/import-summary.interface';

export interface IImportPreviewProps {
  /** Nombre del fichero de origen, solo informativo. */
  fileName: string;
  preview: IImportSummary;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Previsualizacion de una importacion.
 *
 * Sustituye al `window.confirm` del navegador: el dialogo nativo congela la
 * ventana y no deja revisar los numeros con calma. Aqui se ve el desglose y se
 * confirma con calma.
 */
export function ImportPreview({
  fileName,
  preview,
  onConfirm,
  onCancel,
}: IImportPreviewProps) {
  const vacio = preview.skipped === 0 && preview.duplicates === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="animate-scale-in w-full max-w-lg overflow-hidden rounded-2xl bg-surface-1 shadow-2xl ring-1 ring-white/10">
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400 ring-1 ring-blue-500/25">
            <Icon name="upload" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-100">
              Importar desde TXT
            </h2>
            <p className="truncate text-xs text-slate-500">{fileName}</p>
          </div>
        </header>

        <div className="px-5 py-4">
          {vacio ? (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-amber-500/30">
              No hay ninguna clave nueva en este fichero. Puede que ya las
              tuvieras todas importadas.
            </p>
          ) : null}

          <dl className="mt-3 grid grid-cols-2 gap-2">
            <Figures
              label="A importar"
              value={preview.skipped}
              tone="text-emerald-300"
              hint="Claves nuevas que se anaden a la base de datos"
            />
            <Figures
              label="Ya tenias"
              value={preview.duplicates}
              tone="text-slate-300"
              hint="Duplicadas dentro del propio TXT o ya en la base de datos"
            />
            <Figures
              label="Disponibles"
              value={preview.available}
              tone="text-emerald-300"
              hint="Marcadas como regalables"
            />
            <Figures
              label="Ya regaladas"
              value={preview.gifted}
              tone="text-zinc-300"
              hint="El TXT las marcaba con un guion inicial"
            />
          </dl>

          {preview.issues > 0 ? (
            <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 ring-1 ring-amber-500/25">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-300">
                <Icon name="info" size={13} />
                {preview.issues} linea(s) sin interpretar
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-200/70">
                Son lineas que el parser no ha sabido convertir en una clave:
                duplicados, sufijos pegados o claves de plataforma
                desconocida. Se ignoran; no bloquean la importacion.
              </p>
            </div>
          ) : null}

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
            <Icon name="shield" size={12} className="mt-0.5" />
            Antes de escribir se crea una copia de seguridad automatica de tu
            base de datos.
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon="check"
            onClick={onConfirm}
            disabled={preview.skipped === 0}
          >
            {preview.skipped === 0
              ? 'Nada que importar'
              : `Importar ${preview.skipped} claves`}
          </Button>
        </footer>
      </div>
    </div>
  );
}

interface IFiguresProps {
  label: string;
  value: number;
  tone: string;
  hint: string;
}

function Figures({ label, value, tone, hint }: IFiguresProps) {
  return (
    <div
      title={hint}
      className="rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-white/5"
    >
      <dt className="text-[11px] tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${tone}`}>
        {value}
      </dd>
    </div>
  );
}