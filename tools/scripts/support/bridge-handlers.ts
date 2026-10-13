import type { IBridgeContext, BridgeHandlers } from '@/contracts';

/**
 * Que hace cada operacion del puente.
 *
 * ## La tabla entera cabe en una pagina
 *
 * Esto es lo que sustituye al tunel de SQL, y su utilidad esta en que se lee
 * de un vistazo. Un `POST /__dev-bridge__/keys/set-status` con `{ id, status }`
 * dice lo que hace sin abrir nada mas; el `POST /__dev-bridge__/sql?op=exec`
 * con un `UPDATE` concatenado dentro no decia nada.
 *
 * Cada fila es una linea que delega en el repositorio. No hay una sola
 * sentencia SQL en este fichero —ni en el servidor entero—: el SQL esta en
 * `apps/desktop/src/repositories`, que es el mismo que ejecuta la app de
 * escritorio. Por eso no hay dos implementaciones que mantener en paralelo, y
 * por eso una consulta que se cambie vale para los dos sitios a la vez.
 *
 * ## El mapa de tipos obliga
 *
 * `BridgeHandlers` declara, para cada operacion, la forma exacta de sus
 * argumentos y de su resultado. Si una fila se equivoca al delegar —que devuelva
 * `void` donde toca `IGameKey`, o que acepte un `string` donde toca `{ id }`— no
 * compila. Un mapa suelto con `any` dejaria que el cliente y el servidor
 * dejaran de hablar sin que se enterara nadie hasta que fallara una llamada.
 */
export const MANEJADORES: BridgeHandlers = {
  // --------------------------------------------------------------- claves ---
  'keys/list': (ctx) => ctx.claves.listAll(),
  'keys/get': (ctx, { id }) => ctx.claves.getById(id),
  'keys/find-by-key': (ctx, { key }) => ctx.claves.findByKey(key),
  'keys/count': (ctx) => ctx.claves.countAll(),
  'keys/list-key-values': (ctx) => ctx.claves.listKeyValues(),
  'keys/insert': (ctx, { input }) => ctx.claves.insert(input),
  'keys/update': (ctx, { id, draft }) => ctx.claves.update(id, draft),
  'keys/remove': (ctx, { id }) => ctx.claves.remove(id),
  'keys/remove-many': (ctx, { ids }) => ctx.claves.removeMany(ids),

  /*
   * Las tres siguientes se dejan como promesas sin `await`.
   *
   * El manejador devuelve lo que sea que devuelva el repositorio y lo decide
   * quien llama. Añadir un `await` aqui —por costumbre— abriria una transaccion
   * nueva por cada operacion, y `setStatusMany` dentro de una seria una
   * transaccion anidada: la segunda se queda sin cerrar y deja la base
   * bloqueada.
   */
  'keys/set-status': (ctx, { id, status }) => ctx.claves.setStatus(id, status),
  'keys/set-status-many': (ctx, { ids, status }) =>
    ctx.claves.setStatusMany(ids, status),
  'keys/set-tags-many': (ctx, { ids, tags }) => ctx.claves.setTagsMany(ids, tags),

  /**
   * Etiquetas distintas en cada clave, en una sola transaccion.
   *
   * Esto es lo que el tunel no podia hacer bien: por HTTP eran tres viajes —
   * `BEGIN`, las escrituras, `COMMIT`— y dependian de que el puente aguantara la
   * conexion entre ellos. Ahora es una peticion, y la transaccion ocurre entera
   * aqui, dentro de `setTagsForKeys`.
   */
  'keys/set-tags-for-keys': (ctx, { asignaciones }) =>
    ctx.claves.setTagsForKeys(asignaciones),

  'keys/gift-many': (ctx, { entradas }) => ctx.claves.giftMany(entradas),
  'keys/mark-used': (ctx, { id, usedAt }) => ctx.claves.markUsed(id, usedAt),
  'keys/import-rows': (ctx, { rows }) => ctx.claves.importRows(rows),

  // ------------------------------------------------------- catalogo de etiquetas ---
  'tags/list': (ctx) => ctx.claves.listTags(),
  'tags/create': (ctx, { nombre, color }) => ctx.claves.createTag(nombre, color),
  'tags/set-color': (ctx, { nombre, color }) => ctx.claves.setTagColor(nombre, color),
  'tags/delete': (ctx, { nombre }) => ctx.claves.deleteTag(nombre),
  'tags/rename': (ctx, { actual, nuevo }) => ctx.claves.renameTag(actual, nuevo),

  /**
   * El servidor lee las claves, no las recibe.
   *
   * La version en SQLite acepta la lista para no releer la tabla, y aqui seria
   * justo al reves: mandar cuatrocientas claves —0,14 MB— para ahorrarle a un
   * servidor que las tiene en la base un `SELECT` es empeorar la llamada.
   */
  'tags/sync-from-keys': async (ctx) =>
    ctx.claves.syncTagsFromKeys(await ctx.claves.listAll()),

  // -------------------------------------------------------------- ajustes ---
  'settings/load': (ctx) => ctx.ajustes.load(),
  'settings/set': (ctx, { key, value }) => ctx.ajustes.set(key, value),
  'settings/set-many': (ctx, { patch }) => ctx.ajustes.setMany(patch),
  'settings/read-raw': (ctx, { clave }) => ctx.ajustes.readRaw(clave),
  'settings/write-raw': (ctx, { clave, valor }) => ctx.ajustes.writeRaw(clave, valor),

  // --------------------------------------------------------------- respaldos ---
  'backups/create': (ctx, { reason }) => ctx.respaldos.create(reason),
  'backups/list': (ctx) => ctx.respaldos.list(),
  'backups/remove': (ctx, { name }) => ctx.respaldos.remove(name),
  'backups/restore': (ctx, { name, mode }) => ctx.respaldos.restore(name, mode),
  'backups/preview-restore': (ctx, { name, mode }) =>
    ctx.respaldos.previewRestore(name, mode),
  'backups/check-health': (ctx) => ctx.respaldos.checkHealth(),
  'backups/count-unknown-platform': (ctx) => ctx.respaldos.countUnknownPlatform(),
};

/**
 * La tabla de arriba **tiene** que cubrir todas las operaciones.
 *
 * `satisfies BridgeHandlers` ya obliga a que esten todas y con la firma
 * correcta —si faltara una, el objeto no cumpliria el tipo y no compilara—.
 * Esta funcion es la otra mitad de la garantia: que el **cliente** no invoque
 * ninguna que aqui no exista.
 */
export function manejadorDe(
  operacion: string,
): ((ctx: IBridgeContext, args: never) => Promise<unknown>) | null {
  return Object.hasOwn(MANEJADORES, operacion)
    ? (MANEJADORES[operacion as keyof BridgeHandlers] as (
        ctx: IBridgeContext,
        args: never,
      ) => Promise<unknown>)
    : null;
}