import type { AppLocale } from '@/contracts';

/**
 * Que pasa con los datos al arrancar.
 *
 * - `empty`: no hay base de datos todavia. La app no ha creado ninguna y no
 *   va a hacerlo sola.
 * - `ready`: hay base de datos y se puede leer con normalidad.
 *
 * La diferencia con `exists` a secas es que **no se consulta la base de datos
 * para averiguarlo**: se mira el fichero. Abrirla crearia una vacia, que es
 * justo lo que este modulo existe para evitar.
 */
export type DatabaseState = 'empty' | 'ready';

/**
 * Lo que hay que saber antes de pintar nada.
 *
 * El idioma va aqui porque el que eligio el usuario esta **dentro** de la base
 * de datos, en la tabla `app_settings`: si no hay base de datos no hay idioma
 * guardado, y la primera pantalla —que es justamente la del aviso— tendria que
 * mostrarse en un idioma que nadie ha elegido. Sin idioma guardado solo hay un
 * dato disponible, el del navegador.
 *
 * Vive aqui, en `contracts/`, y no en `startup.service.ts` que es quien lo
 * produce, porque lo consume un hook de `helpers/` —`use-arranque`— y un hook
 * de `helpers/` solo puede mirar `contracts`. Estaba en el servicio y el hook
 * lo importaba de ahi con un `import type`: inocuo en el grafo de ejecucion,
 * pero la regla va de la dependencia y no del enlace.
 */
export interface IStartup {
  /** Que hay o no hay base de datos. */
  database: DatabaseState;
  /** Ruta donde estara o esta la base de datos, para poder nombrarla. */
  databasePath: string | null;
  /** Idioma con el que arrancar. */
  locale: AppLocale;
  /**
   * Si el idioma viene del navegador y no de un ajuste guardado.
   *
   * El aviso de "no hay base de datos" se escribe en el idioma del navegador,
   * que es lo unico que hay. Es una pista de por que no sale en espanol.
   */
  localeFromBrowser: boolean;
}