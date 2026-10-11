/**
 * Que tabla se esta viendo: las claves que tengo o los juegos de Steam.
 */
export enum AppView {
  /** La coleccion de claves. */
  Keys = 'keys',
  /** Los juegos de la cuenta de Steam. */
  Games = 'games',
}

export const APP_VIEW_VALUES: readonly AppView[] = Object.freeze([
  AppView.Keys,
  AppView.Games,
]);

export const DEFAULT_VIEW: AppView = AppView.Keys;