/**
 * Resuelve la ruta de la base de datos exactamente igual que lo hace la app.
 *
 * La app guarda los datos **junto al ejecutable** (modo portable), y Rust decide
 * donde esta ese ejecutable. Estos scripts corren desde el repositorio, asi que
 * no pueden deducirlo: el ejecutable esta en `dist/`, que es donde lo dejan
 * los scripts de compilacion.
 *
 * De ahi `STEAM_KEYS_DATA_DIR`, que manda sobre todo. Se puede poner a mano
 * para trabajar sobre otra copia:
 *
 *   STEAM_KEYS_DATA_DIR=/mnt/usb/steam-keys bun run db:path
 *
 * Y si no esta puesto, se usa la carpeta de configuracion del sistema, que es
 * donde lived la base antes del modo portable y donde se queda si el
 * ejecutable se instala en un sitio sin permisos de escritura.
 */
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_IDENTIFIER = 'com.relaxingcup.steamkeys';
export const DB_FILE_NAME = 'steam-keys.db';

/**
 * Carpeta donde la app deja el ejecutable.
 *
 * Este fichero esta en `tools/scripts/support/`, asi que hay que subir tres
 * niveles hasta la raiz del repositorio y entrar en `dist`.
 */
const DIST_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'dist');

/** Directorio de configuracion del sistema, el modo de antes del portable. */
export function systemConfigDir(): string {
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

/**
 * Directorio de datos de la app.
 *
 * El ejecutable solo se mira si existe de verdad: si alguien clonea el
 * repositorio y no ha compilado nunca, `dist/` no esta y apuntar ahi seria
 * crear una base de datos nueva en una carpeta que nadie mira, que es
 * justamente la confusion que se quiere evitar.
 */
export function appConfigDir(): string {
  const forzado = process.env.STEAM_KEYS_DATA_DIR;

  if (forzado !== undefined && forzado !== '') return resolve(forzado);

  return existsSync(join(DIST_DIR, 'steam-keys.exe')) ? DIST_DIR : systemConfigDir();
}

/** Ruta completa del fichero SQLite. */
export function databasePath(): string {
  return join(appConfigDir(), DB_FILE_NAME);
}