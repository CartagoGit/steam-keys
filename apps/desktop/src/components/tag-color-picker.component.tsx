import { useRef, useState } from 'react';

import {
  TAG_FAMILIAS,
  TAG_PASOS,
  TAG_TONOS,
  type TagFamilia,
  type TranslationKey,
} from '@/contracts';
import { useT } from '@/context/locale.context';
import { necesitaAro, textoSobre } from '@/helpers/contraste.helper';

import { Popover } from './popover.component';

export interface ITagColorPickerProps {
  /** La etiqueta a la que pertenece el color. */
  tag: { nombre: string; color: string };
  onChange: (color: string) => void;
}

/** Lado del disco del boton. */
const DISCO = 16;

/** Lado de una muestra de la paleta. */
const MUESTRA = 26;

/** Separacion entre muestras, para que el panel se pueda calcular entero. */
const HUECO = 6;

/** Padding del panel, por lado. */
const RELLENO = 8;

/** Alto de la fila de «Sin color». */
const PIE = 30;

/**
 * El nombre de cada familia y de cada paso, **escritos**.
 *
 * Van en una tabla y no montados con `` `tags.color.${familia}` `` por dos
 * razones. Una es que el guard de claves muertas busca el literal, y construida
 * no la encontraria: daria por buenas diez pistas que nadie ve. La otra es que
 * `TranslationKey` es `string` —cualquier cadena— y no un tipo cerrado, asi que
 * una clave construida se cuela sin que nadie la compruebe; la tabla obliga a
 * que el compilador diga si falta una.
 *
 * El nombre de la familia lleva ademas el color, que es lo que hay que poder
 * elegir sin ver.
 */
const CLAVE_FAMILIA: Readonly<Record<TagFamilia, TranslationKey>> = Object.freeze({
  red: 'tags.color.red',
  orange: 'tags.color.orange',
  amber: 'tags.color.amber',
  green: 'tags.color.green',
  sky: 'tags.color.sky',
  violet: 'tags.color.violet',
});

/** Y el nombre de cada tono de claridad. */
const CLAVE_PASO: Readonly<Record<1 | 2 | 3, TranslationKey>> = Object.freeze({
  1: 'tags.color.step1',
  2: 'tags.color.step2',
  3: 'tags.color.step3',
});

/**
 * El panel de color de una etiqueta.
 *
 * El boton es el **disco del color actual**, no un boton con la palabra «color»
 * al lado: cabe el color entero en el hueco que ya ocupa el nombre, no hace
 * falta un control mas en una fila que ya tiene el recuento y dos botones.
 *
 * La paleta son **seis columnas por tres filas**: una por familia de color —rojo,
 * naranja, ambar, verde, azul, violeta— y una fila por tono de cada una, de la
 * mas clara a la mas oscura. Es al reves de como se suele presentar —una fila
 * por tono, un punto por color— porque asi se lee «quiero el rojo» como se
 * elige de verdad: primero la familia, despues la claridad. Y tres filas caben
 * sin barra de desplazamiento, que es lo que se pide.
 *
 * Abajo va «Sin color», que **no** es dejar de pintar la etiqueta: es quitarle
 * el color y que salga como texto. Sin esa fila no habria manera de deshacer la
 * eleccion.
 *
 * El texto que lleva cada muestra es el que la propia muestra lleva encima, y
 * sale de `textoSobre`. No es una decision de la paleta —«los colores claros con
 * letra oscura»— sino una medida: los dos textos se ponen en el `hex` que se ha
 * elegido y gana el que saca mas contraste. Asi un color puesto a mano de
 * cualquier sitio —una base editada— tambien se lee.
 */
export function TagColorPicker({ tag, onChange }: ITagColorPickerProps) {
  const { t } = useT();
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  const elegida = tag.color !== '';

  const elegir = (color: string): void => {
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
        {elegida ? (
          <span
            aria-hidden="true"
            className="block rounded-full ring-1 ring-borde"
            style={{ backgroundColor: tag.color, width: DISCO, height: DISCO }}
          />
        ) : (
          /*
           * Sin color, el boton no se inventa uno: sale un circulo de contorno.
           * Un disco del color del tema —«el color por defecto», que ya no
           * existe— seria mentir sobre lo que hay, y un boton gris sin
           * explicación no dice si la etiqueta no tiene color o si el boton esta
           * apagado.
           */
          <span
            aria-hidden="true"
            className="block rounded-full border border-dashed border-line-strong"
            style={{ width: DISCO, height: DISCO }}
          />
        )}
      </button>

      <Popover
        abierto={abierto}
        ancla={boton}
        onCerrar={() => setAbierto(false)}
        lado="derecha"
        // No es una lista: son dieciocho botones y un pie. Declararlo `listbox`
        // haria que un lector de pantalla anunciase «lista de dieciocho
        // elementos» y luego se encontrase con un boton mas.
        esLista={false}
        ancho={TAG_FAMILIAS.length * MUESTRA + (TAG_FAMILIAS.length - 1) * HUECO + RELLENO * 2}
        altoMaximo={TAG_PASOS.length * MUESTRA + (TAG_PASOS.length - 1) * HUECO + PIE + RELLENO * 2}
        className="p-2"
        aria-label={t('tags.color.label')}
      >
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${TAG_FAMILIAS.length}, ${MUESTRA}px)` }}
        >
          {TAG_FAMILIAS.flatMap((familia: TagFamilia) =>
            TAG_PASOS.map((paso) => {
              const tono = TAG_TONOS.find(
                (t) => t.familia === familia && t.paso === paso,
              );

              if (tono === undefined) return null;

              const marcada = tag.color === tono.hex;
              const texto = textoSobre(tono.hex);

              return (
                <button
                  key={tono.hex}
                  type="button"
                  // El nombre lleva **familia y claridad**, y el nombre de la
                  // familia va en el color: es lo que hay que poder elegir sin
                  // ver, y cinco filas de «color» no dicen nada.
                  aria-label={`${t(CLAVE_FAMILIA[familia])} · ${t(CLAVE_PASO[paso])}`}
                  aria-pressed={marcada}
                  onClick={() => elegir(tono.hex)}
                  style={{
                    backgroundColor: tono.hex,
                    color: texto,
                    boxShadow: necesitaAro(tono.hex)
                      ? `inset 0 0 0 1px ${texto}55`
                      : undefined,
                  }}
                  className={[
                    'rounded-full text-[10px] leading-none transition-transform',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    marcada ? 'scale-110 ring-2 ring-t1' : 'hover:scale-110',
                  ].join(' ')}
                >
                  {marcada ? (
                    <span aria-hidden="true">{t('tags.color.check')}</span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>

        <button
          type="button"
          onClick={() => elegir('')}
          className={[
            'mt-2 flex w-full items-center gap-2 rounded-md border-t border-line px-1 pt-2',
            'text-[11px] transition-colors',
            elegida ? 'text-t3 hover:text-t1' : 'text-t4',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className="block shrink-0 rounded-full border border-dashed border-line-strong"
            style={{ width: 10, height: 10 }}
          />
          {t('tags.color.none')}
        </button>
      </Popover>
    </>
  );
}
