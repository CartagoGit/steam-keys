/**
 * Resuelve la ruta de la base de datos exactamente igual que lo hace Tauri.
 *
 * La app usa `app_config_dir()` de Tauri; estos scripts tienen que escribir en
 * el mismo fichero, asi que se replica aqui el algoritmo de `dirs` para cada
 * sistema. Si Tauri cambiara de criterio habria que tocar solo este fichero.
 *
 *   Windows: %APPDATA%\<identifier>
 *   macOS:   ~/Library/Application Support/<identifier>
 *   Linux:   $XDG_CONFIG_HOME/<identifier>  (o ~/.config/<identifier>)
 */
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export const APP_IDENTIFIER = 'com.cartagostudios.steamkeys';
export const DB_FILE_NAME = 'steam-keys.db';

/** Directorio de configuracion de la app. */
export function appConfigDir(): string {
  const system = platform();

  if (system === 'win32') {
    const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    return join(appData, APP_IDENTIFIER);
  }

  if (system === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', APP_IDENTIFIER);
  }

  const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(xdg, APP_IDENTIFIER);
}

/** Ruta completa del fichero SQLite. */
export function databasePath(): string {
  return join(appConfigDir(), DB_FILE_NAME);
}