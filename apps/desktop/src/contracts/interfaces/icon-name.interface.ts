/**
 * Nombres de los iconos disponibles en el set embebido.
 *
 * Vive en `contracts` y no en el componente porque tanto las constantes de
 * plataforma y estado como la UI necesitan tiparlo; de este modo los
 * contratos siguen siendo la capa inferior y no dependen de React.
 */
export type IconName =
  | 'gamepad'
  | 'key'
  | 'gift'
  | 'hand'
  | 'shield'
  | 'check'
  | 'alert'
  | 'help'
  | 'search'
  | 'plus'
  | 'trash'
  | 'pencil'
  | 'eye'
  | 'eye-off'
  | 'copy'
  | 'x'
  | 'check-circle'
  | 'upload'
  | 'download'
  | 'filter'
  | 'chevron-down'
  | 'package'
  | 'calendar'
  | 'tag'
  | 'refresh'
  | 'external'
  | 'info';