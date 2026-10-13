import type { IAppSettings } from './app-settings.interface';

/**
 * Los ajustes de la aplicacion, tal y como se guardan.
 *
 * ## Por que es un contrato y no un modulo suelto
 *
 * `settings.service.ts` resolvia su cliente con `getDatabaseClient()` por su
 * cuenta, y escribia el SQL dentro. Eso hacia imposible responder a dos
 * preguntas que salen al tocarlo:
 *
 * - **Que necesita?** El servicio entero, para empezar. No se puede probar sin
 *   montar una base de datos.
 * - **Que puede hacer el puente?** Nada: no hay forma de saber que parte del
 *   trafico de la app va al servidor y que parte no, salvo leer el servicio
 *   entero y contar cada `execute`.
 *
 * Con el contrato, las dos tienen respuesta: el servicio es el metodo de esta
 * interfaz, y las operaciones del puente la citan por nombre.
 *
 * Los metodos son deliberadamente los que ya tenia el servicio —`load`, `set`,
 * `setMany`—, y no uno por cada ajuste. Una interfaz con treinta metodos
 * `setTheme`, `setLocale`, `setSteamApiKey` seria mas explicita y no aportaria
 * nada: quien llama pone la clave y el valor, y el SQL lo compone el servidor.
 */
export interface ISettingsRepository {
  /**
   * Todos los ajustes, con los que falten rellenados por su valor por defecto.
   *
   * Nunca lanza: una base de datos de una version anterior puede no tener la
   * tabla, y eso no es motivo para dejar la app en blanco.
   */
  load(): Promise<IAppSettings>;

  /** Guarda un ajuste. Los demas se quedan como estaban. */
  set<K extends keyof IAppSettings>(
    key: K,
    value: IAppSettings[K],
  ): Promise<void>;

  /**
   * Guarda varios ajustes en una sola sentencia.
   *
   * Y solo los que han cambiado de verdad: cambiar de filtro escribe ambito,
   * tipo y vista, y son tres viajes a la base por tres celdas.
   */
  setMany(patch: Partial<IAppSettings>): Promise<void>;

  // ------------------------------------------------------- escape de la tabla ---

  /**
   * Lee una clave de `app_settings` que **no** es un ajuste de `IAppSettings`.
   *
   * La tabla es un almacen de clave y valor, y no todo lo que hay en ella es un
   * ajuste: la migracion de las copias antiguas deja su marca aqui para no
   * repetirse en cada arranque. Metodos como `load` y `set` estan tipados
   * contra `IAppSettings` a proposito —una llamada con una clave mal escrita no
   * compila—, y esa marca no cabe en ese tipo.
   *
   * Por eso la puerta de escape es **explicita y con nombre**, en vez de
   * aflojar `set` para que acepte cualquier cadena. Con las dos, se sigue
   * viendo de un vistazo que hay tres metodos para los ajustes y dos para lo
   * demas.
   */
  readRaw(clave: string): Promise<string | null>;

  /** Escribe una clave de `app_settings` que no es un ajuste. */
  writeRaw(clave: string, valor: string): Promise<void>;
}