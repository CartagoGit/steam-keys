import { mapRowToGameKey } from '@/helpers/map-row.helper';
import { resumenDeImportacion } from '@/helpers/resumen-importacion.helper';
import { nowSqliteTimestamp } from '@/helpers/format-date.helper';
import { gameKeyInsertStatement, sqlPlaceholders } from '@/helpers/sql.helper';
import {
  keyFingerprint,
  normalizeKey,
  parseTags,
  serializeTags,
} from '@/helpers/normalize-text.helper';
import { GAME_KEY_COLUMNS, KeyPlatform, KeySource, KeyStatus, TABLE_GAME_KEYS, TABLE_TAGS, cleanTag, normalizeTag, presentaTag, type IDatabaseClient, type IGameKey, type IGameKeyDraft, type IGameKeyInput, type IGameKeyRepository, type IGameKeyRow, type IImportRow, type IImportSummary, type ITagRow } from '@/contracts';

/**
 * Repositorio de keys sobre SQLite.
 *
 * Toda la app habla con esta clase a traves de `IGameKeyRepository`, asi que
 * cambiarla por una version en memoria (para trabajar en el navegador) no
 * obliga a tocar ni un solo componente.
 */
export class SqliteGameKeyRepository implements IGameKeyRepository {
  constructor(private readonly db: IDatabaseClient) {}

  async migrate(): Promise<void> {
    await this.db.migrate();
  }

  /**
   * Todas las claves, de una vez, en memoria.
   *
   * **Aqui no hay paginacion, y es una decision, no un olvido.** Traer solo lo
   * que se pinta obligaria a mover el filtrado y la ordenacion a SQL, y eso
   * partiria el repositorio en dos: el de SQLite tendria el filtro en la
   * sentencia y el de memoria en JavaScript, y dejarian de contar lo mismo
   * justo en lo que mas se nota. Ademas, `sortKeys`, `filterKeys` y los menus
   * de la barra reciben la lista entera.
   *
   * Los numeros de lo que cuesta, medidos en este equipo con filas de tamano
   * real (titulo largo, clave, nota y dos etiquetas):
   *
   * | claves    | SQL     | por el puente |
   * |-----------|---------|---------------|
   * |     403   |   1 ms  |   0,14 MB     |
   * |   5 000   |  12 ms  |   1,2 MB      |
   * |  20 000   |  28 ms  |   6,5 MB      |
   * | 100 000   | 250 ms  |  36,0 MB      |
   *
   * El de 20 000 es una carga real de la app en el navegador: 6,5 MB en una
   * respuesta y 193 ms, y la pantalla responde igual que con cuatrocientas.
   *
   * **El techo no lo pone esta consulta, lo pone lo que se puede importar.** El
   * catalogo entero de Steam no llega a 80 000 juegos, asi que 100 000 claves
   * son mas juegos de los que han existido: por encima de 20 000 es un
   * problema teorico, y por debajo no se nota.
   *
   * Lo que **si** se multiplica es cada edicion: `reload()` va detras de cada
   * guardado, borrado y cambio de estado, de modo que el coste de arriba se
   * paga tambien en cada accion. A 403 son 0,14 MB y no se nota; a 20 000 son
   * 6,5 MB por cada tecla que se guarde. Ese es el techo real de esta
   * arquitectura, y por eso esta nota vive aqui y no en un documento: es lo
   * unico que hay que saber antes de tocar `reload()`.
   */
  async listAll(): Promise<readonly IGameKey[]> {
    const rows = await this.db.select<IGameKeyRow>(
      `SELECT ${GAME_KEY_COLUMNS} FROM ${TABLE_GAME_KEYS}
       ORDER BY COALESCE(added_on, created_at) DESC, title COLLATE NOCASE ASC`,
    );

    return rows.map(mapRowToGameKey);
  }

  async getById(id: number): Promise<IGameKey | null> {
    const rows = await this.db.select<IGameKeyRow>(
      `SELECT ${GAME_KEY_COLUMNS} FROM ${TABLE_GAME_KEYS} WHERE id = $1`,
      [id],
    );

    const row = rows[0];
    return row ? mapRowToGameKey(row) : null;
  }

  async insert(input: IGameKeyInput): Promise<IGameKey> {
    const keyValue = normalizeKey(input.keyValue);
    const ahora = nowSqliteTimestamp();

    // `created_at` y `updated_at` se numeran por separado aunque valgan lo
    // mismo. Antes compartian marcador (`$11, $11`), que es el truco que hizo
    // que en la restauracion —donde las dos fechas si son distintas— la
    // segunda se perdiera. Los valores van en el orden de
    // `GAME_KEY_WRITE_COLUMNS`, que es el de la sentencia.
    await this.db.execute(gameKeyInsertStatement(), [
      input.title.trim(),
      keyValue,
      input.platform ?? KeyPlatform.Steam,
      input.status ?? KeyStatus.Available,
      // Por defecto una clave creada desde el formulario es manual. Lo
      // explicito es el deshacer de un borrado, que tiene que devolver la
      // fila tal cual estaba y no como nueva.
      input.source ?? KeySource.Manual,
      input.giftedTo ?? null,
      input.parentTitle ?? null,
      input.note ?? null,
      serializeTags(input.tags),
      input.addedOn ?? null,
      // Antes era `null` fijo. El deshacer de un borrado lo rellena; en una
      // alta normal una clave recien creada no se ha canjeado nunca.
      input.lastUsedAt ?? null,
      ahora,
      ahora,
    ]);

    const created = await this.findByKey(keyValue);
    if (!created) throw new Error('No se pudo recuperar la key recien creada.');

    return created;
  }

  async update(id: number, draft: IGameKeyDraft): Promise<IGameKey> {
    await this.db.execute(
      `UPDATE ${TABLE_GAME_KEYS} SET
         title = $1, key_value = $2, platform = $3, status = $4,
         gifted_to = $5, parent_title = $6, note = $7, tags = $8,
         added_on = $9, updated_at = $10
       WHERE id = $11`,
      [
        draft.title.trim(),
        normalizeKey(draft.keyValue),
        draft.platform,
        draft.status,
        draft.giftedTo,
        draft.parentTitle,
        draft.note,
        serializeTags(draft.tags),
        draft.addedOn,
        nowSqliteTimestamp(),
        id,
      ],
    );

    const updated = await this.getById(id);
    if (!updated) throw new Error(`No existe la key con id ${id}.`);

    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.db.execute(`DELETE FROM ${TABLE_GAME_KEYS} WHERE id = $1`, [id]);
  }

  async removeMany(ids: readonly number[]): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = sqlPlaceholders(ids.length);
    await this.db.execute(`DELETE FROM ${TABLE_GAME_KEYS} WHERE id IN (${placeholders})`, [...ids]);
  }

  async setStatus(id: number, status: KeyStatus): Promise<void> {
    await this.db.execute(
      `UPDATE ${TABLE_GAME_KEYS} SET status = $1, updated_at = $2 WHERE id = $3`,
      [status, nowSqliteTimestamp(), id],
    );
  }

  /**
   * Cambia el estado de varias claves en una sola sentencia.
   *
   * Existe para el modo "regalar": marcar treinta claves una a una son treinta
   * viajes de ida y vuelta a la base de datos, y treinta recargas de la lista
   * si cada uno va por su cuenta.
   */
  async setStatusMany(ids: readonly number[], status: KeyStatus): Promise<void> {
    if (ids.length === 0) return;

    // Los ids empiezan en el 3 porque antes ya hay dos valores fijos: el estado
    // y el sello. Con el 2, `updated_at` y el primer id compartian marcador.
    const placeholders = sqlPlaceholders(ids.length, 3);

    await this.db.execute(
      `UPDATE ${TABLE_GAME_KEYS} SET status = $1, updated_at = $2 WHERE id IN (${placeholders})`,
      [status, nowSqliteTimestamp(), ...ids],
    );
  }

  /**
   * Marca varias claves como regaladas, guardando para quien fue cada una.
   *
   * Va en un unico `UPDATE` con un `CASE`: el destinatario es distinto en cada
   * clave, asi que no se puede repetir el mismo `bind` para todas.
   */
  async giftMany(
    entries: readonly { id: number; giftedTo: string }[],
  ): Promise<void> {
    if (entries.length === 0) return;

    const total = entries.length;
    const ids = entries.map((entry) => entry.id);

    // Orden de los valores: `$1` estado, `$2` sello, y a partir de ahi los ids y
    // los destinatarios. Los indices se cuentan aqui y no a mano porque dos
    // listas en la misma sentencia se pisan en silencio (mira `sqlPlaceholders`).
    const idPlaceholders = sqlPlaceholders(total, 3);
    const casosDesde = 3 + total;

    const cases = entries
      .map((_, indice) => `WHEN ${indice + 1} THEN $${casosDesde + indice}`)
      .join(' ');

    await this.db.execute(
      `UPDATE ${TABLE_GAME_KEYS}
          SET status = $1,
              gifted_to = CASE id ${cases} END,
              updated_at = $2
        WHERE id IN (${idPlaceholders})`,
      [
        KeyStatus.Gifted,
        nowSqliteTimestamp(),
        ...ids,
        ...entries.map((entry) => entry.giftedTo),
      ],
    );
  }

  async markUsed(id: number, usedAt?: string): Promise<void> {
    await this.db.execute(
      `UPDATE ${TABLE_GAME_KEYS} SET last_used_at = $1, updated_at = $2 WHERE id = $3`,
      [usedAt ?? nowSqliteTimestamp(), nowSqliteTimestamp(), id],
    );
  }

  /**
   * Cambia las etiquetas de varias claves en un unico `UPDATE`.
   *
   * Las etiquetas se guardan como texto separado por comas, asi que aqui se
   * reconstruye el string entero. Se hace en una sola sentencia y no en un
   * bucle porque pueden ser cientos las claves que se cambian de golpe y cada
   * viaje de ida y vuelta cuesta.
   *
   * El texto lo arma `serializeTags`, como en el resto de escrituras: unirlo a
   * mano aqui dejaba las etiquetas con espacios y sin pasar por el limpiado, de
   * modo que la misma columna guardaba dos formatos distintos.
   */
  async setTagsMany(ids: readonly number[], tags: readonly string[]): Promise<void> {
    if (ids.length === 0) return;

    // Igual que en `setStatusMany`: dos valores fijos antes, asi que los ids
    // empiezan en el 3.
    const placeholders = sqlPlaceholders(ids.length, 3);

    await this.db.execute(
      `UPDATE ${TABLE_GAME_KEYS} SET tags = $1, updated_at = $2 WHERE id IN (${placeholders})`,
      [serializeTags(tags), nowSqliteTimestamp(), ...ids],
    );
  }

  async setTagsForKeys(
    asignaciones: readonly { id: number; tags: readonly string[] }[],
  ): Promise<void> {
    if (asignaciones.length === 0) return;

    const ahora = nowSqliteTimestamp();

    /**
     * En transaccion, no en un bucle suelto.
     *
     * Con cuatrocientas claves son cuatrocientas sentencias `UPDATE` y una
     * ida y vuelta cada una. Peor que eso: si la numero 250 falla, las 249
     * anteriores ya estan escritas y la coleccion queda con unas claves
     * etiquetadas y otras no, sin nada que lo diga. En transaccion se
     * escribe todo o nada.
     */
    await this.db.transaccion(async () => {
      for (const asignacion of asignaciones) {
        await this.db.execute(
          `UPDATE ${TABLE_GAME_KEYS} SET tags = $1, updated_at = $2 WHERE id = $3`,
          [serializeTags(asignacion.tags), ahora, asignacion.id],
        );
      }
    });
  }

  async findByKey(keyValue: string): Promise<IGameKey | null> {
    const rows = await this.db.select<IGameKeyRow>(
      `SELECT ${GAME_KEY_COLUMNS} FROM ${TABLE_GAME_KEYS} WHERE key_value = $1`,
      [normalizeKey(keyValue)],
    );

    const row = rows[0];
    return row ? mapRowToGameKey(row) : null;
  }

// ------------------------------------------------------- catalogo de etiquetas ---

  async listTags(): Promise<readonly ITagRow[]> {
    return this.db.select<ITagRow>(
      `SELECT nombre, titulo, color FROM ${TABLE_TAGS}`,
    );
  }

  /**
   * Anade una etiqueta al catalogo y dice si ha entrado.
   *
   * `INSERT OR IGNORE` y no un `SELECT` antes: la clave primaria ya lo
   * garantiza, y un `SELECT` previo deja hueco para que dos llamadas a la vez
   * creen la misma etiqueta —y para que el aviso de «ya existe» salga cuando si
   * se acaba de crear—. El valor de `execute` es justamente las filas metidas,
   * que es de donde sale el booleano.
   *
   * El color va con el `INSERT` y no en un `UPDATE` detras: la etiqueta nace
   * con el, y quien la cree eligiendo un tono no tiene por que volver a
   * escribirlo.
   */
  async createTag(
    nombre: string,
    color = '',
    tituloParam = '',
  ): Promise<boolean> {
    /*
     * La clave se normaliza **aqui**, no se espera que quien llama lo haga.
     *
     * Es el unico sitio por el que entran filas en la tabla, y `nombre` es la
     * clave primaria que representa la identidad de la etiqueta. Si quien
     * escribiera «Cumplidos» entrara tal cual, tendriamos dos filas para la
     * misma palabra —la clave primaria las distingue porque no son iguales— y
     * el borrado, el color y el renombrado, que buscan por la clave normalizada,
     * no tocarian ninguna de las dos. Se ejecutan, afectan a cero filas y no
     * dicen nada. Normalizar en el servicio deja que eso dependa de que todos
     * los llamantes se acuerden.
     */
    const clave = normalizeTag(nombre);

    if (clave.length === 0) return false;

    /*
     * Si no se pasa titulo, se saca del nombre recibido.
     *
     * Sin esto, `createTag('Cumplidos')` guardaria la clave `cumplidos` y un
     * titulo vacio, que se enseña como `cumplidos`: la caja con la que se ha
     * escrito se perderia al entrar, sin que nadie se entere. Quien llama puede
     * no tener titulo porque le da igual —una etiqueta que se acaba de
     * sincronizar desde una clave—; perder la caja **si** importa, asi que se
     * deduce. Solo cuando el titulo coincide con la clave se guarda vacio, que
     * es lo que significa «no hace falta guarda nada».
     */
    const escrito = presentaTag(nombre);
    const titulo = tituloParam === '' ? escrito : tituloParam;

    const metidas = await this.db.execute(
      `INSERT OR IGNORE INTO ${TABLE_TAGS} (nombre, titulo, color) VALUES ($1, $2, $3)`,
      [clave, titulo === clave ? '' : titulo, color],
    );

    return metidas > 0;
  }

  /**
   * Cambia el tono con el que se pinta una etiqueta.
   *
   * Solo la etiqueta: el color es una forma de verla, no un renombrado, y las
   * claves llevan la **clave** en su columna de texto. Por eso no hay que tocar
   * ninguna fila de `game_keys` y esto no necesita transaccion.
   *
   * La busqueda es **exacta**, sin `COLLATE NOCASE`, y ya no hace falta el
   * rodeo. Cuando el catalogo guardaba la etiqueta tal como estaba escrita en
   * la clave —«Cumplidos»— y quien llamaba pasaba por `normalizeTag`, no habia
   * forma de que coincidieran con acentos, porque SQLite solo ignora la caja
   * de las letras ASCII. Ahora la columna `nombre` esta normalizada de verdad y
   * las dos mitades llegan igual.
   */
  async setTagColor(nombre: string, color: string): Promise<void> {
    await this.db.execute(`UPDATE ${TABLE_TAGS} SET color = $1 WHERE nombre = $2`, [
      color,
      normalizeTag(nombre),
    ]);
  }

  async deleteTag(nombre: string): Promise<number> {
    /*
     * La clave se normaliza antes de buscar, y no solo por lo de la caja: la
     * columna `tags` de las claves guarda la clave normalizada —`serializeTags`
     * la pasa por `cleanTag`—, asi que «Cumpleaños» tiene que buscar
     * «cumpleanos» para que el `LIKE` la encuentre. Con el texto tal cual, la
     * etiqueta se quitaria del catalogo y **no** de las claves.
     */
    const clave = normalizeTag(nombre);

    /**
     * La etiqueta sale del catalogo **y** de todas las claves que la llevan.
     *
     * Las dos cosas o ninguna, y en transaccion. Si solo se quitara del
     * catalogo, la proxima sincronizacion la volveria a meter —alguien sigue
     * usandola— y el boton de borrar pareceria no hacer nada. Si solo se
     * quitara de las claves, volveria a salir en el dialogo sin poder marcarse.
     *
     * De las claves hay que reescribir la columna entera, porque las etiquetas
     * viven en un texto separado por comas. Se va por `id`, no por el texto:
     * filtrar por el texto de la columna reescribiria **todas** las claves con
     * esa misma combinacion, no solo las que llevan la etiqueta —y dos claves
     * distintas con las mismas etiquetas son la norma, no la excepcion.
     */
    return this.db.transaccion(async () => {
      await this.db.execute(`DELETE FROM ${TABLE_TAGS} WHERE nombre = $1`, [
        clave,
      ]);

      const marcadas = await this.db.select<{ id: number; tags: string }>(
        `SELECT id, tags FROM ${TABLE_GAME_KEYS}
         WHERE ',' || tags || ',' LIKE '%,' || $1 || ',%'`,
        [clave],
      );

      const ahora = nowSqliteTimestamp();

      for (const fila of marcadas) {
        // `parseTags` es el que deserializa, no una copia suya: el filtro de
        // lo que se va lo pone este metodo, no el lector. Y devuelve claves
        // normalizadas, asi que `clave` es lo que hay que comparar.
        const quedan = parseTags(fila.tags).filter((tag) => tag !== clave);

        await this.db.execute(
          `UPDATE ${TABLE_GAME_KEYS} SET tags = $1, updated_at = $2 WHERE id = $3`,
          [serializeTags(quedan), ahora, fila.id],
        );
      }

      return marcadas.length;
    });
  }

  /**
   * Cambia el nombre de una etiqueta en toda la coleccion.
   *
   * Son dos cosas y solo una necesita tocar las claves.
   *
   * **La clave** —`nombre`— es la identidad de la etiqueta, y va normalizada:
   * si dos etiquetas solo se distinguieran por la caja, «dlc» y «DLC» serian
   * dos filas, el filtro de una no encontraria la otra y el catalogo tendria
   * duplicados que no se pueden distinguir. Por eso el renombrado propaga: si
   * el catalogo pasa a «humble bundle» y las claves se quedan en «humble», hay
   * dos etiquetas con el mismo significado y el filtro deja de encontrar
   * ninguna.
   *
   * **El titulo** —`titulo`— es lo que se ve, y no necesita propagar porque no
   * vive en las claves. Renombrar «dlc» a «DLC» cambia el titulo y **no** toca
   * ninguna fila de `game_keys`: las cuarenta claves que llevan «dlc» siguen
   * llevando «dlc», que es su clave, y se muestran como «DLC» porque el catalogo
   * es el que se enseña. Es lo que hace que la ultima edicion se quede.
   */
  async renameTag(
    actual: string,
    claveNueva: string,
    tituloNuevo: string,
  ): Promise<number> {
    /*
     * Las dos mitades se normalizan por separado y a proposito. La clave es
     * donde se busca y tiene que ser una sola; el titulo es lo que se ha
     * escrito y es justo lo que se quiere guardar, con su caja.
     */
    const desde = normalizeTag(actual);
    const hasta = normalizeTag(claveNueva);
    const titulo = tituloNuevo === hasta ? '' : tituloNuevo;

    /*
     * Misma etiqueta, otra caja.
     *
     * Se sale antes de abrir la transaccion porque no hay nada que propagar:
     * reescribir las cuarenta claves para cambiar «dlc» por «dlc» gastaria
     * mil viajes a la base para no cambiar nada.
     */
    if (desde === hasta) {
      await this.db.execute(
        `UPDATE ${TABLE_TAGS} SET titulo = $1 WHERE nombre = $2`,
        [titulo, desde],
      );

      return 0;
    }

    return this.db.transaccion(async () => {
      /*
       * Se traen las claves afectadas y se reescriben una a una, en vez de
       * dejarlo a un unico UPDATE con `replace` sobre el texto.
       *
       * Se podria, y seria una sola sentencia. Se ha probado y no compensa:
       * `replace` con el mismo marcador en la columna y en el patron necesita
       * que el parametro este concatenado —nunca escrito dentro de una cadena
       * literal, que Bun lo pisa igual— y aun asi el resultado dependia de
       * cuantas veces aparecia el marcador. El recorte de las comas de los
       * bordes empeora las cosas: el SQLite de Bun no entiende la forma de
       * operador de `TRIM`. Dos coma arrastradas, dos claves con el mismo
       * texto y una Actualizacion filtrada por esa columna dejan el texto
       * como estaba.
       *
       * Renombrar es una operacion rara y la columna es de texto corto. Mil
       * viajes a la base de datos en transaccion tardan menos que el rato
       * que se pierde entendiendo porque el `replace` en vez de eso.
       *
       * El `LIKE` va sin `COLLATE NOCASE` porque SQLite lo aplica ya de por si
       * —es la unica de las dos donde no hacia falta pedirlo—, y las columnas
       * guardan la clave normalizada, asi que lo que se compara con `$1` y
       * `$2` es lo mismo que hay escrito.
       */
      const afectadas = await this.db.select<{ id: number; tags: string }>(
        `SELECT id, tags FROM ${TABLE_GAME_KEYS}
         WHERE ',' || tags || ',' LIKE '%,' || $1 || ',%'
            OR ',' || tags || ',' LIKE '%,' || $2 || ',%'`,
        [desde, hasta],
      );

      const ahora = nowSqliteTimestamp();

      for (const fila of afectadas) {
        const quedan = parseTags(fila.tags).filter(
          (tag) => tag !== desde && tag !== hasta,
        );

        await this.db.execute(
          `UPDATE ${TABLE_GAME_KEYS} SET tags = $1, updated_at = $2 WHERE id = $3`,
          [serializeTags([...quedan, hasta]), ahora, fila.id],
        );
      }

      // Si el nombre nuevo ya estaba, desaparece: una etiqueta con dos nombres
      // es dos etiquetas, y el filtro buscaria una que no lleva nadie. Se
      // lleva tambien su titulo, porque si no «dlc» se llevaria por delante el
      // titulo de «dlc extra» y la que se queda mostraria el nombre de la otra.
      await this.db.execute(`DELETE FROM ${TABLE_TAGS} WHERE nombre = $1`, [
        hasta,
      ]);

      const renombradas = await this.db.execute(
        `UPDATE ${TABLE_TAGS} SET nombre = $1, titulo = $2 WHERE nombre = $3`,
        [hasta, titulo, desde],
      );

      // La etiqueta nueva puede no existir todavia en el catalogo —nadie la ha
      // guardado nunca— y el renombrado no la crea.
      if (renombradas === 0) await this.createTag(hasta, '', titulo);

      return afectadas.filter((fila) => fila.tags.includes(desde)).length;
    });
  }

  async syncTagsFromKeys(
    claves: readonly IGameKey[],
    catalogoLeido?: readonly ITagRow[],
  ): Promise<number> {
    /**
     * Meten en el catalogo todo lo que ya usan las claves, en su forma
     * **normalizada**.
     *
     * Es la vuelta que recoge los datos que ya estaban: una coleccion con
     * cuatrocientas claves tiene dentro decenas de etiquetas —«contexto»,
     * «promo winter»— que nunca se escribieron en el catalogo, porque hasta
     * ahora el catalogo no existia. Sin esta vuelta no se podrian volver a
     * marcar nunca.
     *
     * Y normalizar no es un detalle, es lo que hace que el catalogo tenga **una
     * sola fila por etiqueta**. Anadido tal cual esta escrito en la clave, «
     * Cumplidos» y «cumplidos» —que es como lo busca quien borra, quien renombra
     * o quien cambia el color— son dos filas distintas, y `INSERT OR IGNORE` no
     * se quejaba de tenerlas las dos: la clave primaria las distingue porque no
     * son iguales. Con una coleccion de mil claves, la mitad de las etiquetas
     * Tenian dos filas y la mitad de los botones no hacian nada.
     *
     * Solo anade y **normaliza**: nunca quita una etiqueta que no use ninguna
     * clave, que para eso esta `deleteTag`, que ademas limpia las claves.
     *
     * Y lo que no puede hacer, ni de broma, es **volver a renombrar**. Antes
     * acababa el bucle con un `UPDATE` que ponia el nombre de la clave en
     * `nombre` sin mirar nada mas, y eso deshacia el renombrado entero en el
     * siguiente arranque: «dlc» pasaba a «DLC», se guardaba en el titulo y a los
     * diez segundos la etiqueta volvia a salir «dlc». Aqui la caja que se
     * encuentra escrito se **conserva en `titulo`** y el nombre se normaliza una
     * sola vez.
     */
    /*
     * Las claves las pasa quien llama, y no se releen aqui.
     *
     * Antes esta sincronizacion hacia su propio `SELECT tags FROM
     * game_keys` y quien la llamaba habia leido la tabla entera un momento
     * antes: dos lecturas de lo mismo por cada carga de etiquetas, con
     * cuatrocientas filas y por el puente. Quien ya las tiene en la mano las
     * pasa y se ahorra el viaje.
     */
    const vistas = new Set<string>();

    for (const clave of claves) {
      for (const tag of clave.tags) {
        const limpia = cleanTag(tag);

        if (limpia.length > 0) vistas.add(limpia);
      }
    }

    if (vistas.size === 0) return 0;

    /**
     * Que filas del catalogo corresponden a cada clave, sin mirar la caja.
     *
     * Una **lista** y no una fila porque lo que hay que resolver es justo el
     * caso de que haya varias: «cumplidos» y «Cumplidos» producedo por una
     * sincronizacion anterior a la normalizacion. Con una sola, la decision se
     * tomaria sin ver la otra y las dos seguirian ahi.
     *
     * Se agrupa con `normalizeTag` y no con `toLowerCase`. La diferencia son
     * los acentos: una fila antigua puede llamarse «Cumpleaños», y
     * `toLowerCase()` deja «cumpleaños» mientras que el nombre que trae la
     * clave es «cumpleanos». No coinciden, la etiqueta se daba por nueva y se
     * insertaba **otra fila** al lado —la misma palabra dos veces en el
     * catalogo, y el color y el borrado de una sin tocar la otra—.
     */
    const porNombre = new Map<string, ITagRow[]>();

    /*
     * El catalogo se acepta ya leido, y si no se relee.
     *
     * Quien llama —`tagService.list()`— va a necesitar la tabla entera un
     * momento despues, y antes la leia dos veces con la misma sentencia
     * seguidas: una aqui para agrupar por nombre y otra en `listTags()` para
     * pintar. El contenido no cambia entre medias —esta funcion solo anade
     * nombres que faltan, nunca toca los colores—, asi que lo que se le pasa
     * sigue valiendo despues.
     */
    const filas = catalogoLeido ?? (await this.listTags());

    for (const fila of filas) {
      const clave = normalizeTag(fila.nombre);
      const lista = porNombre.get(clave);

      if (lista === undefined) porNombre.set(clave, [fila]);
      else lista.push(fila);
    }

    let anadidas = 0;

    for (const nombre of vistas) {
      const candidatas = porNombre.get(nombre) ?? [];

      if (candidatas.length === 0) {
        anadidas += await this.db.execute(
          `INSERT OR IGNORE INTO ${TABLE_TAGS} (nombre, titulo, color) VALUES ($1, '', '')`,
          [nombre],
        );

        continue;
      }

      /**
       * La que se queda es la que ya estaba normalizada, y si no hay, la que
       * tenga algo escrito —titulo o color— puesto.
       *
       * Se guarda lo que haya puesto a proposito: es la misma etiqueta con la
       * pinta y el nombre que alguien le eligio, y perderlos por escribir
       * «Cumplidos» con mayuscula en una clave seria un castigo por escribir.
       */
      const destino =
        candidatas.find((fila) => fila.nombre === nombre) ??
        candidatas.find((fila) => fila.titulo !== '' || fila.color !== '') ??
        candidatas[0];

      // La lista no esta vacia —se ha comprobado arriba— pero el tipo no lo
      // sabe y, sin esto, el `for` de abajo no compila.
      if (destino === undefined) continue;

      /*
       * Aqui el borrado es **exacto**, y no `COLLATE NOCASE` como en el resto
       * del fichero. Es justo al reves: aqui se va a borrar una fila concreta de
       * entre varias que solo se distinguen por la caja, y con `NOCASE` el
       * `DELETE` se las llevaria todas —incluida la que se quiere quedar—.
       *
       * `nombre` es exactamente el valor leido de esa fila, no un nombre buscado,
       * y por eso la igualdad estricta es la que corresponde.
       */
      for (const sobrante of candidatas) {
        if (sobrante === destino) continue;

        await this.db.execute(`DELETE FROM ${TABLE_TAGS} WHERE nombre = $1`, [
          sobrante.nombre,
        ]);
      }

      /*
       * Y la que se queda se normaliza **una sola vez**, de ahi en adelante la
       * clave primaria y `normalizeTag` dicen lo mismo.
       *
       * La caja que se ha quedado escrita no se tira: pasa al `titulo`, que es
       * donde vive. Perderla seria tirar la ultima edicion de quien habia
       * renombrado «dlc» a «DLC», y el `UPDATE` que hacia esto antes lo hacia
       * en cada arranque.
       */
      if (destino.nombre !== nombre) {
        /*
         * La caja que se ha quedado escrita no se tira: pasa al `titulo`, que
         * es donde vive a partir de ahora. Si la fila ya tenia un titulo —
         * alguien lo habia renombrado— ese manda: es la ultima edicion y este
         * `UPDATE` solo esta normalizando una fila antigua.
         */
        const titulo = destino.titulo !== '' ? destino.titulo : destino.nombre;

        await this.db.execute(
          `UPDATE ${TABLE_TAGS} SET nombre = $1, titulo = $2 WHERE nombre = $3`,
          [nombre, titulo, destino.nombre],
        );
      }
    }

    return anadidas;
  }

  async countAll(): Promise<number> {
    const rows = await this.db.select<{ total: number }>(
      `SELECT COUNT(*) AS total FROM ${TABLE_GAME_KEYS}`,
    );

    return rows[0]?.total ?? 0;
  }

  async listKeyValues(): Promise<readonly string[]> {
    const rows = await this.db.select<{ key_value: string }>(
      `SELECT key_value FROM ${TABLE_GAME_KEYS}`,
    );

    return rows.map((row) => row.key_value);
  }

  /**
   * Insercion masiva. Se hace con `INSERT OR IGNORE` para que reimportar el
   * mismo TXT dos veces no duplique nada y no reviente por el indice unico.
   */
  async importRows(rows: readonly IImportRow[]): Promise<IImportSummary> {
    let inserted = 0;
    let alreadyInDb = 0;

    const existing = new Set((await this.listKeyValues()).map(keyFingerprint));

    for (const row of rows) {
      const fingerprint = keyFingerprint(row.keyValue);
      if (existing.has(fingerprint)) {
        alreadyInDb += 1;
        continue;
      }
      existing.add(fingerprint);

      const ahora = nowSqliteTimestamp();
      const affected = await this.db.execute(gameKeyInsertStatement(true), [
        row.title,
        normalizeKey(row.keyValue),
        row.platform,
        row.status,
        row.source,
        row.giftedTo,
        row.parentTitle,
        row.note,
        row.tags,
        row.addedOn,
        null,
        ahora,
        ahora,
      ]);

      inserted += affected;
    }

    return resumenDeImportacion(rows, inserted, alreadyInDb);
  }
}
