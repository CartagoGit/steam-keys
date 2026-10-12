import { Modal, ModalHeader } from './modal.component';
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

  /**
   * Solo se listan atajos que existen de verdad.
   *
   * Este dialogo se abre **buscando** un atajo: si aparece uno aqui y al
   * pulsarlo no pasa nada, se pierde el rato y —peor— se pierde la fe en el
   * resto de la lista. Antes anunciaba `Ctrl` dos veces seguidas para «marcar
   * todas» y «marcar las que fallan», y ninguna de las dos hacia nada. Se ha
   * dejado solo la primera, que ahora tiene manejador, y se ha añadido que
   * Escape también limpia la seleccion.
   */
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
        { teclas: 'Ctrl+A', icono: 'check', descripcion: t('shortcuts.selectAll') },
        {
          teclas: 'Escape',
          icono: 'x',
          descripcion: t('shortcuts.clearSelection'),
        },
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
      {/*
        Sin icono, y a `text-sm` como los demas.

        Era el unico con el titulo a `text-base` y el boton con `p-2` en vez de
        `p-1.5`, y no por decision sino por estar escrito antes de que hubiera
        una cabecera comun. Con seis cabeceras y ninguna compartida, cada uno
        cogia lo que queria y «un dialogo» no era una forma de dibujar nada.
        Tambien era el unico con `title` y sin `aria-label`: el boton de cerrar
        no tenia nombre.
      */}
      <ModalHeader
        title={t('shortcuts.title')}
        cerrar={{ alPulsar: onClose, texto: t('action.close') }}
      />

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