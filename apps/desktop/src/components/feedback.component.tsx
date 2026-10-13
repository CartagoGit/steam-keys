import { useRef, useState } from 'react';
import { Icon, type IconName } from './icon.component';
import { useT } from '@/context/locale.context';
import { Modal } from './modal.component';
import type { IToast, ToastTone } from '@/contracts';

export type { IToast, ToastTone } from '@/contracts';

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
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Confirmacion modal para acciones destructivas.
 *
 * Bloquea el boton mientras la accion corre.
 *
 * Sin esto, dos clics rapidos ejecutaban la accion dos veces: el borrado
 * repetido sobre una fila que ya no existe —fallo, y con el deshacer ya
 * apuntado—, y en el caducado dos entradas en la pila de deshacer que solo
 * la primera servia de algo. Los handlers son `async`, asi que entre el
 * primer clic y el cierre del dialogo pasa un turno entero en el que el
 * boton sigue encendido y apuntando a la misma accion.
 *
 * El bloqueo es un `ref`, no solo estado: dos clics dentro del mismo turno
 * llegan los dos con `ocupado === false`, porque React aun no ha
 * repintado. Con estado, la segunda pulsacion se colaba.
 *
 * Cerrar tambien se bloquea mientras corre. Si el usuario pulsa Escape a
 * mitad de un borrado, el dialogo desaparece y la operacion sigue debajo,
 * sin ningun sitio donde se vea ni para deshacerla.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: IConfirmProps) {
  const { t } = useT();

  const enCurso = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  const confirmar = async (): Promise<void> => {
    if (enCurso.current) return;

    enCurso.current = true;
    setOcupado(true);

    try {
      await onConfirm();
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  };

  return (
    <Modal
      open
      onClose={ocupado ? () => {} : onCancel}
      size="sm"
      label={title}
    >
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
            disabled={ocupado}
            className="rounded-lg px-3.5 py-2 text-sm text-t2 transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            {t('action.cancel')}
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={ocupado}
            className="rounded-lg bg-danger px-3.5 py-2 text-sm font-medium text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}