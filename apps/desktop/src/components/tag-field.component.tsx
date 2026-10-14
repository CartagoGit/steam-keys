import { useMemo, useState } from 'react';

import { cleanTag, normalizeTag, type ITag } from '@/contracts';
import { useT } from '@/context/locale.context';
import { pluralKey } from '@/helpers/i18n.helper';

import { Icon } from './icon.component';
import { TagChip } from './tag-chip.component';

export interface ITagFieldProps {
  /** Las etiquetas de la clave, ya elegidas. */
  value: readonly string[];
  /** El catalogo completo, con su recuento de usos. */
  catalogo: readonly ITag[];
  /** Cambia el conjunto entero: se quita una o se anade otra. */
  onChange: (tags: readonly string[]) => void;
  /** Crea una etiqueta en el catalogo. Devuelve el nombre limpio, o `null`. */
  onCreate: (nombre: string) => Promise<string | null>;
  /** Abre el gestor, para renombrar o quitar la etiqueta de toda la coleccion. */
  onManage: () => void;
  /** `true` mientras se guarda: el campo no acepta pulsaciones. */
  disabled?: boolean;
}

/**
 * Campo de etiquetas de una clave.
 *
 * Antes era un `<input>` de texto con las etiquetas separadas por comas, y
 * con eso solo se podia añadir escribiendo de memoria el nombre exacto. Si te
 * equivocabas al escribir «humble» —una mayuscula de mas, un espacio— te
 * acababa una etiqueta nueva que no era la de las otras trescientas claves,
 * y el filtro por etiqueta no encontraba nada.
 *
 * ## El catalogo se ve, no se esconde
 *
 * Lo que hay **debajo** es la lista de etiquetas de la coleccion, cada una con
 * su color y con las veces que se usa, y se marca las que lleva esta clave. Es
 * la misma lista, con el mismo aspecto y en el mismo sitio, que la del filtro
 * de la barra: son las mismas etiquetas y elegirlas es lo mismo, asi que tener
 * dos versiones distintas obligaba a aprender el sitio dos veces.
 *
 * Estaba dentro de un desplegable, y salia mal por tres cosas a la vez. Una es
 * que el desplegable tapaba el resto del formulario mientras se elegia. Otra
 * que el boton de engranaje —abrir el gestor— estaba **dentro** del desplegable,
 * en un pie aparte, y por eso aparecia en cuanto se abria el desplegable de
 * «Anadir etiqueta» sin haber pedido el gestor. Y la peor: el area de pulsacion
 * del desplegable se solapaba con las etiquetas ya elegidas de arriba, asi que
 * pulsar en un hueco entre dos botones **desmarcaba** una etiqueta que no se
 * habia tocado. Con la lista a la vista no hay solapamientos: cada elemento es
 * un boton, ocupa su sitio, y lo que se pulsa es lo que se ve.
 *
 * ## Anadir esta en linea
 *
 * El campo de escribir aparece y desaparece al pulsar «Anadir etiqueta», sin
 * desplegable. Crear «dlc extra» es la accion mas frecuente y con el campo
 * debajo habia que abrir la lista, escribir, cerrar y volver a elegir.
 *
 * Es el mismo componente para el editor de una clave y para el de varias. La
 * diferencia entre editar una y editar treinta es que se hace sobre una fila o
 * sobre un grupo, y eso lo decide quien abre, no el campo.
 *
 * ## Las etiquetas no se borran desde aqui
 *
 * Quitar la etiqueta a **esta** clave es quitar la pastilla; quitar la
 * etiqueta a la **coleccion** es otra cosa, porque se lleva por delante las
 * trescientas claves que la tienen, y eso vive en el gestor.
 */
export function TagField({
  value,
  catalogo,
  onChange,
  onCreate,
  onManage,
  disabled = false,
}: ITagFieldProps) {
  const { t } = useT();

  const [anadiendo, setAnadiendo] = useState(false);
  const [nueva, setNueva] = useState('');
  const [ocupado, setOcupado] = useState(false);

  /** Las marcadas, para pintar la lista contra ellas. */
  const marcadas = useMemo(() => new Set(value.map(normalizeTag)), [value]);

  /**
   * El catalogo por clave normalizada, para pintar las etiquetas ya elegidas.
   *
   * Se busca **una vez** y no dentro de un `.find` por pastilla: el campo puede
   * llevar diez etiquetas y el catalogo cuarenta, y con el `find` dentro eran
   * cuatrocientas comparaciones en cada repintado.
   *
   * Van **entras** las dos y no solo el color, porque las dos mitades van
   * juntas: la etiqueta de la clave es su clave —«cumplidos»— y el catalogo es
   * el unico que sabe como se llama («Cumplidos» si alguien la renombro asi).
   * Sin resolverlo aqui, las pastillas del editor saldrian en minusculas mientras
   * el filtro y el gestor las mostrarian con la caja buena, y serian dos
   * Aspectos de la misma palabra en la misma pantalla.
   *
   * Las que no estan en el catalogo —una etiqueta todavia no guardada— se
   * quedan con su clave y su texto, que es lo unico que hay.
   */
  const porClave = useMemo(
    () => new Map(catalogo.map((tag) => [tag.clave, tag])),
    [catalogo],
  );

  /** Como se ve una etiqueta de la clave.
   */
  const presente = (clave: string): ITag | undefined => porClave.get(normalizeTag(clave));

  const alternar = (nombre: string): void => {
    const clave = normalizeTag(nombre);

    onChange(
      marcadas.has(clave)
        ? value.filter((tag) => normalizeTag(tag) !== clave)
        : [...value, cleanTag(nombre)],
    );
  };

  /**
   * Anade la etiqueta escrita y la deja puesta.
   *
   * Se escribe en el catalogo antes de ponerla, y no al guardar la clave: si se
   * cerrara el editor sin guardar, la etiqueta habria existido igual. Un
   * catalogo se parece mas a un conjunto de palabras que a un borrador, y lo
   * que se ha decidido que existe no se deshace por cancelar.
   */
  const anadirNueva = async (): Promise<void> => {
    if (ocupado || nueva.trim().length === 0) return;

    setOcupado(true);

    try {
      const creada = await onCreate(nueva);

      if (creada !== null) {
        if (!marcadas.has(normalizeTag(creada))) onChange([...value, creada]);

        setNueva('');
        setAnadiendo(false);
      }
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/*
        Las de la clave van como Pastillas con aspa, que es como se ve una
        etiqueta en el resto de la app. El aspa va **encima** del borde derecho
        de la pastilla y su envoltorio es `relative`: sin eso el boton se
        posiciona respecto al **formulario entero** y todas las aspas se apilan
        en la misma esquina. Se pulsaba una y se quitaba otra —o ninguna—, que
        es lo que pasaba antes.
      */}
      {value.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {value.map((tag) => {
            const entrada = presente(tag);
            const nombre = entrada?.nombre ?? tag;

            return (
              <span key={tag} className="group relative inline-flex items-center">
                <TagChip
                  tag={{ nombre, color: entrada?.color ?? '' }}
                  marcada
                  className={entrada?.color === '' || entrada === undefined ? '' : 'pr-4'}
                />

                <button
                  type="button"
                  onClick={() => onChange(value.filter((otra) => otra !== tag))}
                  disabled={disabled}
                  title={t('tags.removeOne', [nombre])}
                  aria-label={t('tags.removeOne', [nombre])}
                  className={[
                    'absolute top-1/2 right-1 -translate-y-1/2 rounded-full p-0.5',
                    'transition focus-visible:outline-2 focus-visible:outline-offset-1',
                    'focus-visible:outline-on-accent',
                  ].join(' ')}
                >
                  <Icon name="x" size={9} />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      {/* ------------------------------------------------------ anadir --- */}
      {anadiendo ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={nueva}
            disabled={ocupado}
            onChange={(event) => setNueva(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void anadirNueva();
              }

              // El Escape sale del campo de escribir, no del dialogo: con el
              // editor encima, uno cerraba los dos y se perdia lo escrito.
              if (event.key === 'Escape') {
                event.stopPropagation();
                setAnadiendo(false);
                setNueva('');
              }
            }}
            placeholder={t('tags.manage.newPlaceholder')}
            aria-label={t('tags.manage.newPlaceholder')}
            maxLength={40}
            className={[
              'min-w-0 flex-1 rounded-md bg-hover px-2 py-1.5 text-xs text-t1',
              'outline-none placeholder:text-t4',
            ].join(' ')}
          />
          <button
            type="button"
            onClick={() => void anadirNueva()}
            disabled={ocupado || nueva.trim().length === 0}
            title={t('tags.manage.add')}
            aria-label={t('tags.manage.add')}
            className={[
              'shrink-0 rounded-md bg-accent px-2 py-1.5 text-[11px] font-medium text-on-accent',
              'transition disabled:opacity-50',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            ].join(' ')}
          >
            {t('tags.manage.add')}
          </button>
          <button
            type="button"
            onClick={() => {
              setAnadiendo(false);
              setNueva('');
            }}
            disabled={ocupado}
            title={t('action.cancel')}
            aria-label={t('action.cancel')}
            className={[
              'shrink-0 rounded-md px-1.5 py-1.5 text-t4 transition hover:text-t1',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            ].join(' ')}
          >
            <Icon name="x" size={11} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {/*
            Los dos botones van **siempre a la vista**, no el engranaje dentro de
            un desplegable. Abrir el gestor es quitar o renombrar una etiqueta en
            toda la coleccion, y esconderlo detras de «Anadir etiqueta» hacia
            que el boton apareciera al Pulsar algo que no tiene nada que ver con
            el gestor.
          */}
          <button
            type="button"
            onClick={() => setAnadiendo(true)}
            disabled={disabled}
            title={t('tags.addOne')}
            aria-label={t('tags.addOne')}
            className={[
              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ring-1',
              'bg-hover text-t3 ring-line hover:text-t1',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            ].join(' ')}
          >
            <Icon name="plus" size={11} />
            {t('tags.addOne')}
          </button>

          <button
            type="button"
            onClick={onManage}
            disabled={disabled}
            title={t('tags.manage.title')}
            aria-label={t('tags.manage.title')}
            className={[
              'shrink-0 rounded-md p-1 text-t4 transition hover:bg-hover hover:text-t1',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            ].join(' ')}
          >
            <Icon name="settings" size={13} />
          </button>
        </div>
      )}

      {/* ------------------------------------------- catalogo visible --- */}
      {/*
        La lista de la coleccion, siempre a la vista. Cada boton ocupa su sitio
        y no hay nada detras: antes el desplegable se solapaba con las
        pastillas de arriba y al pulsar un hueco se desmarcaba una etiqueta.

        Sin barra de desplazamiento a proposito —es un `flex-wrap`, y lo que no
        cabe pasa a la linea de abajo—: el desplegable tapaba el formulario y
        obligaba a cerrarlo para ver lo que habia debajo.
      */}
      {catalogo.length === 0 ? (
        <p className="text-[11px] text-t4">{t('tags.empty')}</p>
      ) : (
        <ul
          className="flex flex-wrap items-center gap-1"
          aria-label={t('tags.manage.title')}
        >
          {catalogo.map((tag) => {
            const marcada = marcadas.has(normalizeTag(tag.nombre));

            return (
              <li key={tag.nombre}>
                <button
                  type="button"
                  onClick={() => alternar(tag.nombre)}
                  disabled={disabled}
                  aria-pressed={marcada}
                  title={`${tag.nombre} · ${t(
                    pluralKey(tag.usos, 'tags.usesOne', 'tags.usesMany'),
                    [tag.usos],
                  )}`}
                  className={[
                    'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition',
                    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                    marcada
                      ? 'bg-hover-2 text-t1 ring-1 ring-line-strong'
                      : 'text-t4 ring-1 ring-transparent hover:bg-hover hover:text-t3',
                  ].join(' ')}
                >
                  {/* El disco va delante, como en el filtro de la barra. */}
                  {tag.color === '' ? null : (
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                  )}

                  <span className="truncate">{tag.nombre}</span>

                  <span className="shrink-0 text-[10px] tabular-nums opacity-70">
                    {tag.usos}
                  </span>

                  {marcada ? <Icon name="check" size={10} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}