import { APP_LOCALE_VALUES, AppLocale, LOCALE_FLAG_SIZE, LOCALE_META } from '@/contracts';
import { SingleSelect, type ISelectOption } from './single-select.component';

export interface ILocaleSelectProps {
  /** Idioma que esta puesto ahora mismo. */
  value: AppLocale;
  onChange: (value: AppLocale) => void;
  /** Texto accesible del boton, para lectores de pantalla. */
  label: string;
}

/**
 * La bandera, tal como sale en el boton y en cada fila de la lista.
 *
 * Va en el `icono` de la opcion y no dentro del texto. Un `<option>` —y por
 * tanto un `<select>` nativo— solo admite texto: meter una bandera dentro se
 * ignora en Chrome, en Firefox y en Electron, y en el mejor de los casos sale
 * un icono roto. La unica forma de poner una bandera delante del nombre es
 * hacer la lista a mano.
 *
 * El SVG y no un emoji a proposito: los emojis no se renderizan en Windows, y
 * un selector de idioma con un cuadrado blanco al lado de cada nombre es peor
 * que uno sin bandera.
 */
function Bandera({ src }: { src: string }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 overflow-hidden rounded-[3px] ring-1 ring-line-strong"
      style={{ width: LOCALE_FLAG_SIZE, height: (LOCALE_FLAG_SIZE * 2) / 3 }}
    >
      <img
        src={src}
        alt=""
        width={LOCALE_FLAG_SIZE}
        height={(LOCALE_FLAG_SIZE * 2) / 3}
        className="h-full w-full object-cover"
      />
    </span>
  );
}

/**
 * Selector de idioma con bandera.
 *
 * No aporta comportamiento: abrir, navegar con las flechas, elegir con Intro y
 * cerrar con Escape es lo de `SingleSelect`, que lo hace igual para los cuatro
 * selectores de la app. Aqui queda solo lo que es de este: la bandera, y que
 * los nombres vayan en su idioma con sus tildes, porque quien busca
 * «Francais» quiere ver exactamente lo que busca.
 */
export function LocaleSelect({ value, onChange, label }: ILocaleSelectProps) {
  const opciones: readonly ISelectOption<AppLocale>[] = APP_LOCALE_VALUES.map(
    (locale) => ({
      value: locale,
      label: LOCALE_META[locale]?.label ?? locale,
      icono: <Bandera src={LOCALE_META[locale]?.flag ?? ''} />,
    }),
  );

  return (
    <SingleSelect
      options={opciones}
      value={value}
      onChange={onChange}
      label={label}
    />
  );
}
