import { Modal } from './modal.component';
import { useT } from '@/context/locale.context';
import { Icon, type IconName } from './icon.component';

/**
 * Un atajo, con la tecla y para que sirve.
 *
 * `teclas` puede traer varias separadas por `+` porque algunas combinaciones son
 * de dos dedos, y se pintan como varias Caps: leer «Ctrl+Z» de un tirón es mas
 * natural que una celda por tecla.
 */
interface IShortcutRow {
  teclas: string;
  icono: IconName;
  descripcion: string;
}

export interface IShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Lista de los atajos de teclado.
 *
 * Esta en pantalla porque existen atajos que nadie va a descubrir solo: `/` y
 * `n` se anuncian en el pie, pero deshacer, marcar todo o limpiar la seleccion
 * son los que se.erran al no saber que estan. Se abre con `?`, la tecla que se
 * busca precisamente cuando se busca.
 */
export function ShortcutsDialog({ open, onClose }: IShortcutsDialogProps) {
  const { t } = useT();

  const grupos: readonly { titulo: string; filas: readonly IShortcutRow[] }[] = [
    {
      titulo: t('shortcuts.groupGeneral'),
      filas: [
        { teclas: '/', icono: 'search', descripcion: t('shortcuts.search') },
        { teclas: 'N', icono: 'plus', descripcion: t('shortcuts.new') },
        { teclas: '?', icono: 'help', descripcion: t('shortcuts.thisDialog') },
        { teclas: 'Escape', icono: 'x', descripcion: t('shortcuts.close') },
      ],
    },
    {
      titulo: t('shortcuts.groupSelection'),
      filas: [
        { teclas: 'Ctrl', icono: 'check', descripcion: t('shortcuts.selectAll') },
        { teclas: 'Ctrl', icono: 'alert', descripcion: t('shortcuts.selectFail') },
      ],
    },
    {
      titulo: t('shortcuts.groupActions'),
      filas: [
        { teclas: 'Ctrl+Z', icono: 'undo', descripcion: t('shortcuts.undo') },
      ],
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      label={t('shortcuts.title')}
      closeOnBackdrop
    >
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold text-t1">
          {t('shortcuts.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-t4 transition hover:bg-hover hover:text-t1"
          title={t('action.close')}
        >
          <Icon name="x" size={16} />
        </button>
      </header>

      <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
        {grupos.map((grupo) => (
          <section key={grupo.titulo}>
            <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-t4 uppercase">
              {grupo.titulo}
            </h3>

            <dl className="flex flex-col gap-1.5">
              {grupo.filas.map((fila) => (
                <div
                  key={fila.descripcion}
                  className="flex items-center gap-3 text-sm"
                >
                  <dt className="w-28 shrink-0">
                    {fila.teclas.split('+').map((tecla, indice) => (
                      <span key={`${tecla}-${indice}`}>
                        {indice > 0 ? (
                          <span className="mx-0.5 text-t4">+</span>
                        ) : null}
                        <kbd className="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-t2">
                          {tecla}
                        </kbd>
                      </span>
                    ))}
                  </dt>

                  <dd className="flex min-w-0 items-center gap-1.5 text-t3">
                    <Icon name={fila.icono} size={13} className="shrink-0 text-t4" />
                    <span className="truncate">{fila.descripcion}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <footer className="border-t border-line px-5 py-3">
        <p className="text-xs text-t4">{t('shortcuts.hint')}</p>
      </footer>
    </Modal>
  );
}