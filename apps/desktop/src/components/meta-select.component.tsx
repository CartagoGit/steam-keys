import type { ReactNode } from 'react';

import { Icon } from './icon.component';
import { SingleSelect, type ISelectOption } from './single-select.component';
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
 * El icono dentro de su color.
 *
 * Es el mismo dato que pinta la pastilla de cada fila de la tabla, y por eso
 * sale del mismo sitio: se elige un estado en el editor para ver como queda ese
 * estado, y si los dos usaran tablas de color distintas el editor estiria
 * colores que la tabla nunca enseña.
 *
 * El `tone` llega como clases completas desde el dominio y no como un nombre
 * de color. Los tonos son semanticos (`bg-ok`, `text-warn`) y cada tema declara
 * los suyos en `styles/index.css`; si aqui se tradujera un `'ok'` a clases,
 * este desplegable tendria su propia tabla, distinta de la de la pastilla, y
 * volveria a haber dos fuentes de verdad.
 */
function Distintivo({ icon, tone }: { icon: string; tone?: string }): ReactNode {
  return (
    <span
      className={[
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1',
        tone ?? '',
      ].join(' ')}
    >
      <Icon name={icon as never} size={12} />
    </span>
  );
}

/**
 * Desplegable con el color y el icono de cada opcion.
 *
 * Sustituye a un `<select>` nativo, que solo admite texto: ni un icono ni un
 * fondo por opcion, que es justo lo que hace falta para distinguir
 * «regalada» de «canjeada» de un vistazo.
 *
 * No aporta comportamiento: la lista, el teclado y el boton son los de
 * `SingleSelect`. Aqui solo queda lo que es de este —el distintivo de color— y
 * la traduccion de `IMetaOption` a la opcion que el selector compartido
 * entiende.
 */
export function MetaSelect({
  options,
  value,
  onChange,
  label,
  className = '',
}: IMetaSelectProps) {
  /**
   * Se construye cada render, y no con `useMemo`.
   *
   * Las opciones vienen ya traducidas del dominio y no hay nada caro que
   * memorizar: `<Distintivo>` son cuatro elementos. Envolverlo en un `useMemo`
   * con `options` en las dependencias solo anade una cosa que puede quedar
   * desfasada —las traducciones cambian con el idioma y la lista de opciones no
   * cambia nunca—.
   */
  const opciones: readonly ISelectOption<string>[] = options.map((option) => ({
    value: option.value,
    label: option.label,
    /*
     * Sin icono no se pinta nada, **ni siquiera un hueco**. Antes se ponia un
     * `<span className="w-5">` de relleno para que las filas no se movieran al
     * pasar el raton por encima, y lo que hacia era dejar un hueco vacio en
     * todas las que no tienen icono. Si la lista mezcla —que es justo lo que
     * pasa con las plataformas, que algunas tienen y otras no— el hueco alinea
     * los textos; si ninguna tiene, el hueco solo estorba.
     */
    icono: option.icon ? <Distintivo icon={option.icon} tone={option.tone} /> : undefined,
  }));

  return (
    <SingleSelect
      options={opciones}
      value={value}
      onChange={onChange}
      label={label}
      className={className}
    />
  );
}
