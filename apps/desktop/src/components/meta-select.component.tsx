import { useRef, useState } from 'react';

import { Icon } from './icon.component';
import { Popover, PopoverOption } from './popover.component';
import { INPUT_CLASS } from './ui.component';
import type { IMetaOption } from '@/contracts';

export interface IMetaSelectProps {
  options: readonly IMetaOption[];
  value: string;
  onChange: (value: string) => void;
  /** Nombre accesible del grupo. */
  label: string;
  className?: string;
}

/**
 * Desplegable con el color y el icono de cada opcion.
 *
 * Sustituye a un `<select>` nativo, que solo admite texto: ni un icono ni un
 * fondo por opcion, que es justo lo que hace falta para distinguir «regalada»
 * de «canjeada» de un vistazo. La pastilla que sale en la tabla de cada fila ya
 * usa el color y el icono de los mismos metadatos, y con esto el editor dice lo
 * mismo que la tabla —que es lo esperable: se elige un estado para ver como
 * queda ese estado.
 *
 * Se apoya en `Popover`, que dibuja la lista fuera del dialogo. Sin eso, el
 * desplegable del editor —que vive en un panel con `overflow-hidden`— se
 * cortaba por el borde y, al abrirse, el dialogo entero daba un bote.
 *
 * El `tone` llega como clases completas desde el dominio, no como un nombre de
 * color. Es a proposito: los tonos son semanticos (`bg-ok`, `text-warn`) y cada
 * tema declara los suyos en `styles/index.css`. Si aqui se tradujera un
 * `'ok'` a clases, el dropdown tendria su propia tabla de colores, distinta de
 * la de la pastilla, y volveria a haber dos fuentes de verdad.
 */
export function MetaSelect({
  options,
  value,
  onChange,
  label,
  className = '',
}: IMetaSelectProps) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  const elegida = options.find((option) => option.value === value) ?? options[0];

  const elegir = (valor: string): void => {
    setAbierto(false);
    if (valor !== value) onChange(valor);
  };

  return (
    <div className={className}>
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((abierto) => !abierto)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={`${INPUT_CLASS} flex items-center gap-2 text-left`}
      >
        {elegida?.icon ? (
          <span
            className={[
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1',
              elegida.tone ?? '',
            ].join(' ')}
          >
            <Icon name={elegida.icon} size={12} />
          </span>
        ) : null}

        <span className="flex-1 truncate">{elegida?.label ?? value}</span>

        <Icon
          name="chevron-down"
          size={14}
          className={['shrink-0 text-t3 transition-transform', abierto ? 'rotate-180' : ''].join(' ')}
        />
      </button>

      <Popover abierto={abierto} ancla={boton} onCerrar={() => setAbierto(false)}>
        {options.map((option) => {
          const activa = option.value === value;

          return (
            <PopoverOption
              key={option.value}
              activa={activa}
              resaltada={false}
              alPulsar={() => elegir(option.value)}
              derecha={
                activa ? <Icon name="check" size={14} className="shrink-0 text-accent" /> : null
              }
            >
              {option.icon ? (
                <span
                  className={[
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1',
                    option.tone ?? '',
                  ].join(' ')}
                >
                  <Icon name={option.icon} size={12} />
                </span>
              ) : (
                <span className="w-5 shrink-0" />
              )}

              <span className="flex-1 truncate">{option.label}</span>
            </PopoverOption>
          );
        })}
      </Popover>
    </div>
  );
}
