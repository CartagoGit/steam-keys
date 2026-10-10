import { useEffect } from 'react';
import { Icon, type IconName } from './icon.component';

export type ToastTone = 'info' | 'success' | 'error';

export interface IToast {
  id: number;
  message: string;
  tone: ToastTone;
}

const TONES: Record<ToastTone, { icon: IconName; ring: string }> = {
  info: { icon: 'info', ring: 'ring-white/15 text-slate-200' },
  success: { icon: 'check-circle', ring: 'ring-emerald-500/30 text-emerald-200' },
  error: { icon: 'alert', ring: 'ring-rose-500/40 text-rose-200' },
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
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="animate-scale-in w-full max-w-sm rounded-2xl bg-surface-1 p-5 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30">
            <Icon name="alert" size={17} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{message}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3.5 py-2 text-sm text-slate-300 transition hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-rose-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}