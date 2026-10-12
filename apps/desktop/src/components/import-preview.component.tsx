import { Modal, ModalFooter, ModalHeader } from './modal.component';
import { Button } from './ui.component';
import { Icon } from './icon.component';
import { useT } from '@/context/locale.context';
import type { IImportSummary } from '@/contracts';

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
    /*
     * `Modal` y no un fondo escrito a mano, como el resto.
     *
     * Este era el peor de los que lo tenian: ademas de_background_ propio, no
     * tenia `aria-modal`, ni trampa de foco, ni alto maximo atado a la ventana
     * —con una lista larga de duplicados el panel crecia y el borde lo
     * recortaba sin dejar desplazarse— y **no se cerraba con Escape**.
     *
     * Tampoco tenia boton de cerrar. Se salia pulsando fuera, que es un sitio
     * que no se busca cuando algo va mal y quieres deshacerlo. Con `Modal` y
     * una `ModalHeader` con cierre sale el boton, con su nombre.
     */
    <Modal
      open
      onClose={onCancel}
      size="lg"
      label={t('import.header')}
      closeOnBackdrop
    >
      <ModalHeader
        title={t('import.header')}
        subtitle={fileName}
        icon="upload"
        tone="text-info"
        cerrar={{ alPulsar: onCancel, texto: t('action.cancel') }}
      />

        <div className="px-5 py-4">
          {vacio ? (
            <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn ring-1 ring-warn/30">
              {t('import.noneNew')}
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
                {t('import.issues', [preview.issues])}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-warn-strong/70">
                {t('import.issuesHint')}
              </p>
            </div>
          ) : null}

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-t4">
            <Icon name="shield" size={12} className="mt-0.5" />
            {t('import.backupNotice')}
          </p>
        </div>

        <ModalFooter>
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
        </ModalFooter>
    </Modal>
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