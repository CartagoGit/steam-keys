import type {
  IGameKey,
  IGameKeyDraft,
  IGameKeyInput,
} from '../interfaces/game-key.interface';
import type {
  IImportRow,
  IImportSummary,
} from '../interfaces/import-summary.interface';
import type { ITagRow } from '../interfaces/tag.interface';
import type { KeyStatus } from '../enums/key-status.enum';
import type { ISettingsRepository } from '../interfaces/settings-repository.interface';
import type { IBackupRepository } from '../interfaces/backup-repository.interface';
import type { IGameKeyRepository } from '../interfaces/database.interface';
import type { IAppSettings } from '../interfaces/app-settings.interface';
import type { IBackup, IRestoreSummary } from '../interfaces/backup.interface';
import type { StorageHealth } from '../enums/storage-health.enum';
import type { BackupReason } from '../enums/backup-reason.enum';
import type { RestoreMode } from '../enums/restore-mode.enum';

/**
 * Las operaciones que el puente de desarrollo entiende, y lo que espera de
 * cada una.
 *
 * ## Por que esto existe
 *
 * El puente antes era un tunnel: el navegador le mandaba el SQL entero y el
 * servidor lo ejecutaba tal cual —
 *
 *   POST /__dev-bridge__/sql?op=exec
 *   { "sql": "UPDATE game_keys SET status = ? WHERE id = ?", "binds": [3, 1] }
 *
 * Funciona, pero no dice nada. Al abrir las DevTools no hay forma de saber que
 * ha hecho la peticion sin leer el SQL concatenado, y el SQL lo compone el
 * cliente, no el servidor: el error sale en el sitio equivocado y el que hay
 * que arreglar no es el que salto.
 *
 * Aqui el nombre de la operacion **es** lo que dice. La peticion es
 *
 *   POST /__dev-bridge__/keys/set-status
 *   { "id": 1, "status": "Available" }
 *
 * y el SQL —si algo va mal— se imprime en el servidor, donde esta escrito.
 *
 * ## Lo que cambia de verdad
 *
 * 1. **El SQL no viaja.** El cuerpo son datos de dominio: un id, una etiqueta,
 *    un estado. Que se traduzcan en una consulta es problema del servidor.
 * 2. **No hay dos implementaciones.** El servidor ejecuta *el mismo*
 *    `SqliteGameKeyRepository` que la app de escritorio, con un cliente de
 *    `bun:sqlite`. Si una consulta cambia, cambia en los dos sitios a la vez.
 * 3. **Las transacciones son de verdad.** `transaccion()` mandaba `BEGIN`, el
 *    trabajo y `COMMIT` en tres peticiones distintas, y dependia de que el
 *    puente aguantara la conexion abierta para que el `ROLLBACK` cayera en la
 *    misma. Con una operacion por peticion, `setTagsForKeys` se ejecuta entero
 *    y atomico dentro del servidor.
 * 4. **El navegador no puede ejecutar SQL.** Antes cualquier pestaña abierta
 *    podia mandar la sentencia que quisiera contra la base. Ahora no existe esa
 *    operacion: solo las de esta tabla.
 *
 * ## Por que el mapa va tipado
 *
 * Cada entrada declara que argumentos pide y que devuelve. El servidor obliga
 * a que su manejador cumpla la misma forma —si uno cambia, no compila—, y el
 * cliente saca de aqui los tipos de su `fetch` sin repetirlos. Un mapa suelto
 * con `any` no impediria que unendpoint y su cliente dejaran de hablar, que es
 * justo lo que hay que evitar.
 */
export interface IBridgeOperations {
  // --------------------------------------------------------------- claves ---
  'keys/list': { args: void; result: readonly IGameKey[] };
  'keys/get': { args: { id: number }; result: IGameKey | null };
  'keys/find-by-key': { args: { key: string }; result: IGameKey | null };
  'keys/count': { args: void; result: number };
  'keys/list-key-values': { args: void; result: readonly string[] };
  'keys/insert': { args: { input: IGameKeyInput }; result: IGameKey };
  'keys/update': {
    args: { id: number; draft: IGameKeyDraft };
    result: IGameKey;
  };
  'keys/remove': { args: { id: number }; result: void };
  'keys/remove-many': { args: { ids: readonly number[] }; result: void };
  'keys/set-status': {
    args: { id: number; status: KeyStatus };
    result: void;
  };
  'keys/set-status-many': {
    args: { ids: readonly number[]; status: KeyStatus };
    result: void;
  };
  'keys/set-tags-many': {
    args: { ids: readonly number[]; tags: readonly string[] };
    result: void;
  };
  /**
   * Etiquetas distintas en cada clave, en una sola transaccion.
   *
   * Va como una sola operacion y no como N por clave porque es lo que hace el
   * repositorio: con cuatrocientas claves, escribir de una en una deja la
   * coleccion a medias en cuanto una falla.
   */
  'keys/set-tags-for-keys': {
    args: { asignaciones: readonly { id: number; tags: readonly string[] }[] };
    result: void;
  };
  'keys/gift-many': {
    args: { entradas: readonly { id: number; giftedTo: string }[] };
    result: void;
  };
  'keys/mark-used': { args: { id: number; usedAt?: string }; result: void };
  'keys/import-rows': {
    args: { rows: readonly IImportRow[] };
    result: IImportSummary;
  };

  // ------------------------------------------------------- catalogo de etiquetas ---
  'tags/list': { args: void; result: readonly ITagRow[] };
  'tags/create': { args: { nombre: string; color?: string }; result: void };
  'tags/set-color': { args: { nombre: string; color: string }; result: void };
  'tags/delete': { args: { nombre: string }; result: number };
  'tags/rename': { args: { actual: string; nuevo: string }; result: number };
  /**
   * Mete en el catalogo todo lo que ya usan las claves. Sin argumentos.
   *
   * La version en SQLite acepta las claves para no releer la tabla, y en el
   * puente **no tiene sentido**: mandar cuatrocientas claves —unos 140 KB— para
   * ahorrarle al servidor un `SELECT` que devuelve lo mismo es empeorar la
   * llamada. El servidor las tiene; las lee.
   */
  'tags/sync-from-keys': { args: void; result: number };

  // -------------------------------------------------------------- ajustes ---
  'settings/load': { args: void; result: IAppSettings };
  'settings/set': {
    args: { key: keyof IAppSettings; value: IAppSettings[keyof IAppSettings] };
    result: void;
  };
  'settings/set-many': { args: { patch: Partial<IAppSettings> }; result: void };
  /**
   * Claves de `app_settings` que no son ajustes: la marca de la migracion de
   * copias antiguas y poco mas.
   *
   * Van con nombre propio y no colgando de `settings/set` para que no se puedan
   * pasar por ahi claves que no son ajustes sin querer.
   */
  'settings/read-raw': { args: { clave: string }; result: string | null };
  'settings/write-raw': { args: { clave: string; valor: string }; result: void };

  // --------------------------------------------------------------- respaldos ---
  'backups/create': { args: { reason: BackupReason }; result: IBackup };
  'backups/list': { args: void; result: readonly IBackup[] };
  'backups/remove': { args: { name: string }; result: void };
  'backups/restore': {
    args: { name: string; mode: RestoreMode };
    result: IRestoreSummary;
  };
  'backups/preview-restore': {
    args: { name: string; mode: RestoreMode };
    result: IRestoreSummary;
  };
  'backups/check-health': {
    args: void;
    result: { health: StorageHealth; detail: string | null };
  };
  'backups/count-unknown-platform': { args: void; result: number };
}

/** Nombre de cualquier operacion del puente. */
export type BridgeOperationName = keyof IBridgeOperations;

/** Lo que hay que mandar a una operacion. */
export type BridgeArgs<T extends BridgeOperationName> = IBridgeOperations[T]['args'];

/** Lo que devuelve una operacion. */
export type BridgeResult<T extends BridgeOperationName> = IBridgeOperations[T]['result'];

/**
 * Lo que el puente necesita montado para poder atender una peticion.
 *
 * Los repositorios van aqui enteros, no las sentencias: es lo que permite que
 * el servidor reuse el SQL que ya esta escrito y probado, en vez de traducir
 * una consulta por la otra.
 */
export interface IBridgeContext {
  claves: IGameKeyRepository;
  ajustes: ISettingsRepository;
  respaldos: IBackupRepository;
}

/**
 * Un manejador, con la forma exacta que declara su operacion.
 *
 * El `map` de tipos obliga a que un manejador declarado como
 * `'keys/get'` acepte `{ id }` y devuelva una clave, y no otra cosa. Sin esto,
 * cambiar la firma de una operacion no rompe nada hasta que alguien la llama y
 * falla en produccion.
 */
export type BridgeHandlers = {
  [T in BridgeOperationName]: (
    contexto: IBridgeContext,
    args: BridgeArgs<T>,
  ) => Promise<BridgeResult<T>>;
};