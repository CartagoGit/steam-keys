/**
 * Cosas de rutas que se repiten en mas de un sitio.
 *
 * estan aqui y no en el servicio que las usa porque son puras y se prueban
 * solas: un fallo en una de estas se nota en la pantalla, y un test es mas
 * barato de escribir que acordarse de probarlo a mano.
 */

/**
 * Ultimo componente de una ruta.
 *
 * Acepta los dos separadores porque las rutas que llegan del backend pueden
 * venir de Windows aunque la app se esté viendo en otro sistema: `basename`
 * de Node solo parte por la barra del sistema, y `C:\Juegos\steam-keys.db`
 * volvería entero en vez de `steam-keys.db`.
 */
export function basename(ruta: string): string {
  // Se quitan los separadores de los dos tipos del final antes de partir. Sin
  // esto, `/home/cartago/juegos/` se parte en un ultimo trozo vacio y devuelve
  // la ruta entera, que es justo el caso que mas se da: la carpeta donde vive
  // el programa suele llevar barra al final.
  const limpia = ruta.replace(/[\\/]+$/, '');

  if (limpia === '') return ruta;

  const partes = limpia.split(/[\\/]/);
  const ultimo = partes[partes.length - 1];

  return ultimo !== undefined && ultimo !== '' ? ultimo : ruta;
}