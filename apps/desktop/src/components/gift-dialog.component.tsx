import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icon.component';
import { Modal, ModalHeader, ModalFooter } from './modal.component';
import { Button, INPUT_CLASS } from './ui.component';
import { useT } from '@/context/locale.context';
import { pluralKey } from '@/helpers/i18n.helper';
import type { IGameKey } from '@/contracts';

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
  const { t } = useT();
  const [destino, setDestinatario] = useState('');

  /**
   * El destinatario se vacia al abrir.
   *
   * El dialogo sigue montado entre aperturas, asi que sin esto el nombre
   * de la vez anterior salia ya escrito. Es el destino de una persona de
   * verdad —regalar algo a la persona equivocada no tiene vuelta atras— y
   * ademas el boton nace encendido, que hace que enviar sin querer sea
   * solo cuestión de pulsar dos veces.
   */
  useEffect(() => {
    if (!open) return;

    setDestinatario('');
  }, [open]);

  const habilitado = destino.trim().length > 0;

  /**
   * El regalar solo corre una vez.
   *
   * `onConfirm` acaba escribiendo en la base, asi que llamarlo dos veces
   * hace dos veces el trabajo y mete **dos** entradas en la pila de deshacer
   * con la misma accion. `useUndo` solo saca la de arriba: la primera se
   * queda ahi para siempre y el usuario ve un «Deshacer» que no deshace lo
   * que el creia.
   *
   * El bloqueo es un `ref` y no solo estado por lo mismo que en
   * `ConfirmDialog`: dos Enter seguidas dentro del mismo turno llegan las
   * dos con `ocupado === false`, porque React aun no ha repintado. Con
   * estado, la segunda se colaba.
   */
  const enCurso = useRef(false);

  const confirmar = (): void => {
    if (!habilitado || enCurso.current) return;

    enCurso.current = true;
    onConfirm(destino);
  };

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
      label={t('gift.title')}
    >
      <ModalHeader
        title={t('gift.title')}
        subtitle={t(pluralKey(entries.length, 'gift.count.one', 'gift.count.many'), [
          entries.length,
        ])}
        icon="hand"
        tone="text-ok"
        cerrar={{ alPulsar: onCancel, texto: t('action.close') }}
      />

        <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
          <ul className="mb-4 flex flex-col gap-1">
            {visibles.map((titulo) => (
              <li
                key={titulo}
                className="flex items-center gap-2 text-xs text-t2"
              >
                <Icon name="check" size={11} className="shrink-0 text-ok" />
                <span className="truncate">{titulo}</span>
              </li>
            ))}
            {resto > 0 ? (
              <li className="text-[11px] text-t4">
                {t(pluralKey(resto, 'gift.more.one', 'gift.more.many'), [resto])}
              </li>
            ) : null}
          </ul>

          <label className="mb-1.5 block text-[11px] font-medium text-t3">
            {t('gift.recipient')}
          </label>

          <input
            type="text"
            autoFocus
            value={destino}
            onChange={(event) => setDestinatario(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !habilitado) return;

              confirmar();
            }}
            placeholder={t('gift.placeholder')}
            className={INPUT_CLASS}
          />

          <p className="mt-2 text-[11px] text-t4">{t('gift.recipientHint')}</p>
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={onCancel}>
            {t('action.cancel')}
          </Button>
          <Button
            variant="primary"
            icon="hand"
            onClick={confirmar}
            disabled={!habilitado}
            title={
              habilitado
                ? t('gift.hint')
                : t('gift.needRecipient')
            }
          >
            {t('gift.action')}
          </Button>
        </ModalFooter>
    </Modal>
  );
}