import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@/helpers/runtime.helper';

/**
 * Lectura y escritura de ficheros de texto.
 *
 * El unico acceso al disco pasa por el dialogo nativo: el usuario elige la
 * ruta y solo entonces se lee o se escribe. Asi la app no necesita el plugin
 * `fs` con permisos amplios sobre todo el disco.
 */
export const fileService = {
  /** Abre el dialogo nativo y devuelve el texto del fichero elegido. */
  async pickTextFile(title = 'Selecciona el TXT de keys'): Promise<string | null> {
    if (!isTauri()) return null;

    const selected = await open({
      title,
      multiple: false,
      directory: false,
      filters: [{ name: 'Texto', extensions: ['txt', 'text', 'md'] }],
    });

    if (typeof selected !== 'string') return null;

    return invoke<string>('read_text_file', { path: selected });
  },

  /** Abre el dialogo de guardado y escribe el contenido en la ruta elegida. */
  async saveTextFile(
    suggestedName: string,
    contents: string,
    title = 'Guardar listado de keys',
  ): Promise<string | null> {
    if (!isTauri()) return null;

    const target = await save({
      title,
      defaultPath: suggestedName,
      filters: [{ name: 'Texto', extensions: ['txt'] }],
    });

    if (!target) return null;

    await invoke('write_text_file', { path: target, contents });
    return target;
  },

  /** Ruta del fichero de base de datos, para mostrarla en ajustes. */
  async databasePath(): Promise<string | null> {
    if (!isTauri()) return null;

    return invoke<string>('database_path');
  },
};