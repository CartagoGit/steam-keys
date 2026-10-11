import { Icon, type IconName } from './icon.component';
import { useT } from '@/context/locale.context';
import { Modal } from './modal.component';

export type ToastTone = 'info' | 'success' | 'error';

export interface IToast {
  id: number;
  message: string;
  tone: ToastTone;
}

const TONES: Record<ToastTone, { icon: IconName; ring: string }> = {
  info: { icon: 'info', ring: 'ring-line-strong text-t1' },
  success: { icon: 'check-circle', ring: 'ring-ok/30 text-ok-strong' },
  error: { icon: 'alert', ring: 'ring-danger/40 text-danger-strong' },
};

export interface IToastStackProps {
  toasts: readonly IToast[];
  onDismiss: (id: number) => void;
}

/** Avisos apilados en la esquina inferior derecha. */
export function ToastStack({ toasts, onDismiss }: IToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => {
        const tone = TONES[toast.tone];

        return (
          <button
            key={toast.id}
            type="button"
            onClick={() => onDismiss(toast.id)}
            className={`animate-fade-in pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl bg-surface-2 px-4 py-3 text-left text-sm shadow-xl ring-1 ${tone.ring}`}
          >
            <Icon name={tone.icon} size={16} className="mt-0.5" />
            <span>{toast.message}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface IConfirmProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmacion modal para acciones destructivas. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: IConfirmProps) {
  const { t } = useT();

  return (
    <Modal open onClose={onCancel} size="sm" label={title}>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger/15 text-danger ring-1 ring-danger/30">
            <Icon name="alert" size={17} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-t1">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-t3">{message}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3.5 py-2 text-sm text-t2 transition hover:bg-hover"
          >
            {t('action.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-danger px-3.5 py-2 text-sm font-medium text-on-accent transition hover:brightness-110"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}