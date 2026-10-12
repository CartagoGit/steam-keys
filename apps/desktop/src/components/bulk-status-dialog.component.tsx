import { pluralKey } from '@/helpers/i18n.helper';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KEY_STATUS_VALUES, KeyStatus, TRANSLATIONS, statusMeta, type IGameKey, type Translator } from '@/contracts';
import { Icon } from './icon.component';
import { Modal, ModalHeader } from './modal.component';
import { Button } from './ui.component';
import { useT } from '@/context/locale.context';

/** Como queda el reparto al aplicar un estado a una seleccion. */
export interface IBulkStatusPreview {
  /** Las que van a cambiar de verdad. */
  cambian: readonly IGameKey[];
  /** Las que ya estaban en ese estado: no se tocan. */
  iguales: readonly IGameKey[];
  /** Las que no pueden pasar a ese estado, con el motivo de cada una. */
  bloqueadas: readonly { key: IGameKey; motivo: string }[];
}

export interface IBulkStatusDialogProps {
  open?: boolean;
  entries: readonly IGameKey[];
  /**
   * Aplica el estado y devuelve **cuantas han cambiado de verdad**.
   *
   * El numero vuelve del padre y no se calcula aqui porque quien escribe en la
   * base de datos puede decidir dejar fuera alguna clave: la lista puede haber
   * cambiado entre que se abrio el dialogo y se pulso el boton. Mostrar el
   * recuento previsto en vez del real hacia que el dialogo dijera "0 claves"
   * justo despues de haber cambiado cinco.
   */
  onApply: (ids: readonly number[], status: KeyStatus) => Promise<number>;
  onClose: () => void;
}

/**
 * Los estados a los que una clave puede pasar, y los motivos.
 *
 * No todos los cambios son validos y **no vale con silenciarlos**: si se
 *_elige_ "disponible" sobre veinte claves de las que quince ya estan
 * regaladas, las quince volverian a estar disponibles, que es mentira: ya no
 * las tienes. Antes esto no se podia hacer porque la fila cyclingava por
 * todos los estados sin mirar nada, y el panel de seleccion solo tenia
 * "marcar regaladas" y "marcar caducadas".
 *
 * Aqui cada transicion tiene su regla y su explicacion, y el dialogo enseña
 * el reparto antes de aplicar nada: cuantas cambian, cuantas no hace falta
 * tocarlas y cuantas no se pueden.
 */

/**
 * Motivo por el que una clave no puede pasar a un estado.
 *
 * Devuelve **texto ya traducido**, no la clave: quien pinta esto es el dialogo,
 * y el dialogo tiene el idioma a mano. Se le pasa `t` en vez de leer un
 * contexto para que esta funcion siga siendo pura y se pueda probar sin montar
 * nada.
 */
function motivoBloqueo(estado: KeyStatus, entry: IGameKey, t: Translator): string | null {
  if (entry.status === estado) return null;

  switch (estado) {
    case KeyStatus.Available:
      // Volver a disponible solo tiene sentido para una clave caducada: si ya
      // se regaló o se canjeó, la verdad es que ya no se tiene.
      return entry.status === KeyStatus.Expired ? null : t('bulk.blocked.notOwned');

    case KeyStatus.Gifted:
      return entry.giftedTo ? null : t('bulk.blocked.needRecipient');

    case KeyStatus.Redeemed:
    case KeyStatus.Expired:
      return null;

    case KeyStatus.Unknown:
      return null;

    default:
      return null;
  }
}

/**
 * Reparte la seleccion segun lo que ocurriria si se aplicase `estado`.
 *
 * `t` es obligatorio y va el ultimo porque es quien decide el idioma en que
 * salen los motivos: sin el, esta funcion devolveria castellano en una app
 * puesta en frances, que es el fallo que se estaba intentando quitar.
 */
export function previewBulkStatus(
  entries: readonly IGameKey[],
  estado: KeyStatus,
  t: Translator,
): IBulkStatusPreview {
  const cambian: IGameKey[] = [];
  const iguales: IGameKey[] = [];
  const bloqueadas: { key: IGameKey; motivo: string }[] = [];

  for (const entry of entries) {
    if (entry.status === estado) {
      iguales.push(entry);
      continue;
    }

    const motivo = motivoBloqueo(estado, entry, t);

    if (motivo === null) cambian.push(entry);
    else bloqueadas.push({ key: entry, motivo });
  }

  return { cambian, iguales, bloqueadas };
}

/**
 * Dialogo para cambiar el estado de varias claves de golpe.
 *
 * El boton se llama "cambiar estado" y no "cambiar a disponible" porque hace
 * las cinco cosas; el nombre corto es lo que cabe en el panel de seleccion, y
 * lo que hara queda escrito en la tarjeta del estado.
 *
 * El reparto se calcula mientras se elige y se muestra **antes** de aplicar.
 * Es la parte que hace que esto sea de fiar: sin el, se pulsaba "cambiar" y
 * luego no se sabia que habia pasado con quince claves sin tocar.
 */
export function BulkStatusDialog({
  open = true,
  entries,
  onApply,
  onClose,
}: IBulkStatusDialogProps) {
  const { t, locale } = useT();

  const [estado, setEstado] = useState<KeyStatus>(KeyStatus.Available);
  const [ocupado, setOcupado] = useState(false);
  /** Bloqueo sincronico de `aplicar`; el estado solo pinta el boton. */
  const enCurso = useRef(false);
  /** Cuantas cambiaron de verdad, o `null` si todavia no se ha aplicado. */
  const [aplicadas, setAplicadas] = useState<number | null>(null);

  /**
   * El resultado de la vez anterior no sobrevive a la apertura siguiente.
   *
   * El dialogo queda montado entre aperturas, asi que sin esto «se han
   * cambiado 12 claves» se quedaba puesto en una sesion nueva, con claves
   * distintas y sin haber pulsado nada. Es peor que no mostrarlo: el
   * usuario creeria que ya se habia hecho.
   *
   * `estado` **si** se recuerda: un destino por defecto sensato es una
   * comodidad, y como no lleva datos de la sesion anterior no puede
   * mentir sobre lo que se ha escrito.
   */
  useEffect(() => {
    if (!open) return;

    setAplicadas(null);
    setOcupado(false);
    enCurso.current = false;
  }, [open]);

  // `locale` va en las dependencias porque `t` cambia de identidad al cambiar el
  // idioma: sin el, cambiar de idioma no recalcularia el reparto y los motivos
  // seguirian en castellano hasta que se abriera el dialogo otra vez.
  const preview = useMemo(
    () => previewBulkStatus(entries, estado, t),
    [entries, estado, t, locale],
  );
  const meta = statusMeta(estado, TRANSLATIONS[locale]);

  const aplicar = async (): Promise<void> => {
    /**
     * El bloqueo es un `ref` y no solo estado, por lo mismo que en
     * `ConfirmDialog`: dos clics dentro del mismo turno llegan los dos con
     * `ocupado === false`, porque React aun no ha repintado. Con estado, la
     * segunda pulsacion se colaba y `onApply` corria dos veces —dos
     * escrituras, y **dos** entradas en la pila de deshacer con la misma
     * accion, de las que `useUndo` solo saca la de arriba.
     */
    if (enCurso.current) return;

    enCurso.current = true;
    setOcupado(true);
    setAplicadas(null);

    try {
      setAplicadas(await onApply(preview.cambian.map((entry) => entry.id), estado));
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="md" label={t('bulk.title')}>
      <ModalHeader
        title={t('bulk.title')}
        subtitle={t('bulk.subtitle', [entries.length])}
        icon="layers"
        cerrar={{ alPulsar: onClose, texto: t('action.close') }}
      />

      <div className="flex flex-col gap-4 px-5 py-5">
        {/*
          Los estados como tarjetas y no como un desplegable: hay cinco, cada
          uno con su icono y su explicacion, y un desplegable obligaria a abrir
          y cerrar para leer que hace cada uno. Ademas el color del estado se ve
          de un vistazo, que es justo lo que hace falta para no elegir el
          equivocado.
        */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {KEY_STATUS_VALUES.map((valor) => {
            const info = statusMeta(valor, TRANSLATIONS[locale]);
            const activo = estado === valor;

            return (
              <button
                key={valor}
                type="button"
                onClick={() => {
                  setEstado(valor);
                  setAplicadas(null);
                }}
                aria-pressed={activo}
                className={[
                  'flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  activo ? 'bg-hover-2 ring-2 ring-accent' : 'bg-hover ring-1 ring-line hover:bg-hover-2',
                ].join(' ')}
              >
                <span
                  className={[
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1',
                    info.tone,
                  ].join(' ')}
                >
                  <Icon name={info.icon} size={12} />
                </span>

                <span className="min-w-0">
                  <span className="block text-xs font-medium text-t1">{info.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-t4">
                    {info.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* --------------------------------------------------------- reparto ---
            Lo que va a pasar, antes de que pase. */}
        <div className="rounded-lg bg-surface-1 p-3 ring-1 ring-line">
          <p className="text-[11px] text-t3">{t('bulk.hint')}</p>

          <ul className="mt-2 flex flex-col gap-1 text-[11px]">
            <li className="flex items-center gap-2 text-ok">
              <Icon name="check" size={11} />
              {t('bulk.becomes', [preview.cambian.length, meta.label])}
            </li>

            {preview.iguales.length > 0 ? (
              <li className="flex items-center gap-2 text-t4">
                <Icon name="minus" size={11} />
                {t('bulk.alreadyThere', [preview.iguales.length, meta.label])}
              </li>
            ) : null}

            {preview.bloqueadas.length > 0 ? (
              <li className="flex items-start gap-2 text-warn">
                <Icon name="alert" size={11} />
                <span>
                  {t('bulk.cannotBecome', [preview.bloqueadas.length, meta.label])}
                  <span className="mt-0.5 block text-t4">
                    {preview.bloqueadas[0]?.key.title}: {preview.bloqueadas[0]?.motivo}
                  </span>
                </span>
              </li>
            ) : null}
          </ul>
        </div>

        {/*
          El exito se enseña aqui y no solo como aviso flotante, porque el
          dialogo sigue abierto: si solo saltara el aviso, al cerrar el dialogo
          ya no quedaria ninguna prueba de lo que acaba de pasar, y con un
          cambio en bloque sobre veinte claves eso no es un detalle.
        */}
        {aplicadas !== null ? (
          aplicadas > 0 ? (
            <p
              role="status"
              className="rounded-lg bg-ok/10 px-3 py-2 text-[11px] text-ok ring-1 ring-ok/20"
            >
              {t(pluralKey(aplicadas, 'bulk.doneOne', 'bulk.doneMany'), [aplicadas])}
            </p>
          ) : (
            <p
              role="status"
              className="rounded-lg bg-warn/10 px-3 py-2 text-[11px] text-warn ring-1 ring-warn/20"
            >
              {t('bulk.none')}
            </p>
          )
        ) : null}

        <div className="flex gap-2">
          <Button
            variant="primary"
            icon="check"
            onClick={() => void aplicar()}
            disabled={ocupado || preview.cambian.length === 0}
            title={
              preview.cambian.length === 0
                ? t('bulk.none')
                : t('bulk.pending', [preview.cambian.length, meta.label])
            }
          >
            {t('bulk.apply')}
          </Button>

          <Button variant="ghost" onClick={onClose}>
            {t('action.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}