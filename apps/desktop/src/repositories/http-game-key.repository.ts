import { pedir } from '@/repositories/http-bridge.client';
import type {
  IGameKey,
  IGameKeyDraft,
  IGameKeyInput,
  IGameKeyRepository,
  IImportRow,
  IImportSummary,
  ITagRow,
  KeyStatus,
} from '@/contracts';

/**
 * Repositorio de claves que habla con el puente de desarrollo.
 *
 * Es el tercer hermano de `IGameKeyRepository`, al lado del de SQLite y el de
 * memoria, y el mas simple de los tres: no tiene ni una linea de logica de
 * negocio, solo saber que metodo va con que operacion del puente.
 *
 * Toda la traduccion de dominio a SQL vive en el servidor, que ejecuta el
 * `SqliteGameKeyRepository` de verdad. Por eso:
 *
 * - **No hay una segunda copia del SQL** que mantener en paralelo. Una consulta
 *   se cambia en un sitio y vale para la app de escritorio y para el navegador.
 * - **Una transaccion es una transaccion.** `setTagsForKeys` y `importRows`
 *   escriben cientos de filas: por HTTP son un viaje al servidor, que las
 *   escribe dentro de su propio `BEGIN`/`COMMIT`. Antes eran tres peticiones —
 *   `BEGIN`, el trabajo, `COMMIT`— y dependian de que el puente aguantara la
 *   conexion abierta entre ellas para que el `ROLLBACK` cayera en la misma.
 *
 * ## El coste que si hay
 *
 * `reload()` manda la lista entera en cada cambio, y con 403 claves son
 * 0,14 MB por cada edicion. Es el mismo coste que ya pagaba el puente
 * anterior —el SQL era pequeno, pero la respuesta era identica—, asi que el
 * arranque no cambia. Lo que si cambia, y para bien, es que ahora el SQL se
 * compone en el servidor, donde hay un `console.error` que lo enseña.
 */
export class HttpGameKeyRepository implements IGameKeyRepository {
  async listAll(): Promise<readonly IGameKey[]> {
    return pedir('keys/list');
  }

  async getById(id: number): Promise<IGameKey | null> {
    return pedir('keys/get', { id });
  }

  async findByKey(keyValue: string): Promise<IGameKey | null> {
    return pedir('keys/find-by-key', { key: keyValue });
  }

  async countAll(): Promise<number> {
    return pedir('keys/count');
  }

  async listKeyValues(): Promise<readonly string[]> {
    return pedir('keys/list-key-values');
  }

  async insert(input: IGameKeyInput): Promise<IGameKey> {
    return pedir('keys/insert', { input });
  }

  async update(id: number, draft: IGameKeyDraft): Promise<IGameKey> {
    return pedir('keys/update', { id, draft });
  }

  async remove(id: number): Promise<void> {
    await pedir('keys/remove', { id });
  }

  async removeMany(ids: readonly number[]): Promise<void> {
    await pedir('keys/remove-many', { ids });
  }

  async setStatus(id: number, status: KeyStatus): Promise<void> {
    await pedir('keys/set-status', { id, status });
  }

  async setStatusMany(ids: readonly number[], status: KeyStatus): Promise<void> {
    await pedir('keys/set-status-many', { ids, status });
  }

  async setTagsMany(ids: readonly number[], tags: readonly string[]): Promise<void> {
    await pedir('keys/set-tags-many', { ids, tags });
  }

  async setTagsForKeys(
    asignaciones: readonly { id: number; tags: readonly string[] }[],
  ): Promise<void> {
    await pedir('keys/set-tags-for-keys', { asignaciones });
  }

  async giftMany(
    entries: readonly { id: number; giftedTo: string }[],
  ): Promise<void> {
    await pedir('keys/gift-many', { entradas: entries });
  }

  async markUsed(id: number, usedAt?: string): Promise<void> {
    await pedir('keys/mark-used', { id, usedAt });
  }

  async importRows(rows: readonly IImportRow[]): Promise<IImportSummary> {
    return pedir('keys/import-rows', { rows });
  }

  // ------------------------------------------------------- catalogo de etiquetas ---

  async listTags(): Promise<readonly ITagRow[]> {
    return pedir('tags/list');
  }

  async createTag(nombre: string, color?: string, titulo?: string): Promise<boolean> {
    return pedir('tags/create', { nombre, color, titulo });
  }

  async setTagColor(nombre: string, color: string): Promise<void> {
    await pedir('tags/set-color', { nombre, color });
  }

  async deleteTag(nombre: string): Promise<number> {
    return pedir('tags/delete', { nombre });
  }

  async renameTag(
    actual: string,
    claveNueva: string,
    tituloNuevo: string,
  ): Promise<number> {
    return pedir('tags/rename', { actual, claveNueva, tituloNuevo });
  }

  /**
   * Sin argumentos a proposito: el servidor lee las claves de la base, que es
   * de donde las saca igualmente. Mandarlas desde aqui eran 140 KB de subida
   * para ahorrarle al servidor una consulta que ya sabe hacer.
   */
  async syncTagsFromKeys(): Promise<number> {
    return pedir('tags/sync-from-keys');
  }
}