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
  /** Guion: "esto no cambia". */
  | 'minus'
  /** Capas apiladas: lo que se aplica a varias filas a la vez. */
  | 'layers'
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
  | 'settings'
  | 'globe'
  | 'palette'
  | 'refresh'
  | 'external'
  | 'info';