/**
 * Temas visuales de la aplicacion.
 *
 * Cada tema es un juego de variables en `styles/index.css`. Aqui estan solo el
 * nombre y las muestras de color; los valores de verdad no se tocan al anadir
 * un tema, y un componente nunca menciona el tema: usa `text-t1`,
 * `bg-surface-1`, `text-ok`… y ya esta.
 *
 * El orden va de **mas oscuro a mas claro** porque asi es como se elige: primero
 * se busca uno que no lastime los ojos de noche, despues uno que se vea bien
 * con luz. Los cuatro ultimos son claros y `Contrast` es el que se usa cuando
 * la diferencia de gris no basta.
 *
 * `System` no es un tema: delega en la preferencia del sistema operativo.
 */
export enum AppTheme {
  /** Sigue al sistema operativo. */
  System = 'system',
  /** Fondo oscuro, el de siempre. */
  Dark = 'dark',
  /** Casi negro, para pantallas OLED. */
  Midnight = 'midnight',
  /** Verde profundo, para quien no quiere el azul. */
  Forest = 'forest',
  /** Azul frio, el clasico de los que programan. */
  Nord = 'nord',
  /** Negro y gris, con contraste reforzado. */
  Contrast = 'contrast',
  /** Claro, para pantallas muy brillantes. */
  Light = 'light',
  /** Claro y calido, para leer mucho rato. */
  Paper = 'paper',
  /** Claro rosado, suave pero sin ser blanco. */
  Berry = 'berry',
}

export const APP_THEME_VALUES: readonly AppTheme[] = Object.freeze([
  AppTheme.System,
  AppTheme.Dark,
  AppTheme.Midnight,
  AppTheme.Forest,
  AppTheme.Nord,
  AppTheme.Contrast,
  AppTheme.Light,
  AppTheme.Paper,
  AppTheme.Berry,
]);

/**
 * Colores de muestra para el selector: fondo, texto y acento.
 *
 * Se toman de las mismas variables del tema, no se inventan aqui. Si se
 * escribieran a mano, el selector ensenaria un color que el tema ya no tiene,
 * que es como se confunde a alguien al elegir.
 */
export const APP_THEME_SWATCHES: Readonly<Record<AppTheme, readonly string[]>> =
  Object.freeze({
    [AppTheme.System]: ['#0b0d12', '#7c8798', '#3b82f6'],
    [AppTheme.Dark]: ['#0b0d12', '#9aa4b4', '#3b82f6'],
    [AppTheme.Midnight]: ['#000000', '#9a9aa2', '#4f8ef7'],
    [AppTheme.Forest]: ['#0b1210', '#94b3a5', '#34a06b'],
    [AppTheme.Nord]: ['#2e3440', '#b0bacb', '#88c0d0'],
    [AppTheme.Contrast]: ['#000000', '#d4d4d4', '#5aa9ff'],
    [AppTheme.Light]: ['#f4f6fa', '#4d5866', '#2563eb'],
    [AppTheme.Paper]: ['#eae4d9', '#574c3f', '#a1622a'],
    [AppTheme.Berry]: ['#f6eef2', '#6b4356', '#be3455'],
  });