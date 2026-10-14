import { useT } from '@/context/locale.context';

import { ColorPanel } from './color-panel.component';

export interface ITagColorPickerProps {
  /** La etiqueta a la que pertenece el color. */
  tag: { nombre: string; color: string };
  onChange: (color: string) => void;
}

/**
 * El color de una etiqueta.
 *
 * Es el boton de disco y nada mas: el panel, el «sin color» y los campos van en
 * `ColorPanel`, que es el mismo control para cualquier cosa que lleve color. La
 * etiqueta solo necesita decir «este es mi boton» y «este es el color que
 * tengo ahora».
 *
 * ## El boton es el disco del color actual
 *
 * No un boton con la palabra «color» al lado: cabe el color entero en el hueco
 * que ya ocupa el nombre, y no hace falta un control mas en una fila que ya
 * tiene el recuento y dos botones.
 *
 * Sin color, el disco **no se inventa uno**: sale un circulo de contorno. Un
 * disco del color del tema —«el color por defecto», que ya no existe— seria
 * mentir sobre lo que hay, y un boton gris sin explicacion no dice si la
 * etiqueta no tiene color o si el boton esta apagado.
 *
 * ## Sin aspa al lado
 *
 * Quitar el color se hace **dentro** del panel, en su fila de abajo, y no con
 * una aspa pegada al disco. Con la aspa, «quitar el color» y «quitar la
 * etiqueta» se parecian mucho: los dos son una cruz en circulo y los dos
 * desaparecen. Uno deja de pintar la etiqueta y el otro se la quita de la
 * clave, que es algo bastante mas serio.
 */
export function TagColorPicker({ tag, onChange }: ITagColorPickerProps) {
  const { t } = useT();

  return (
    <ColorPanel
      value={tag.color}
      onChange={onChange}
      trigger={{
        'aria-label': t('tags.color.label'),
        title: t('tags.color.label'),
      }}
    />
  );
}