import { TAG_COLOR_CLASS, type TagColor } from '@/contracts';
import { colorDe } from '@/helpers/tags.helper';

export interface ITagChipProps {
  /** La etiqueta. Sin color elegido, el nombre decide el tono. */
  tag: { nombre: string; color: TagColor | '' };
  /** `true` si la etiqueta esta puesta en la clave o marcada en un filtro. */
  marcada?: boolean;
  className?: string;
}

/**
 * Una etiqueta, pintada.
 *
 * Vive en su propio componente porque la etiqueta sale en varios sitios —la
 * fila de la clave, la ficha y el catalogo de Ajustes— y en cada uno se habia
 * escrito el `<span>` con sus clases. Con el color ha pasado de ser un detalle
 * a ser parte de lo que hay que acertar: con dos copias, la misma palabra puede
 * verse de dos maneras segun donde se mire.
 *
 * El color lo decide `colorDe`, aqui y en ningun otro sitio, de modo que una
 * etiqueta sin color elegido sale siempre de la misma deduccion por su nombre y
 * nunca de la cuenta que haga cada pantalla.
 *
 * `marcada` no cambia el color, solo el relieve. El color dice **de que grupo**
 * es la etiqueta y el estado dice si esta puesta; si marcadas y sin marcar
 * tuvieran cada una la suya, el filtro necesitaria una paleta aparte y el mismo
 * grupo de color diria dos cosas distintas.
 */
export function TagChip({ tag, marcada = false, className = '' }: ITagChipProps) {
  const clases = TAG_COLOR_CLASS[colorDe(tag)];

  return (
    <span
      className={[
        'inline-flex max-w-full items-center rounded-full px-2 py-0.5',
        'text-[11px] leading-tight',
        // El anillo lo pone el tono y no `ring-current`: el texto de una
        // pastilla diluida es el tono fuerte y el de una entera es el color de
        // encima, asi que `current` pondria un aro mas claro en un caso y mas
        // oscuro en otro.
        marcada ? `ring-1 ${clases.aro}` : '',
        clases.pastilla,
        className,
      ]
        .filter((parte) => parte.length > 0)
        .join(' ')}
    >
      <span className="truncate">{tag.nombre}</span>
    </span>
  );
}
