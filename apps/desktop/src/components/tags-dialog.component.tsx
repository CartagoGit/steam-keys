import { useEffect, useMemo, useState } from 'react';
import { cleanTag, normalizeTag, platformTags, type IGameKey, type ITag, type KeyPlatform } from '@/contracts';
import { Icon } from './icon.component';
import { Modal, ModalHeader } from './modal.component';
import { Button, INPUT_CLASS } from './ui.component';
import { ConfirmDialog } from './feedback.component';
import { useT } from '@/context/locale.context';
import { pluralKey } from '@/helpers/i18n.helper';

export interface ITagsDialogProps {
  /** Las claves seleccionadas. */
  entries: readonly IGameKey[];
  /** `false` reproduce la animacion de salida antes de desaparecer. */
  open?: boolean;
  /** Plataformas de la seleccion, para ofrecer sus etiquetas primero. */
  plataformas: readonly KeyPlatform[];
  /** Las etiquetas finales, ya calculadas por quien abre el dialogo. */
  iniciales: readonly string[];
  /**
   * El catalogo de la base de datos, con su recuento de usos.
   *
   * Lo carga quien abre, no el dialogo: el dialogo no habla con la base de
   * datos —eso es de los servicios— y asi la lista esta lista cuando se ve,
   * sin un parpadeo de «cargando» en cada apertura.
   */
  catalogo: readonly ITag[];
  /** Crea una etiqueta en el catalogo. Devuelve el nombre ya limpio. */
  onCreate: (nombre: string) => Promise<string | null>;
  /**
   * Quita la etiqueta del catalogo y de las claves que la llevan. Devuelve
   * cuantas claves se han visto afectadas.
   */
  onRemove: (nombre: string) => Promise<number>;
  onConfirm: (tags: readonly string[]) => void;
  onCancel: () => void;
}

/**
 * Dialogo para poner etiquetas a varias claves de una vez.
 *
 * La lista sale del **catalogo** de la base de datos, no de aplanar la
 * coleccion en memoria como se hacia antes. La diferencia se nota en las tres
 * cosas que se pueden hacer con una etiqueta:
 *
 * - **Crearla** de verdad, para que exista aunque se cancele y aunque todavia
 *   no la lleve ninguna clave. Antes solo se anadia a la seleccion, y cancelar
 *   la dejaba en la nada.
 * - **Quitarla**, para que una etiqueta que ha dejado de servir no aparezca en
 *   todas las listas hasta el final de los tiempos. Antes no habia forma.
 * - **Ver cuantas claves la usan**, que es lo que distingue «dlc», en cuarenta
 *   claves, de una etiqueta experimental en una.
 *
 * Al confirmar se devuelven las etiquetas finales ya calculadas: quien llama
 * decide si la operacion es anadir, quitar o reemplazar, porque aqui solo se
 * edita el conjunto.
 */
export function TagsDialog({
  entries,
  open = true,
  plataformas,
  iniciales,
  catalogo,
  onCreate,
  onRemove,
  onConfirm,
  onCancel,
}: ITagsDialogProps) {
  const { t } = useT();
  const [seleccionadas, setSeleccionadas] = useState<ReadonlySet<string>>(
    () => new Set(iniciales.map(normalizeTag)),
  );

  const [nueva, setNueva] = useState('');

  /**
   * La etiqueta pendiente de borrar, o `null`.
   *
   * No se borra en el acto: primero se pregunta. Quitar una etiqueta la
   * arranca de **todas** las claves que la llevan, y eso no se deshace con
   * Ctrl+Z —el deshacer de la app solo mira el estado de una clave, no de un
   * cambio de vocabulario. Asi que hace falta un paso intermedio.
   */
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /**
   * Las etiquetas se reponen **al abrir**, no al montar.
   *
   * El dialogo no se desmonta al cerrarse —queda vivo para que la salida
   * se vea— asi que sin esto `seleccionadas` se traspasa de una
   * seleccion a la siguiente: se abre para un grupo de claves, se cierra
   * y se abre para otro, y aparecen marcadas las del primero. Pulsar
   * «Aplicar» las escribia encima de las nuevas, que es justo el fallo
   * que hace destructivo al dialogo.
   *
   * La transicion se mira en `open` y no en la identidad de `iniciales` a
   * proposito: `iniciales` es `etiquetasComunes(selectedKeys)`, un array
   * nuevo en cada repintado, asi que un efecto que dependiera de el
   * repondria las etiquetas con cada cambio de idioma y se comeria lo que
   * el usuario hubiera marcado. Mientras el dialogo esta abierto la
   * seleccion no cambia, asi que no hay caso que se pierda.
   *
   * El montaje tambien esta cubierto: `tagsVivo` monta el dialogo ya
   * abierto, y ese primer `open === true` dispara el efecto igual que
   * cualquier otra apertura.
   */
  useEffect(() => {
    if (!open) return;

    setSeleccionadas(new Set(iniciales.map(normalizeTag)));
    setNueva('');
    setPorBorrar(null);
  }, [open]);

  /**
   * La lista de etiquetas del catalogo, con el catalogo de la plataforma
   * delante.
   *
   * Las de la plataforma —«battlenet», «blizzard» para Battle.net— se ofrecen
   * primero porque son las que casi siempre hacen falta en ese momento, y no
   * se repiten si ya estan en el catalogo. Lo que viene del catalogo son las
   * que ya existen en la app, ordenadas por uso.
   */
  const plataforma = useMemo(
    () => (plataformas[0] === undefined ? [] : platformTags(plataformas[0])),
    [plataformas],
  );

  const sugeridas = useMemo(() => {
    const vistas = new Set<string>();
    const salida: ITag[] = [];

    for (const nombre of plataforma) {
      const clave = normalizeTag(nombre);

      if (clave.length === 0 || vistas.has(clave)) continue;

      vistas.add(clave);

      // Las de plataforma que ya estan en el catalogo toman su recuento de
      // ahi, para que «dlc» salga con el mismo numero de usos vaya donde vaya.
      salida.push(
        catalogo.find((tag) => normalizeTag(tag.nombre) === clave) ?? {
          nombre: cleanTag(nombre),
          usos: 0,
        },
      );
    }

    for (const tag of catalogo) {
      const clave = normalizeTag(tag.nombre);

      if (clave.length === 0 || vistas.has(clave)) continue;

      vistas.add(clave);
      salida.push(tag);
    }

    return salida;
  }, [catalogo, plataforma]);

  const alternar = (tag: string): void => {
    setSeleccionadas((anterior) => {
      const siguiente = new Set(anterior);
      const clave = normalizeTag(tag);

      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);

      return siguiente;
    });
  };

  /**
   * Anade la etiqueta escrita y la deja marcada.
   *
   * Se escribe **en la base de datos**, no solo en la seleccion. Es la
   * diferencia entre una etiqueta y un borrador: si se cancela el dialogo, una
   * sigue existiendo y se puede volver a marcar en cualquier momento. Antes
   * vivia solo en la seleccion, y cancelar la dejaba en la nada.
   */
  const anadirNueva = async (): Promise<void> => {
    if (ocupado) return;

    setOcupado(true);

    try {
      const creada = await onCreate(nueva);

      if (creada !== null) {
        setSeleccionadas((anterior) => new Set([...anterior, creada]));
        setNueva('');
      }
    } finally {
      setOcupado(false);
    }
  };

  /**
   * Quita la etiqueta del catalogo y de las claves que la llevan.
   *
   * Sale un aviso con el numero de claves afectadas **antes** de hacerlo, y
   * por dos motivos: porque quitar una etiqueta de la coleccion entera no es
   * lo mismo que quitarla de este grupo, y porque ese cambio no lo recoge el
   * deshacer de la app, que solo recuerda el estado de una clave. Sin el aviso
   * no habria forma de saber que era una accion de otro alcance.
   */
  const confirmarBorrado = async (): Promise<void> => {
    if (porBorrar === null || ocupado) return;

    setOcupado(true);

    try {
      await onRemove(porBorrar);

      setSeleccionadas((anterior) => {
        const siguiente = new Set(anterior);

        siguiente.delete(normalizeTag(porBorrar));

        return siguiente;
      });

      setPorBorrar(null);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal open={open} onClose={onCancel} size="lg" label={t('tags.title')}>
      {/*
        El icono va a 16 px como los demas y no a 15. Con los cinco titulos a la
        misma medida el de este dialogo se leia un poco mas pequeno, y no
        porque quisiera: porque se escribio antes de que hubiera una cabecera
        comun y cada uno cogio su medida.
      */}
      <ModalHeader
        title={t('tags.title')}
        subtitle={t(pluralKey(entries.length, 'tags.count.one', 'tags.count.many'), [
          entries.length,
        ])}
        icon="tag"
        tone="text-info"
        cerrar={{ alPulsar: onCancel, texto: t('action.close') }}
      />

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* ------------------------------------------------- nueva etiqueta */}
          <div className="flex gap-2">
            <input
              type="text"
              value={nueva}
              onChange={(event) => setNueva(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void anadirNueva();
                }
              }}
              placeholder={t('tags.new')}
              className={INPUT_CLASS}
            />
            <Button
              variant="subtle"
              icon="plus"
              onClick={() => void anadirNueva()}
              disabled={ocupado || cleanTag(nueva).length === 0}
              title={t('tags.addHint')}
            >
              {t('action.add')}
            </Button>
          </div>

          {/* ------------------------------------------------------ existentes */}
          {sugeridas.length === 0 ? (
            <p className="mt-6 text-center text-xs text-t4">
              {t('tags.empty')}
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {sugeridas.map((tag) => {
                const activa = seleccionadas.has(normalizeTag(tag.nombre));

                return (
                  /*
                   * Cada etiqueta es un grupo con su boton y su papelera, no
                   * un boton suelto: el de borrar tiene que estar **al lado**
                   * de la etiqueta a la que pertenece, y dentro del mismo
                   * `aria-pressed` no se puede meter un segundo boton.
                   */
                  <span
                    key={tag.nombre}
                    className={[
                      'inline-flex items-center gap-0.5 rounded-full pr-1 transition',
                      activa
                        ? 'bg-accent text-on-accent ring-1 ring-accent'
                        : 'bg-hover text-t2 ring-1 ring-line hover:bg-hover-2',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      onClick={() => alternar(tag.nombre)}
                      aria-pressed={activa}
                      className="rounded-full py-1.5 pl-3 pr-1.5 text-xs"
                    >
                      {activa ? (
                        <Icon name="check" size={11} className="mr-1 inline" />
                      ) : null}

                      {tag.nombre}

                      {/*
                        El numero de usos va en la propia pastilla y no en el
                        `title`: el texto emergente no sale hasta que el
                        raton lleva un rato encima, y esto es justo el dato
                        que hace falta para decidir si la etiqueta se puede
                        borrar sin miedo.
                      */}
                      {tag.usos > 0 ? (
                        <span className="ml-1.5 text-[10px] opacity-70">
                          {tag.usos}
                        </span>
                      ) : null}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPorBorrar(tag.nombre)}
                      disabled={ocupado}
                      title={t('tags.removeHint')}
                      aria-label={t('tags.removeLabel', [tag.nombre])}
                      className="rounded-full p-1 opacity-50 transition hover:bg-danger/20 hover:text-danger hover:opacity-100 disabled:opacity-30"
                    >
                      <Icon name="trash" size={11} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p className="text-[11px] text-t4">{t('tags.merging')}</p>

          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={onCancel}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => onConfirm([...seleccionadas])}
              title={t('tags.applyHint')}
            >
              {t('action.apply')}
            </Button>
          </div>
        </footer>

        {/*
          La confirmacion va **dentro** del dialogo, no como otro modal por
          encima. `Modal` ya se encarga de la trampa de foco y de que Escape
          suba un nivel en vez de cerrar todo, y un segundo modal anidado
          tendria que volver a hacer las dos cosas.
        */}
        {porBorrar !== null ? (
          <ConfirmDialog
            title={t('tags.removeTitle')}
            message={t('tags.removeBody', [
              porBorrar,
              t(pluralKey(catalogo.find((tag) => tag.nombre === porBorrar)?.usos ?? 0, 'tags.usesOne', 'tags.usesMany'), [
                catalogo.find((tag) => tag.nombre === porBorrar)?.usos ?? 0,
              ]),
            ])}
            confirmLabel={t('action.delete')}
            onConfirm={() => void confirmarBorrado()}
            onCancel={() => setPorBorrar(null)}
          />
        ) : null}
    </Modal>
  );
}