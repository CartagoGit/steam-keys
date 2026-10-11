/** Identificador del producto. Debe coincidir con `tauri.conf.json`. */
export const APP_IDENTIFIER = 'com.relaxingcup.steamkeys';

/** Nombre visible de la app. */
export const APP_NAME = 'Steam Keys';

/**
 * Nombre del fichero de base de datos, sin ruta.
 *
 * La ruta **no** esta aqui a proposito: en modo portable depende de donde este
 * el ejecutable, y eso solo lo sabe Rust. Antes era la constante `DB_CONNECTION`
 * con la cadena `sqlite:steam-keys.db`, que el plugin resolvia contra la
 * carpeta de configuracion del sistema. Con los datos al lado del ejecutable
 * esa carpeta no es la buena, asi que ahora `tauri-database.service.ts` pide la
 * ruta al comando `data_directory` y le añade este nombre.
 */
export const DB_FILE_NAME = 'steam-keys.db';

/** Numero de entradas que se pintan por pagina antes de recortar la lista. */
export const PAGE_SIZE = 200;

/** Retardo del buscador, en milisegundos. */
export const SEARCH_DEBOUNCE_MS = 180;

/** Atajo de teclado para enfocar el buscador. */
export const SEARCH_SHORTCUT = '/';

/**
 * Donde se pide la clave de la API de Steam.
 *
 * Va en una constante y no escrita en el JSX porque es el unico sitio donde
 * se ofrece, y porque una direccion metida a mano en medio de un texto de
 * ayuda es facil que se quede anticuada sin que nadie se entere.
 */
export const STEAM_API_KEY_URL = 'https://steamcommunity.com/dev/apikey';

/**
 * Cuantas posiciones de la clave se dejan visibles al inspeccionarla.
 * La clave se enmascara por defecto; solo se revela bajo demanda.
 */
export const MASK_VISIBLE_CHARS = 4;

/** Teclas por fila en la vista de rejilla compacta. */
export const GRID_MIN_WIDTH_PX = 320;

/** Extension de los ficheros de texto que la app puede exportar. */
export const EXPORT_FILE_NAME = 'steam-keys-export.txt';

/**
 * Prefijo de las claves que la app guarda en `localStorage`.
 *
 * Solo se usa en el navegador, cuando no hay SQLite: el puente de desarrollo y
 * los dos adaptadores en memoria. Esta aqui y no en cada uno de ellos porque
 * los tres tenian su propia constante con el mismo nombre y el prefijo a mano, y
 * cambiarlo exigia acordarse de los tres.
 */
export const STORAGE_KEY_PREFIX = 'steam-keys';