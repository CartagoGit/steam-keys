import { useEffect, useRef, useState } from 'react';

import { Icon } from './icon.component';
import { APP_LOCALE_VALUES, AppLocale, LOCALE_FLAG_SIZE, LOCALE_META } from '@/contracts';

export interface ILocaleSelectProps {
  /** Idioma que esta puesto ahora mismo. */
  value: AppLocale;
  onChange: (value: AppLocale) => void;
  /** Texto accesible del boton, para lectores de pantalla. */
  label: string;
}

/**
 * Selector de idioma con bandera.
 *
 * No es un `<select>` de los nativos, y es a proposito. Un `<option>` solo
 * admite texto: meter un `<img>` dentro se ignora en Chrome, en Firefox y
 * Electron, y en el mejor de los casos sale un icono roto. La unica forma de
 * poner una bandera delante del nombre es hacer la lista a mano.
 *
 * Se hace con un boton y un desplegable, con los mismos roles que un select
 * nativo (`listbox`/`option`, navegacion con flechas y con Inicio/Fin) para
 * que se pueda usar igual con el teclado y un lector de pantalla lo anuncie
 * como lo que es.
 *
 * Los nombres van en su idioma y con sus tildes, porque quien busca "Francais"
 * en la lista quiere ver exactamente lo que busca. Las banderas son SVG y no
 * emojis a proposito: los emojis no se renderizan en Windows.
 */
export function LocaleSelect({ value, onChange, label }: ILocaleSelectProps) {
  const [abierto, setAbierto] = useState(false);
  const [resaltada, setResaltada] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const opciones = useRef<(HTMLButtonElement | null)[]>([]);

  const actual = LOCALE_META[value];

  // Al abrir, el teclado arranca sobre la opcion que esta puesta, no sobre la
  // primera: si se esta corrigiendo algo, casi siempre es para volver a lo
  // mismo, y dejarlo puesto ahorra un tabulador.
  useEffect(() => {
    if (!abierto) return;

    setResaltada(Math.max(0, APP_LOCALE_VALUES.indexOf(value)));

    const fuera = (evento: MouseEvent): void => {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    };

    document.addEventListener('mousedown', fuera);

    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto, value]);

  // Mantiene la resaltada a la vista al navegar con el teclado.
  useEffect(() => {
    if (!abierto) return;

    opciones.current[resaltada]?.scrollIntoView({ block: 'nearest' });
  }, [abierto, resaltada]);

  const elegir = (locale: AppLocale): void => {
    setAbierto(false);
    if (locale !== value) onChange(locale);
  };

  const alTeclado = (evento: React.KeyboardEvent): void => {
    const ultimo = APP_LOCALE_VALUES.length - 1;

    switch (evento.key) {
      case 'Escape':
        setAbierto(false);
        break;
      case 'ArrowDown':
        evento.preventDefault();
        setAbierto(true);
        setResaltada((i) => Math.min(ultimo, i + 1));
        break;
      case 'ArrowUp':
        evento.preventDefault();
        setAbierto(true);
        setResaltada((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        evento.preventDefault();
        setResaltada(0);
        break;
      case 'End':
        evento.preventDefault();
        setResaltada(ultimo);
        break;
      case 'Enter':
      case ' ':
        evento.preventDefault();
        if (abierto) {
          const elegida = APP_LOCALE_VALUES[resaltada];

          if (elegida !== undefined) elegir(elegida);
        } else {
          setAbierto(true);
        }
        break;
    }
  };

  return (
    <div ref={contenedor} className="relative" onKeyDown={alTeclado}>
      <button
        type="button"
        onClick={() => setAbierto((abierto) => !abierto)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-left text-sm
          text-t1 ring-1 ring-line transition hover:bg-surface-3 focus:ring-2 focus:ring-accent
          focus:outline-none"
      >
        <span
          aria-hidden="true"
          className="shrink-0 overflow-hidden rounded-[3px] ring-1 ring-line-strong"
          style={{ width: LOCALE_FLAG_SIZE, height: (LOCALE_FLAG_SIZE * 2) / 3 }}
        >
          <img
            src={actual?.flag}
            alt=""
            width={LOCALE_FLAG_SIZE}
            height={(LOCALE_FLAG_SIZE * 2) / 3}
            className="h-full w-full object-cover"
          />
        </span>

        <span className="flex-1 truncate">{actual?.label ?? value}</span>

        <Icon
          name="chevron-down"
          size={14}
          className={['shrink-0 text-t3 transition-transform', abierto ? 'rotate-180' : ''].join(' ')}
        />
      </button>

      {abierto && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg bg-surface-1
            p-1 shadow-lg shadow-black/30 ring-1 ring-line-strong"
        >
          {APP_LOCALE_VALUES.map((locale, indice) => {
            const meta = LOCALE_META[locale];
            const puesto = locale === value;

            return (
              <li key={locale}>
                <button
                  ref={(nodo) => {
                    opciones.current[indice] = nodo;
                  }}
                  type="button"
                  role="option"
                  aria-selected={puesto}
                  // `tabIndex={-1}` porque la lista se recorre con las flechas,
                  // no tabulando opcion por opcion: con el tabulador normal
                  // habria que pasar por cinco idiomas para llegar al siguiente
                  // campo.
                  tabIndex={-1}
                  onMouseEnter={() => setResaltada(indice)}
                  onClick={() => elegir(locale)}
                  className={[
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
                    indice === resaltada ? 'bg-surface-3 text-t1' : 'text-t2',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className="shrink-0 overflow-hidden rounded-[3px] ring-1 ring-line-strong"
                    style={{ width: LOCALE_FLAG_SIZE, height: (LOCALE_FLAG_SIZE * 2) / 3 }}
                  >
                    <img
                      src={meta?.flag}
                      alt=""
                      width={LOCALE_FLAG_SIZE}
                      height={(LOCALE_FLAG_SIZE * 2) / 3}
                      className="h-full w-full object-cover"
                    />
                  </span>

                  <span className="flex-1 truncate">{meta?.label ?? locale}</span>

                  {puesto && <Icon name="check" size={14} className="shrink-0 text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}