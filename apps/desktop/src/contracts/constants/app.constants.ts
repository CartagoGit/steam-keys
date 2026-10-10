/** Identificador del producto. Debe coincidir con `tauri.conf.json`. */
export const APP_IDENTIFIER = 'com.cartagostudios.steamkeys';

/** Nombre visible de la app. */
export const APP_NAME = 'Steam Keys';

/**
 * Cadena de conexion de Tauri. La ruta es relativa al directorio de
 * configuracion de la app, es decir, fuera del repositorio.
 */
export const DB_CONNECTION = 'sqlite:steam-keys.db';

/** Nombre del fichero de base de datos, sin ruta. */
export const DB_FILE_NAME = 'steam-keys.db';

/** Numero de entradas que se pintan por pagina antes de recortar la lista. */
export const PAGE_SIZE = 200;

/** Retardo del buscador, en milisegundos. */
export const SEARCH_DEBOUNCE_MS = 180;

/** Atajo de teclado para enfocar el buscador. */
export const SEARCH_SHORTCUT = '/';

/**
 * Cuantas posiciones de la clave se dejan visibles al inspeccionarla.
 * La clave se enmascara por defecto; solo se revela bajo demanda.
 */
export const MASK_VISIBLE_CHARS = 4;

/** Teclas por fila en la vista de rejilla compacta. */
export const GRID_MIN_WIDTH_PX = 320;

/** Extension de los ficheros de texto que la app puede exportar. */
export const EXPORT_FILE_NAME = 'steam-keys-export.txt';