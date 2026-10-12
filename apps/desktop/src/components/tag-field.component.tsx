import { useMemo, useRef, useState } from 'react';

import { cleanTag, normalizeTag, type ITag } from '@/contracts';
import { useT } from '@/context/locale.context';
import { pluralKey } from '@/helpers/i18n.helper';

import { Icon } from './icon.component';
import { Popover, PopoverOption } from './popover.component';
import { Button } from './ui.component';

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
 * Ahora las etiquetas se **eligen de una lista**, que es la unica forma de no
 * inventarse el nombre: la lista es el catalogo de la base de datos y cada
 * una lleva delante cuantas claves la usan, que es justo lo que hace falta
 * para no crear «dlc 2» sin darse cuenta.
 *
 * Es el mismo componente para el editor de una clave y para el de varias. La
 * diferencia entre editar una y editar treinta es que se tahce sobre una fila
 * o sobre un grupo, y eso lo decide quien abre, no el campo.
 *
 * Las etiquetas no se borran desde aqui. Quitar la etiqueta a **esta** clave
 * es quitar la pastilla; quitar la etiqueta a la **coleccion** es otra cosa,
 * porque se lleva por delante las trescientas claves que la tienen, y eso vive
 * en Ajustes > Claves. El boton de engrenaje esta ahi para que no haya que
 * recordar donde esta.
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

  const botonRef = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [nueva, setNueva] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [resaltada, setResaltada] = useState(0);

  /** Las marcadas, para pintar la lista contra ellas. */
  const marcadas = useMemo(() => new Set(value.map(normalizeTag)), [value]);

  const alternar = (nombre: string): void => {
    const clave = normalizeTag(nombre);
    const siguiente = marcadas.has(clave)
      ? value.filter((tag) => normalizeTag(tag) !== clave)
      : [...value, cleanTag(nombre)];

    onChange(siguiente);
  };

  /**
   * Anade la etiqueta escrita y la deja puesta.
   *
   * Se escribe en el catalogo antes de ponerla, y no al guardar la clave: si
   * se cerrara el editor sin guardar, la etiqueta habria existido igual. Un
   * catalogo se parece mas a un conjunto de palabras que a un borrador, y
   * lo que se ha decidido que existe no se deshace por cancelar.
   */
  const anadirNueva = async (): Promise<void> => {
    if (ocupado || nueva.trim().length === 0) return;

    setOcupado(true);

    try {
      const creada = await onCreate(nueva);

      if (creada !== null) {
        if (!marcadas.has(normalizeTag(creada))) onChange([...value, creada]);
        setNueva('');
        setAbierto(false);
      }
    } finally {
      setOcupado(false);
    }
  };

  const alTeclado = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && abierto) {
      // El Popover ya lo captura en fase de captura y detiene la propagacion,
      // asi que esto es solo para cuando se escribe con el foco dentro.
      setAbierto(false);
      return;
    }

    if (abierto && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setResaltada((actual) => {
        const siguiente = actual + (event.key === 'ArrowDown' ? 1 : -1);
        return (siguiente + catalogo.length) % Math.max(catalogo.length, 1);
      });
      return;
    }

    if (abierto && event.key === 'Enter' && document.activeElement?.tagName !== 'INPUT') {
      event.preventDefault();
      const elegida = catalogo[resaltada];
      if (elegida) alternar(elegida.nombre);
    }
  };

  return (
    <div className="flex flex-col gap-2" onKeyDown={alTeclado}>
      <div className="flex flex-wrap items-center gap-1.5">
        {/*
          Las etiquetas de la clave van como Pastillas con aspa, no como texto.
          Una pastilla se quita con un clic en la aspa y no hay forma de
          borrarse «media etiqueta» por error, que es lo que pasaba escribiendo.
        */}
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-info/15 py-0.5 pr-0.5 pl-2 text-[11px] font-medium text-info-strong ring-1 ring-info/40"
          >
            {tag}

            <button
              type="button"
              onClick={() =>
                onChange(value.filter((otra) => otra !== tag))
              }
              disabled={disabled}
              title={t('tags.removeOne', [tag])}
              aria-label={t('tags.removeOne', [tag])}
              className="rounded p-0.5 transition hover:bg-info/30 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Icon name="x" size={10} />
            </button>
          </span>
        ))}

        <button
          ref={botonRef}
          type="button"
          onClick={() => {
            setResaltada(0);
            setAbierto((v) => !v);
          }}
          disabled={disabled}
          aria-expanded={abierto}
          aria-haspopup="listbox"
          title={t('tags.addOne')}
          aria-label={t('tags.addOne')}
          className={[
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ring-1',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            abierto
              ? 'bg-hover-2 text-t1 ring-line-strong'
              : 'bg-hover text-t3 ring-line hover:text-t1',
          ].join(' ')}
        >
          <Icon name="plus" size={11} />
          {t('tags.addOne')}
        </button>

        {/*
          El engranaje abre el gestor. Esta ahi porque quitar una etiqueta a
          toda la coleccion —y renombrarla— es una accion distinta de quitar
          la pastilla, y sin esto habria que acordarse de que vive en Ajustes.
        */}
        <button
          type="button"
          onClick={onManage}
          disabled={disabled}
          title={t('tags.manage.title')}
          aria-label={t('tags.manage.title')}
          className="ml-auto rounded-md p-1 text-t4 transition hover:bg-hover hover:text-t1 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Icon name="settings" size={13} />
        </button>
      </div>

      {abierto ? (
        <Popover abierto ancla={botonRef} onCerrar={() => setAbierto(false)}>
          {/*
            El campo para escribir esta **dentro** de la lista y no debajo: es
            la accion mas frecuente —crear «dlc extra»— y con el campo debajo
            habia que cerrar la lista, escribir, volver a abrir y elegir.
          */}
          <div className="border-b border-line p-2">
            <input
              autoFocus
              value={nueva}
              onChange={(event) => setNueva(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void anadirNueva();
                }
                // El Escape lo corta el Popover; sin esto se cerraria la lista
                // pero el editor tambien, que es lo de siempre: un Escape
                // cerrando dos capas.
                if (event.key === 'Escape') event.stopPropagation();
              }}
              placeholder={t('tags.manage.newPlaceholder')}
              aria-label={t('tags.manage.newPlaceholder')}
              maxLength={40}
              className="w-full rounded-md bg-hover px-2 py-1.5 text-xs text-t1 outline-none placeholder:text-t4"
            />
          </div>

          <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
            {catalogo.length === 0 ? (
              <li className="px-3 py-3 text-center text-[11px] text-t4">
                {t('tags.empty')}
              </li>
            ) : (
              catalogo.map((tag, indice) => {
                const marcada = marcadas.has(normalizeTag(tag.nombre));

                return (
                  <PopoverOption
                    key={tag.nombre}
                    activa={marcada}
                    resaltada={resaltada === indice}
                    alPulsar={() => alternar(tag.nombre)}
                  >
                    <span className="min-w-0 flex-1 truncate">{tag.nombre}</span>

                    <span className="shrink-0 text-[10px] tabular-nums text-t4">
                      {t(pluralKey(tag.usos, 'tags.usesOne', 'tags.usesMany'), [tag.usos])}
                    </span>
                  </PopoverOption>
                );
              })
            )}
          </ul>

          {/*
            El boton va **abajo**, al lado de la lista, no dentro de cada
            etiqueta: dentro habria un boton de borrar por fila, y en una
            etiqueta de la clave es distinto —quitar la de esta clave— de
            quitarla de la coleccion. Dos acciones parecidas en dos sitios es
            la forma mas rapida de borrar la etiqueta equivocada.
          */}
          <div className="border-t border-line p-1.5">
            <Button
              variant="ghost"
              icon="settings"
              onClick={onManage}
            >
              {t('settings.keys.tags.manage')}
            </Button>
          </div>
        </Popover>
      ) : null}
    </div>
  );
}