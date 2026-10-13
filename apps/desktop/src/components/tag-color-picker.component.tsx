import { useRef, useState } from 'react';

import { TAG_COLORS, TAG_COLOR_CLASS, type TagColor, type TagTone, type TranslationKey } from '@/contracts';
import { useT } from '@/context/locale.context';
import { colorDe } from '@/helpers/tags.helper';

import { Popover } from './popover.component';

export interface ITagColorPickerProps {
  /** La etiqueta a la que pertenece el color. */
  tag: { nombre: string; color: TagColor | '' };
  onChange: (color: TagColor | '') => void;
}

/** Lado del disco del boton. */
const DISCO = 18;

/** Lado del disco de la paleta. */
const MUESTRA = 26;

/** Separacion entre muestras, para que el panel se pueda calcular entero. */
const HUECO = 6;

/**
 * El nombre de cada tono.
 *
 * Van **escritas** y no montadas con `` `tags.color.${tono}` `` por dos razones.
 * Una es que el guard de claves muertas busca el literal, y construida no la
 * encontraria: daria por buenas cinco pistas que nadie ve. La otra es que el
 * idioma es `TranslationKey` —cualquier cadena— y no un tipo cerrado, asi que
 * una clave construida se cuela sin que nadie la compruebe.
 *
 * `info` y `info-soft` guardan la intensidad **dentro** del color, porque en el
 * panel hay que distinguir «rojo entero» de «rojo claro». Para el nombre no: ahi
 * «rojo» es rojo las dos veces, y lo que se anuncia aparte es la intensidad.
 */
const CLAVE_TONO: Readonly<Record<TagTone, TranslationKey>> = Object.freeze({
  accent: 'tags.color.accent',
  ok: 'tags.color.ok',
  warn: 'tags.color.warn',
  info: 'tags.color.info',
  danger: 'tags.color.danger',
});

/**
 * El panel de color de una etiqueta.
 *
 * El boton es el **disco del color actual**, no un boton con la palabra
 * «color» al lado: cabe el color entero en el hueco que ya ocupa el nombre, no
 * hace falta un control mas en una fila que ya tiene el recuento y dos botones.
 * Y el disco va relleno y no con el color puesto en `style`, para que tambien
 * siga el tema.
 *
 * La paleta son diez muestras en dos filas de cinco: la de arriba con el color
 * entero y la de abajo diluido. Diez en una rejilla de cinco por dos dice sola
 * lo que diez en una fila de diez no —que hay cinco tonos y dos intensidades—,
 * y de paso son las dos filas de las que habla `TAG_COLOR_CLASS`, sin duplicar
 * la combinacion en el marcado.
 *
 * Abajo va «Sin color», que **no** es dejar de pintar: es volver al color que
 * sale del nombre. Sin esa fila no habria manera de deshacer la eleccion, y
 * con ella el boton queda como estaba sin tener que acordarse de que tono tenia.
 */
export function TagColorPicker({ tag, onChange }: ITagColorPickerProps) {
  const { t } = useT();
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  const actual = colorDe(tag);
  const elegida = tag.color !== '';

  const elegir = (color: TagColor | ''): void => {
    onChange(color);
    setAbierto(false);
  };

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-label={t('tags.color.label')}
        title={t('tags.color.label')}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className={[
          'shrink-0 rounded-full transition-transform',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          abierto ? 'scale-110' : 'hover:scale-110',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'block rounded-full ring-1 ring-borde',
            TAG_COLOR_CLASS[actual].pastilla,
          ].join(' ')}
          style={{ width: DISCO, height: DISCO }}
        />
      </button>

      <Popover
        abierto={abierto}
        ancla={boton}
        onCerrar={() => setAbierto(false)}
        lado="derecha"
        // No es una lista: son diez botones y un pie. Declararlo `listbox`
        // haria que un lector de pantalla anunciase «lista de diez elementos»
        // y luego se encontrase con un boton mas.
        esLista={false}
        ancho={MUESTRA * 5 + HUECO * 4 + 16}
        altoMaximo={MUESTRA * 2 + HUECO + 44}
        className="p-2"
        aria-label={t('tags.color.label')}
      >
        <div className="grid grid-cols-5 justify-items-center gap-1.5">
          {TAG_COLORS.map((color, indice) => (
            <button
              key={color}
              type="button"
              /*
               * El nombre lleva **intensidad y tono**.
               *
               * Con la intensidad sola —«Tono entero», «Tono diluido»— los diez
               * botones se llamarian igual y un lector de pantalla oiria cinco
               * veces la misma palabra sin manera de elegir. Y el color es justo
               * lo que hay que poder elegir sin ver.
               */
              aria-label={`${t(indice < 5 ? 'tags.color.full' : 'tags.color.soft')} · ${t(
                CLAVE_TONO[color.replace('-soft', '') as TagTone],
              )}`}
              aria-pressed={tag.color === color}
              onClick={() => elegir(color)}
              className={[
                'rounded-full transition-transform',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                tag.color === color ? 'scale-110 ring-2 ring-t1' : 'hover:scale-110',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={['block rounded-full', TAG_COLOR_CLASS[color].pastilla].join(' ')}
                style={{ width: MUESTRA, height: MUESTRA }}
              />
            </button>
          ))}

          <button
            type="button"
            onClick={() => elegir('')}
            className={[
              'col-span-5 mt-1 flex items-center gap-2 rounded-md border-t border-line px-1 pt-2',
              'text-[11px] transition-colors',
              elegida ? 'text-t3 hover:text-t1' : 'text-t4',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className={[
                'block shrink-0 rounded-full ring-1 ring-borde',
                TAG_COLOR_CLASS[actual].punto,
              ].join(' ')}
              style={{ width: 10, height: 10 }}
            />
            {t('tags.color.none')}
          </button>
        </div>
      </Popover>
    </>
  );
}
