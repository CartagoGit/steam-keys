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
 * Los enlaces del pie: el codigo y quien lo ha hecho.
 *
 * Van en el pie y no en un «Acerca de» porque son dos, son de lo que mas se
 * consulta y no hay nada que explicar sobre ellos. El codigo es de un solo
 * clic para reportar un fallo; el perfil, para quien prefiera escribir.
 *
 * Se abren en el navegador del sistema y no dentro de la ventana: es una
 * aplicacion de escritorio, y abrir una web en su propia ventana deja la
 * coleccion a medio cubrir y sin forma de volver sin cerrar antes.
 */
export const PROYECTO_URL = 'https://github.com/cartagogit/steam-key';

/**
 * El perfil de quien mantiene la app.
 *
 * La direccion sale del nombre, que es como lo construyen casi todos los
 * perfiles publicos de LinkedIn: nombre y apellidos en minusculas y separados
 * por guion. **Si el perfil no es exactamente ese, se cambia aqui** y ya: no
 * esta escrito en ningun otro sitio.
 */
export const PERFIL_URL = 'https://www.linkedin.com/in/mario-cabrero-volarich';

/**
 * Cuantas posiciones de la clave se dejan visibles al inspeccionarla.
 * La clave se enmascara por defecto; solo se revela bajo demanda.
 */
export const MASK_VISIBLE_CHARS = 4;

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