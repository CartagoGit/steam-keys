/**
 * Como se ve un aviso: el tono decide icono y color.
 *
 * Vive en `contracts` y no en el componente que lo pinta porque **hay dos**
 * cosas que necesitan el tipo: la pila que lo dibuja y el hook que lo crea.
 * Mientras solo lo necesitaba el componente, estar ahi era correcto; en cuanto
 * el estado sale a `useToasts`, el hook tendria que importar de un
 * componente —y `helpers` no puede, porque la capa de abajo no conoce la de
 * arriba—. Es el mismo motivo por el que `backup.interface.ts` existe.
 */
export type ToastTone = 'info' | 'success' | 'error';

/** Un aviso en pantalla, con el id que lo identifica mientras esta vivo. */
export interface IToast {
  /**
   * Unico entre los avisos que hay a la vez.
   *
   * Sale de un contador y no de `Date.now()` porque dos avisos en el mismo
   * milisegundo —que pasa al importar una lista grande— darian el mismo id con
   * la hora, y al borrarse el uno se llevaria por delante al otro.
   */
  id: number;
  message: string;
  tone: ToastTone;
}