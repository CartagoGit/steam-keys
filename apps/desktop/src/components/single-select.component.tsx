import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Icon } from './icon.component';
import { Popover, PopoverOption } from './popover.component';
import { CAMPO_CLASS } from './ui.component';

/** Una opcion de un desplegable de una sola eleccion. */
export interface ISelectOption<T extends string> {
  value: T;
  /** Texto ya traducido, listo para pintar. */
  label: string;
  /**
   * Lo que va delante del texto: un icono, una bandera, un distintivo.
   *
   * Es un **nodo** y no un nombre de icono a proposito. Cada selector enseña
   * algo distinto delante —una bandera, un icono dentro de su color, nada— y
   * con un `icon?: IconName` habria que inventar un tipo de icono capaz de
   * pintar tres cosas distintas, que es como se acaba con un
   * `if (opcion.icon === 'bandera')`. Ademas, el nodo se pinta igual en el
   * boton y en la lista, y es exactamente lo que tienen que ser: si el boton
   * enseña otra cosa que la fila que tiene puesta, no se sabe cual es la elegida.
   */
  icono?: ReactNode;
  /** Texto del tooltip, si es distinto de lo que ya se ve. */
  title?: string;
}

export interface ISingleSelectProps<T extends string> {
  options: readonly ISelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nombre accesible del control. */
  label: string;
  /**
   * Lo que se ve delante del valor puesto, a la izquierda del separador.
   *
   * Es lo unico que se parece a una etiqueta y no lo es: el texto de la
   * cabecera —«Ordenar por»— que dice **de que** es el desplegable, porque ahi
   * no hay sitio para un titulo encima sin estirar la barra. En los selectores
   * de un dialogo el nombre ya lo pone el `Field` que lo envuelve, y por eso
   * no llevan prefijo.
   */
  prefijo?: string;
  /** Clase del boton para lo que cambia: el ancho. */
  className?: string;
}

/**
 * Desplegable de **una sola eleccion**. Es el patron de la app.
 *
 * Vive aqui porque son cuatro selectores que hacen exactamente lo mismo —abrir
 * una lista, elegir una, cerrar— y cada uno traia su copia. No se les ve la
 * diferencia en el comportamiento: la lista sale por un portal, el teclado la
 * recorre con las flechas, la elegida lleva un check y la flecha gira al
 * abrir. Lo unico que cambia entre ellos es lo que va delante del texto.
 *
 * Eso es justo lo que se veia. El selector de idioma tenia `ring-1 ring-line`
 * y el de plataforma `border border-borde`: el mismo control con el borde
 * dibujado de dos maneras, y en la misma pantalla se leian como dos families.
 * El de orden, ademas, era un `<select>` nativo: sin transicion, con la lista
 * del sistema operativo y con el dibujado del sistema operativo encima.
 *
 * Un `<select>` nativo no admite nada dentro de un `<option>` —una bandera o un
 * icono se ignoran— y su lista es la del sistema, que en Windows sale con otro
 * tamano, otro scroll y otra tipografia. Si el menu tiene que verse como el
 * resto, tiene que ser nuestro.
 *
 * La unica diferencia entre los cuatro es `icono`, y por eso va en la opcion y
 * no en una prop del componente: el boton enseña el de la elegida y cada fila
 * el suyo, y las dos cosas salen del mismo sitio sin que haya que acordarse.
 */
export function SingleSelect<T extends string>({
  options,
  value,
  onChange,
  label,
  prefijo,
  className = '',
}: ISingleSelectProps<T>) {
  const [abierto, setAbierto] = useState(false);
  const [resaltada, setResaltada] = useState(0);
  const boton = useRef<HTMLButtonElement>(null);

  const indicePuesta = options.findIndex((option) => option.value === value);
  const elegida = options[indicePuesta] ?? options[0];

  /**
   * Al abrir, el teclado arranca sobre la opcion que esta puesta, no sobre la
   * primera: si se esta corrigiendo algo, casi siempre es para volver a lo
   * mismo, y dejarlo puesto ahorra un tabulador.
   */
  useEffect(() => {
    if (!abierto) return;

    setResaltada(Math.max(0, indicePuesta));
  }, [abierto, indicePuesta]);

  const elegir = (opcion: T): void => {
    setAbierto(false);
    if (opcion !== value) onChange(opcion);
  };

  /**
   * El teclado va **ahi** y no en el panel.
   *
   * El panel se monta en `document.body` por un portal, asi que un
   * `onKeyDown` suyo solo veria las teclas que se pulsan con el raton encima,
   * que es justo cuando no se navega. En el boton ve todo, y el arbol de
   * eventos de React sigue siendo el normal a traves del portal.
   */
  const alTeclado = (evento: React.KeyboardEvent): void => {
    const ultimo = options.length - 1;

    switch (evento.key) {
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
          const highlighted = options[resaltada];

          if (highlighted !== undefined) elegir(highlighted.value);
        } else {
          setAbierto(true);
        }
        break;
      // `Escape` no esta aqui a proposito: lo lleva `Popover`, que sabe
      // cuando hay algo abierto encima y por tanto cuando tiene sentido
      // subir un nivel en vez de cerrarlo todo.
    }
  };

  return (
    <div className={className} onKeyDown={alTeclado}>
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((abierto) => !abierto)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={`${CAMPO_CLASS} flex items-center gap-2 text-left`}
      >
        {elegida?.icono}

        {prefijo ? (
          <>
            <span className="shrink-0 text-t4">{prefijo}</span>

            {/*
              El separador va con el texto, no como un borde del boton: el
              control entero es una sola pieza y dibujarle una linea vertical
              lo parte en dos cosas que no lo son.
            */}
            <span aria-hidden="true" className="h-4 w-px shrink-0 bg-line-strong" />
          </>
        ) : null}

        <span className="flex-1 truncate">{elegida?.label ?? value}</span>

        <Icon
          name="chevron-down"
          size={14}
          className={[
            /*
             * Sin `shrink-0`: `Icon` ya lo pone en todos sus iconos, y
             * duplicarlo deja el atributo con la palabra dos veces.
             */
            'text-t3 transition-transform duration-150',
            abierto ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      <Popover
        abierto={abierto}
        ancla={boton}
        onCerrar={() => setAbierto(false)}
        resaltada={resaltada}
        aria-label={label}
      >
        {options.map((option, indice) => (
          <PopoverOption
            key={option.value}
            activa={option.value === value}
            resaltada={indice === resaltada}
            alPulsar={() => elegir(option.value)}
            alEntrar={() => setResaltada(indice)}
            title={option.title}
            derecha={
              option.value === value ? (
                <Icon name="check" size={14} className="shrink-0 text-accent" />
              ) : null
            }
          >
            {option.icono}

            <span className="flex-1 truncate">{option.label}</span>
          </PopoverOption>
        ))}
      </Popover>
    </div>
  );
}