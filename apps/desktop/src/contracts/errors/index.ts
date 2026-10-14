/**
 * Los errores del dominio, con nombre.
 *
 * Un `throw new Error('texto')` no se puede distinguir de otro: quien lo
 * atrapa no puede reaccionar de otra forma que enseñarlo. Un error con nombre
 * es una condicion prevista que se puede tratar aparte —«ya existe» no es lo
 * mismo que «fallo al guardar»— y por eso tienen clase propia y no son un
 * `Error` con el texto cambiado.
 *
 * Van en `contracts` y no junto al servicio que los lanza porque hay quien los
 * necesita desde una capa mas baja: `use-tags.helper` esta en `helpers/`, que
 * solo puede mirar `contracts`, y es el hook el que decide que aviso sale.
 */
export * from './tag-error';