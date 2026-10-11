import { Button } from './ui.component';
import { Icon } from './icon.component';
import { useT } from '@/context/locale.context';
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
  const { t } = useT();

  const vacio = preview.skipped === 0 && preview.duplicates === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="animate-scale-in w-full max-w-lg overflow-hidden rounded-2xl bg-surface-1 shadow-2xl ring-1 ring-line">
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info/15 text-info ring-1 ring-info/25">
            <Icon name="upload" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-t1">
              Importar desde TXT
            </h2>
            <p className="truncate text-xs text-t4">{fileName}</p>
          </div>
        </header>

        <div className="px-5 py-4">
          {vacio ? (
            <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn ring-1 ring-warn/30">
              No hay ninguna clave nueva en este fichero. Puede que ya las
              tuvieras todas importadas.
            </p>
          ) : null}

          <dl className="mt-3 grid grid-cols-2 gap-2">
            <Figures
              label={t('import.title')}
              value={preview.skipped}
              tone="text-ok"
              hint={t('import.titleHint')}
            />
            <Figures
              label={t('import.duplicates')}
              value={preview.duplicates}
              tone="text-t2"
              hint={t('import.duplicatesHint')}
            />
            <Figures
              label={t('import.available')}
              value={preview.available}
              tone="text-ok"
              hint={t('import.availableHint')}
            />
            <Figures
              label={t('import.gifted')}
              value={preview.gifted}
              tone="text-zinc-300"
              hint={t('import.giftedHint')}
            />
          </dl>

          {preview.issues > 0 ? (
            <div className="mt-3 rounded-lg bg-warn/10 px-3 py-2 ring-1 ring-warn/25">
              <p className="flex items-center gap-1.5 text-xs font-medium text-warn">
                <Icon name="info" size={13} />
                {preview.issues} linea(s) sin interpretar
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-warn-strong/70">
                Son lineas que el parser no ha sabido convertir en una clave:
                duplicados, sufijos pegados o claves de plataforma
                desconocida. Se ignoran; no bloquean la importacion.
              </p>
            </div>
          ) : null}

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-t4">
            <Icon name="shield" size={12} className="mt-0.5" />
            Antes de escribir se crea una copia de seguridad automatica de tu
            base de datos.
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onCancel}>
            {t('action.cancel')}
          </Button>
          <Button
            variant="primary"
            icon="check"
            onClick={onConfirm}
            disabled={preview.skipped === 0}
          >
            {preview.skipped === 0
              ? t('import.none')
              : t('import.apply', [preview.skipped])}
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
      className="rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-line-soft"
    >
      <dt className="text-[11px] tracking-wide text-t4 uppercase">
        {label}
      </dt>
      <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${tone}`}>
        {value}
      </dd>
    </div>
  );
}