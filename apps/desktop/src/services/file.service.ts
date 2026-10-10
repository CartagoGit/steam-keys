import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@/helpers/runtime.helper';
import type { IDatabaseInfo } from '@/contracts/interfaces/backup.interface';

/**
 * Lectura y escritura de ficheros de texto.
 *
 * Dentro de Tauri el unico acceso al disco pasa por el dialogo nativo: el
 * usuario elige la ruta y solo entonces se lee o se escribe. Asi la app no
 * necesita el plugin `fs` con permisos amplios sobre todo el disco.
 *
 * En el navegador no hay dialogo nativo, asi que se recurre al selector de
 * ficheros del propio navegador y a una descarga. Sirve para poder trabajar
 * la interfaz (importar, previsualizar, exportar) sin compilar Rust.
 */
export const fileService = {
  /** Abre el dialogo nativo y devuelve el texto del fichero elegido. */
  async pickTextFile(title = 'Selecciona el TXT de keys'): Promise<string | null> {
    if (!isTauri()) return pickFileInBrowser();

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
    if (!isTauri()) {
      downloadInBrowser(suggestedName, contents);
      return suggestedName;
    }

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

  /** Ruta, existencia y tamaño del fichero de base de datos. */
  async databaseInfo(): Promise<IDatabaseInfo | null> {
    if (!isTauri()) return null;

    const info = await invoke<IDatabaseInfoRaw>('database_info');

    return {
      path: info.path,
      exists: info.exists,
      sizeBytes: info.size_bytes,
    };
  },
};

/** Lo que devuelve el comando `database_info` de Rust. */
interface IDatabaseInfoRaw {
  path: string;
  exists: boolean;
  size_bytes: number;
}

/**
 * Selector de ficheros del navegador, para la vista previa sin Tauri.
 *
 * Resuelve a `null` si el usuario cancela, igual que el dialogo nativo, para
 * que quien llama no tenga que distinguir entre los dos entornos.
 */
function pickFileInBrowser(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');

    input.type = 'file';
    input.accept = '.txt,.text,.md,text/plain';
    input.style.display = 'none';

    // `cancel` no existe en todos los navegadores: si no lo hay, el `change`
    // nunca llega y la promesa se resuelve desde el desenfoque del documento.
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();

      if (!file) {
        resolve(null);
        return;
      }

      file.text().then(resolve, () => resolve(null));
    };

    window.addEventListener(
      'focus',
      () => {
        window.setTimeout(() => {
          if (input.files?.length === 0) {
            input.remove();
            resolve(null);
          }
        }, 400);
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });
}

/** Descarga un fichero de texto, para cuando no hay dialogo nativo. */
function downloadInBrowser(nombre: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  // Sin revocar, el blob se queda en memoria hasta que se recargue la pagina.
  URL.revokeObjectURL(url);
}