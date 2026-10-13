import { useEffect, useState } from 'react';

import { cleanTag, normalizeTag, type ITag } from '@/contracts';
import { useT } from '@/context/locale.context';
import { pluralKey } from '@/helpers/i18n.helper';

import { ConfirmDialog } from './feedback.component';
import { Modal, ModalHeader } from './modal.component';
import { TagChip } from './tag-chip.component';
import { TagColorPicker } from './tag-color-picker.component';
import { Button, IconButton, INPUT_CLASS } from './ui.component';

export interface ITagManagerProps {
  /** `false` reproduce la animacion de salida antes de desaparecer. */
  open?: boolean;
  /** El catalogo de la base de datos, con su recuento de usos. */
  catalogo: readonly ITag[];
  /** Crea una etiqueta. Devuelve el nombre ya limpio, o `null` si no valia. */
  onCreate: (nombre: string) => Promise<string | null>;
  /**
   * Renombra una etiqueta en toda la coleccion. Devuelve cuantas claves se
   * han visto afectadas, o `null` si el nombre no valia.
   */
  onRename: (actual: string, nuevo: string) => Promise<number | null>;
  /** Quita una etiqueta. Devuelve cuantas claves la llevaban. */
  onRemove: (nombre: string) => Promise<number>;
  /**
   * Cambia el tono con el que se pinta una etiqueta.
   *
   * Va aqui y no en el dialogo de etiquetar claves porque el color es del
   * **vocabulario**, igual que el nombre: cambiar «dlc» de nombre propaga a las
   * cuarenta claves que la llevan y cambiarlo de color tambien tiene que verse
   * en las cuarenta. Si el selector de un dialogo de edicion pudesse hacerlo,
   * bastaria con abrir la ficha de una clave y tocar su etiqueta para que dos
   * etiquetas con el mismo nombre se vieran de dos maneras.
   */
  onColor: (clave: string, color: string) => Promise<void>;
  /** Pregunta si el nombre ya esta en el catalogo, para avisar de la fusion. */
  onExists: (nombre: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Gestion del vocabulario de la coleccion: que etiquetas existen y como se
 * llaman.
 *
 * Vive en Ajustes y no dentro del dialogo de etiquetar claves porque son dos
 * cosas distintas. Ahi se elige **que etiquetas se ponen** en las claves
 * seleccionadas, que es una decision de esta operacion. Aqui se decide **como
 * se llama cada etiqueta**, y eso afecta a toda la coleccion: renombrar «dlc»
 * cambia lo que pone en las cuarenta claves que la llevan, y no es algo que
 * se pueda repetir cuatro veces seguidas sin querer.
 *
 * Que el renombrado propague es justamente lo que hace que una etiqueta sea
 * una entidad y no un texto: si aqui se escribiera «dlc extra» y las claves
 * se quedaran con «dlc», el filtro buscaria las dos y no encontraria ninguna.
 *
 * El dialogo no habla con la base de datos —eso es de los servicios—, asi que
 * quien lo abre le pasa el catalogo ya cargado y los handlers ya montados.
 */
export function TagManager({
  open = true,
  catalogo,
  onCreate,
  onRename,
  onRemove,
  onColor,
  onExists,
  onClose,
}: ITagManagerProps) {
  const { t } = useT();

  const [nueva, setNueva] = useState('');
  const [ocupado, setOcupado] = useState(false);

  /**
   * La etiqueta que se esta renombrando, o `null`.
   *
   * El renombrado es en linea —se escribe encima de la fila— y no en un
   * dialogo aparte: con el catalogo entero delante, abrir otra ventana para
   * cambiar cuatro letras es un salto de mas. Lo que si necesita un paso
   * intermedio es **borrar**, porque eso no se deshace con Ctrl+Z.
   */
  const [editando, setEditando] = useState<string | null>(null);

  /** Lo que se ha escrito en la fila que se esta renombrando. */
  const [renombrando, setRenombrando] = useState('');

  /** La etiqueta pendiente de borrar, o `null`. */
  const [borrando, setBorrando] = useState<ITag | null>(null);

  /**
   * Una fusion pendiente de confirmar: renombrar «a» a «b» cuando «b» ya
   * existe. No es un renombrado sino una union —«a» desaparece y las claves
   * que lo llevaban se quedan solo con «b»—, asi que es valida pero no es lo
   * que se suele querer sin querer.
   */
  const [fusion, setFusion] = useState<{ desde: string; hacia: string } | null>(null);

  /**
   * Se repone **al abrir**.
   *
   * El dialogo no se desmonta al cerrarse —queda vivo para que la salida se
   * vea—, asi que sin esto el texto a medio escribir y la etiqueta a medio
   * renombrar se traspasan de una apertura a la siguiente.
   */
  useEffect(() => {
    if (!open) return;

    setNueva('');
    setEditando(null);
    setRenombrando('');
    setBorrando(null);
    setFusion(null);
  }, [open]);

  const crear = async (): Promise<void> => {
    if (ocupado) return;

    setOcupado(true);

    try {
      const creada = await onCreate(nueva);

      if (creada !== null) setNueva('');
    } finally {
      setOcupado(false);
    }
  };

  /**
   * Guarda el nombre nuevo de la etiqueta que se estaba editando.
   *
   * Si el destino ya existe se abre la confirmacion de fusion **antes** de
   * escribir nada, para que cancelar deje el catalogo como estaba en lugar de
   * haberlo cambiado ya y luego avisado.
   */
  const renombrar = async (): Promise<void> => {
    if (ocupado || editando === null) return;

    setOcupado(true);

    try {
      const destino = cleanTag(renombrando);

      if (destino.length === 0 || normalizeTag(destino) === normalizeTag(editando)) {
        setEditando(null);
        return;
      }

      if (await onExists(destino)) {
        setFusion({ desde: editando, hacia: destino });
        return;
      }

      await onRename(editando, destino);
      setEditando(null);
    } finally {
      setOcupado(false);
    }
  };

  const empezar = (tag: ITag): void => {
    setEditando(tag.nombre);
    setRenombrando(tag.nombre);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} size="auto" label={t('tags.manage.title')}>
        <ModalHeader
          title={t('tags.manage.title')}
          icon="tag"
          cerrar={{ alPulsar: onClose, texto: t('action.close') }}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <p className="text-xs leading-relaxed text-t3">{t('tags.manage.hint')}</p>

          {/*
            El alta se confirma con Enter y no con un boton de al lado: escribir
            «dlc» y pulsar Enter es lo que se espera de un campo de texto, y
            un boton obligaria a mover el raton para lo de siempre.
          */}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void crear();
            }}
          >
            <input
              value={nueva}
              onChange={(event) => setNueva(event.target.value)}
              placeholder={t('tags.manage.newPlaceholder')}
              aria-label={t('tags.manage.newPlaceholder')}
              maxLength={40}
              disabled={ocupado}
              className={INPUT_CLASS}
            />

            <Button
              type="submit"
              variant="primary"
              icon="plus"
              disabled={ocupado || nueva.trim().length === 0}
            >
              {t('tags.manage.add')}
            </Button>
          </form>

          <ul className="flex flex-col gap-1">
            {catalogo.length === 0 ? (
              <li className="rounded-lg bg-hover px-3 py-4 text-center text-xs text-t4">
                {t('tags.empty')}
              </li>
            ) : (
              catalogo.map((tag) => (
                <li
                  key={tag.nombre}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-hover"
                >
                  {editando === tag.nombre ? (
                    /*
                      Renombrando en linea. Enter guarda y Escape cancela: son
                      las dos teclas que ya se usan para lo mismo en toda la
                      app, y buscar el raton para confirmar un nombre de cuatro
                      letras es absurdo.
                    */
                    <>
                      <input
                        autoFocus
                        value={renombrando}
                        onChange={(event) => setRenombrando(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void renombrar();
                          if (event.key === 'Escape') setEditando(null);
                        }}
                        aria-label={t('tags.manage.renameLabel')}
                        maxLength={40}
                        className={INPUT_CLASS}
                      />

                      <Button
                        variant="ghost"
                        icon="check"
                        onClick={() => void renombrar()}
                        disabled={ocupado}
                        title={t('action.save')}
                        aria-label={t('action.save')}
                      >
                        {t('action.save')}
                      </Button>

                      <Button
                        variant="ghost"
                        icon="x"
                        onClick={() => setEditando(null)}
                        disabled={ocupado}
                        title={t('action.cancel')}
                        aria-label={t('action.cancel')}
                      >
                        {t('action.cancel')}
                      </Button>
                    </>
                  ) : (
                    <>
                      {/*
                        El orden es **nombre, recuento, color, renombrar,
                        borrar**, y los dos ultimos botones van solo con el icono.

                        El nombre primero porque es lo que se esta leyendo, y lo
                        unico que crece: lleva el `truncate` y se come el espacio
 * que sobre. El recuento despues, y pegado al color porque los dos son
                        cosas de la etiqueta que se miran de un vistazo y
                        ninguno de los dos se toca.

                        Lo que cambia respecto a como estaba es que el color
                        **no va dentro de la pastilla**. Con el boton dentro, el
                        boton se va al otro extremo de la fila —por muy ancho que
                        sea el nombre— y a `w-` de distancia del color que
                        cambia: habia que saltar la vista para decir «este es el
                        de esa». Ahora esta en su propia columna, siempre a la
                        misma distancia del final de la fila.

                        Y los botones solo con el icono. Con el texto, la fila
                        mas corta ocupaba casi cuatrocientos pixeles para cinco
                        palabras, y el dialogo se abia mas ancho que para lo que
                        hace. El texto no se pierde: va en el `title` y en el
                        `aria-label`, que es donde lo lee quien pasa el raton y
                        quien va con lector de pantalla.
                      */}
                      <span className="min-w-0 flex-1 truncate">
                        <TagChip tag={tag} />
                      </span>

                      <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-t4">
                        {t(pluralKey(tag.usos, 'tags.usesOne', 'tags.usesMany'), [
                          tag.usos,
                        ])}
                      </span>

                      <span className="flex w-8 shrink-0 justify-center">
                        <TagColorPicker
                          tag={tag}
                          onChange={(color) => {
                            if (!ocupado) void onColor(tag.clave, color);
                          }}
                        />
                      </span>

                      <IconButton
                        icon="pencil"
                        onClick={() => empezar(tag)}
                        disabled={ocupado}
                        title={t('tags.manage.rename')}
                      />

                      <IconButton
                        icon="trash"
                        onClick={() => setBorrando(tag)}
                        disabled={ocupado}
                        title={t('action.delete')}
                      />
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </Modal>

      {/*
        Los dos avisos van **dentro** del dialogo: se abren sobre el panel y se
        cierran volviendo al panel, no a la lista de claves que hay debajo, que
        es justo donde no se quiere estar mientras se decide.
      */}
      {borrando !== null ? (
        <ConfirmDialog
          title={t('tags.removeTitle')}
          message={t('tags.removeBody', [borrando.nombre, borrando.usos])}
          confirmLabel={t('action.delete')}
          onConfirm={async () => {
            await onRemove(borrando.nombre);
            setBorrando(null);
          }}
          onCancel={() => setBorrando(null)}
        />
      ) : null}

      {fusion !== null ? (
        <ConfirmDialog
          title={t('tags.manage.mergeTitle')}
          message={t('tags.manage.mergeBody', [fusion.desde, fusion.hacia])}
          confirmLabel={t('tags.manage.merge')}
          onConfirm={async () => {
            await onRename(fusion.desde, fusion.hacia);
            setFusion(null);
            setEditando(null);
          }}
          onCancel={() => setFusion(null)}
        />
      ) : null}
    </>
  );
}