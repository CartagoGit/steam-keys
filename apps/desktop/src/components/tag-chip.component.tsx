import { necesitaAro, textoSobre } from '@/helpers/contraste.helper';

export interface ITagChipProps {
  /** La etiqueta. Sin color elegido, sale como texto y sin pastilla. */
  tag: { nombre: string; color: string };
  /** `true` si la etiqueta esta puesta en la clave o marcada en un filtro. */
  marcada?: boolean;
  className?: string;
}

/**
 * Una etiqueta, pintada.
 *
 * Vive en su propio componente porque la etiqueta sale en varios sitios —la
 * fila de la clave, la ficha y el catalogo de Ajustes— y en cada uno se habia
 * escrito el `<span>` con sus clases. Con el color ha pasado de ser un detalle a
 * ser parte de lo que hay que acertar: con dos copias, la misma palabra puede
 * verse de dos maneras segun donde se mire.
 *
 * **Sin color no hay pastilla.** Sale el texto tal cual, en la tinta de la
 * pagina. Es lo que se hizo siempre, y fue un acierto: dar un color a una
 * etiqueta que no lo tiene elegido dice algo que el usuario no ha dicho —que
 * pertenece a un grupo, que hay que cuidarla— y obliga a distinguir las que si
 * lo tienen de las que no. Un color deducido del nombre es peor: la misma
 * palabra salia con un color distinto en cada sitio segun quien la pintara.
 *
 * El color va en el `style` y no en una clase, y es la **unica** vez que en la
 * app se pinta un color que no viene del tema. No hay otra manera: el color lo
 * elige la persona y hay dieciocho, y una clase seria `bg-` mas un color fijo,
 * atado a un tema. Lo que si es del tema es el texto, y lo que va con el color es
 * solo el texto que se lee encima.
 */
export function TagChip({ tag, marcada = false, className = '' }: ITagChipProps) {
  const clases = [
    'inline-flex max-w-full items-center rounded-full px-2 py-0.5',
    'text-[11px] leading-tight',
    marcada ? 'ring-1' : '',
    className,
  ]
    .filter((parte) => parte.length > 0)
    .join(' ');

  if (tag.color === '') {
    return (
      <span
        className={[
          'inline-block max-w-full text-[11px] leading-tight text-t3',
          className,
        ]
          .filter((parte) => parte.length > 0)
          .join(' ')}
      >
        {/*
          `truncate` con `min-w-0` detras, y no solo `truncate`.
          *
          * `truncate` es `overflow: hidden` mas `white-space: nowrap`, pero en un
          * elemento flexible no recorta nada si el ancho minimo del contenido
          * —el de la palabra mas larga— no baja. Sin `min-w-0` la pastilla se
          * sale de su sitio y se monta sobre el boton de al lado, que es lo que
          * pasaba con los nombres largos en el catalogo de Ajustes.
          */}
        <span className="min-w-0 truncate">{tag.nombre}</span>
      </span>
    );
  }

  const texto = textoSobre(tag.color);

  return (
    <span
      style={{
        backgroundColor: tag.color,
        color: texto,
        // El aro solo cuando el color es claro: sobre un fondo casi blanco un
        // circulo del mismo color no tiene borde, y en el filtro —donde el
        // color es un disco de doce pixeles— se leia como una mancha suelta.
        boxShadow: necesitaAro(tag.color) ? `inset 0 0 0 1px ${texto}55` : undefined,
      }}
      className={clases}
    >
      <span className="min-w-0 truncate">{tag.nombre}</span>
    </span>
  );
}
