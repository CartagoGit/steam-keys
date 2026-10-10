/**
 * Temas visuales de la aplicacion.
 *
 * Solo hay dos de verdad porque la app es oscura por naturaleza: cambiar el
 * tema no es un lujo, es evitar que a las dos de la mañana una pantalla blanca
 * te deje ciego. El valor `system` delega en la preferencia del sistema
 * operativo.
 */
export enum AppTheme {
  /** Sigue al sistema operativo. */
  System = 'system',
  /** Fondo oscuro, el de siempre. */
  Dark = 'dark',
  /** Fondo claro, para pantallas muy brillantes o sensibilidad alta. */
  Light = 'light',
}

export const APP_THEME_VALUES: readonly AppTheme[] = Object.freeze([
  AppTheme.System,
  AppTheme.Dark,
  AppTheme.Light,
]);