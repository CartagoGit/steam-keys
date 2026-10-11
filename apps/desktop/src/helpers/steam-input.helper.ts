/**
 * Limpieza de lo que se teclea en los ajustes de la cuenta de Steam.
 *
 * Las dos cosas de aqui se copian de otras paginas, y ahi se copian con el
 * sitio entero seleccionado. Eso deja espacios delante y detras, y a veces un
 * salto de linea al final cuando se pega desde un archivo de texto.
 */

/**
 * Limpia una clave de API.
 *
 * Se quitan **todos** los espacios, no solo los del principio y del final. Una
 * clave de la API de Steam son 32 caracteres hexadecimales y ningun otro: si
 * hay un espacio en medio, no es parte de la clave, es un error de pegado, y
 * dejarlo ahi solo produce un fallo de autenticacion mas adelante sin decir por
 * que. Quitarlo al escribir evita tener que entender el error luego.
 */
export function normalizarClaveApi(valor: string): string {
  return valor.replace(/\s+/g, '');
}

/**
 * Limpia un ID o un nombre de perfil de Steam.
 *
 * Aqui solo se quitan los espacios de los extremos. En medio no se tocan,
 * porque el nombre de perfil si admite guion y punto, y puede llevar un espacio
 * si alguien se lo invento: quitarlo convertiria un nombre valido en otro que
 * no existe.
 *
 * Un espacio en medio si es un error de pegado, y por eso se avisa en vez de
 * arreglarlo en silencio: el campo queda resaltado como invalido y se ve cual
 * es el trozo que sobra. Arreglarlo por las bravas convertiria un error
 * visible en uno invisible.
 */
export function normalizarIdSteam(valor: string): string {
  return valor.trim();
}