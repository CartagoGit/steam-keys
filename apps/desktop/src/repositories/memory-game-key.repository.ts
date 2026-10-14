import { KeyPlatform, KeySource, KeyStatus, STORAGE_KEY_PREFIX, cleanTag, type IGameKey, type IGameKeyDraft, type IGameKeyInput, type IGameKeyRepository, type IImportRow, type IImportSummary, type ITagRow } from '@/contracts';
import { resumenDeImportacion } from '@/helpers/resumen-importacion.helper';
import { keyFingerprint, normalizeKey, parseTags } from '@/helpers/normalize-text.helper';
import { nowSqliteTimestamp } from '@/helpers/format-date.helper';

/**
 * Repositorio en memoria para trabajar en el navegador.
 *
 * Implementa el mismo contrato que el de SQLite, asi que la UI se puede
 * desarrollar y depurar con `bun run dev` sin compilar Rust ni Tauri.
 * Los datos viven en `localStorage`, de modo que sobreviven a un refresco.
 */
export class MemoryGameKeyRepository implements IGameKeyRepository {
  private keys: IGameKey[] = [];

  /**
   * Las etiquetas que existen en la app, aparte de las que lleva cada clave.
   *
   * Van en su propia lista y no se deducen al vuelo porque hacen falta dos
   * cosas que no salen de las claves: **crear** una etiqueta que todavia no
   * usa nadie, y **borrar** una que se ha quedado sin usar. Si se dedujeran,
   * las dos serian imposibles.
   */
  private catalogo: string[] = [];
  /** Tono por etiqueta. Vive aparte porque el catalogo se guarda como lista. */
  private colores: Record<string, string> = {};
  /** Como se ve cada etiqueta, por clave. `''` o nada: se ve como la clave. */
  private titulos: Record<string, string> = {};

  constructor() {
    this.keys = loadFromStorage();
    this.catalogo = loadCatalogo();
    this.colores = loadColores();
    this.titulos = loadTitulos();
    this.syncCatalogo();
  }

  /**
   * Las claves, en el mismo orden que devuelve SQLite.
   *
   * El de SQLite es `COALESCE(added_on, created_at) DESC, title ASC`: primero
   * lo mas reciente, y dentro de lo mas reciente el titulo. Aqui solo se
   * ordenaba por titulo, asi que las dos implementaciones del mismo contrato
   * devolvian la lista en orden distinto, y `bun run dev` no se parecia a la
   * app de escritorio en la unica consulta de la que depende toda la vista.
   *
   * El desempate por `id` no es un adorno: dos claves del mismo juego tienen
   * el mismo titulo y la misma fecha, y sin el su orden cambia entre
   * ejecuciones. Un orden que no se puede repetir deja de ser un orden.
   */
  async listAll(): Promise<readonly IGameKey[]> {
    const fecha = (clave: IGameKey): string => clave.addedOn ?? clave.createdAt;

    return [...this.keys].sort(
      (a, b) =>
        fecha(b).localeCompare(fecha(a)) ||
        a.title.localeCompare(b.title, 'es') ||
        a.id - b.id,
    );
  }

  async getById(id: number): Promise<IGameKey | null> {
    return this.keys.find((key) => key.id === id) ?? null;
  }

  async insert(input: IGameKeyInput): Promise<IGameKey> {
    const now = nowSqliteTimestamp();

    const created: IGameKey = {
      id: nextId(),
      title: input.title.trim(),
      keyValue: normalizeKey(input.keyValue),
      platform: input.platform ?? KeyPlatform.Steam,
      status: input.status ?? KeyStatus.Available,
      // Como en la base: por defecto una clave creada desde el formulario es
      // manual, y el deshacer de un borrado es el que pasa el valor
      // explicito para devolver la fila tal cual estaba.
      source: input.source ?? KeySource.Manual,
      giftedTo: input.giftedTo ?? null,
      parentTitle: input.parentTitle ?? null,
      note: input.note ?? null,
      tags: input.tags ?? [],
      addedOn: input.addedOn ?? null,
      lastUsedAt: input.lastUsedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.keys = [...this.keys, created];
    persist(this.keys);

    return created;
  }

  async update(id: number, draft: IGameKeyDraft): Promise<IGameKey> {
    const existing = this.keys.find((key) => key.id === id);
    if (!existing) throw new Error(`No existe la key con id ${id}.`);

    const updated: IGameKey = {
      ...existing,
      title: draft.title.trim(),
      keyValue: normalizeKey(draft.keyValue),
      platform: draft.platform,
      status: draft.status,
      giftedTo: draft.giftedTo,
      parentTitle: draft.parentTitle,
      note: draft.note,
      tags: draft.tags,
      addedOn: draft.addedOn,
      updatedAt: nowSqliteTimestamp(),
    };

    this.keys = this.keys.map((key) => (key.id === id ? updated : key));
    persist(this.keys);

    return updated;
  }

  async remove(id: number): Promise<void> {
    this.keys = this.keys.filter((key) => key.id !== id);
    persist(this.keys);
  }

  async removeMany(ids: readonly number[]): Promise<void> {
    const doomed = new Set(ids);
    this.keys = this.keys.filter((key) => !doomed.has(key.id));
    persist(this.keys);
  }

  async setStatus(id: number, status: KeyStatus): Promise<void> {
    this.keys = this.keys.map((key) =>
      key.id === id ? { ...key, status, updatedAt: nowSqliteTimestamp() } : key,
    );
    persist(this.keys);
  }

  async setStatusMany(ids: readonly number[], status: KeyStatus): Promise<void> {
    if (ids.length === 0) return;

    const objetivo = new Set(ids);
    const ahora = nowSqliteTimestamp();

    this.keys = this.keys.map((key) =>
      objetivo.has(key.id) ? { ...key, status, updatedAt: ahora } : key,
    );
    persist(this.keys);
  }

  async giftMany(entries: readonly { id: number; giftedTo: string }[]): Promise<void> {
    if (entries.length === 0) return;

    const porId = new Map(entries.map((entry) => [entry.id, entry.giftedTo]));
    const ahora = nowSqliteTimestamp();

    this.keys = this.keys.map((key) =>
      porId.has(key.id)
        ? { ...key, status: KeyStatus.Gifted, giftedTo: porId.get(key.id) ?? null, updatedAt: ahora }
        : key,
    );
    persist(this.keys);
  }

  async setTagsMany(ids: readonly number[], tags: readonly string[]): Promise<void> {
    if (ids.length === 0) return;

    const objetivo = new Set(ids);
    const ahora = nowSqliteTimestamp();

    this.keys = this.keys.map((key) =>
      objetivo.has(key.id) ? { ...key, tags: [...tags], updatedAt: ahora } : key,
    );
    persist(this.keys);
  }

  /**
   * Etiquetas distintas por clave.
   *
   * Aqui la atomicidad sale gratis —el `map` construye la lista entera y
   * solo se asigna si ha salido bien—; en SQLite hace falta la transaccion
   * de verdad. Se escribe en esa forma para que las dos implementaciones
   * hagan lo mismo aunque una no pueda transaccionarse.
   */
  async setTagsForKeys(
    asignaciones: readonly { id: number; tags: readonly string[] }[],
  ): Promise<void> {
    if (asignaciones.length === 0) return;

    const porId = new Map(asignaciones.map((a) => [a.id, a.tags]));
    const ahora = nowSqliteTimestamp();

    this.keys = this.keys.map((key) => {
      const tags = porId.get(key.id);

      return tags === undefined ? key : { ...key, tags: [...tags], updatedAt: ahora };
    });

    persist(this.keys);
  }

  async markUsed(id: number, usedAt?: string): Promise<void> {
    const stamp = usedAt ?? nowSqliteTimestamp();
    this.keys = this.keys.map((key) =>
      key.id === id ? { ...key, lastUsedAt: stamp, updatedAt: stamp } : key,
    );
    persist(this.keys);
  }

  async findByKey(keyValue: string): Promise<IGameKey | null> {
    const fingerprint = keyFingerprint(keyValue);
    return this.keys.find((key) => keyFingerprint(key.keyValue) === fingerprint) ?? null;
  }

  // ------------------------------------------------------- catalogo de etiquetas ---

  /**
   * Rellena el catalogo con lo que ya usan las claves y lo guarda.
   *
   * Se llama al construir, para que el navegador no se vea con un catalogo
   * vacio: las etiquetas de la coleccion ya existen aunque el catalogo no las
   * tenga, y sin esta vuelta serian inelegibles. En SQLite lo hace
   * `syncTagsFromKeys()` —que ademas ya recibe las claves, porque aqui estan
   * en memoria—; se hace de golpe porque no hay nada mas que sincronizar.
   *
   * Normaliza con `cleanTag`, **igual que SQLite**, y no con un `trim` suelto.
   * La diferencia no es academica: sin normalizar, «Cumplidos» y «cumplidos»
   * son dos entradas distintas del catalogo, y entonces la etiqueta que
   * alguien escribio con mayuscula no se encuentra ni al borrarla ni al
   * renombrarla ni al cambiarle el color. Son dos etiquetas que significa lo
   * mismo, y el filtro se queda sin encontrar ninguna. Es el mismo fallo que
   * Ese fallo se arreglo en SQLite y se seguia haciendo en el navegador: lo
   * que se remataba en una base de datos, aqui no, y lo unico que se notaba
   * era que en el navegador unos botones no hacian nada.
   *
   * **Suma, no sustituye.** Antes se reescribia la lista entera con lo que
   * hubiera en las claves, y eso se llevaba por delante las etiquetas que se
   * hayan creado para usar mas tarde y todavia no lleva ninguna clave —que son
   * justo las que ha creado el usuario en Ajustes—. SQLite no lo hace, y una
   * implementacion que pierde lo que la otra guarda no esta implementando el
   * mismo contrato. El borrado sigue siendo de `deleteTag`, que ademas limpia
   * las claves.
   */
  private syncCatalogo(): void {
    const vistas = new Set(this.catalogo);

    for (const clave of this.keys) {
      for (const tag of clave.tags) {
        const limpia = cleanTag(tag);

        if (limpia.length > 0) vistas.add(limpia);
      }
    }

    this.catalogo = [...vistas];
    persistCatalogo(this.catalogo);
  }

  async listTags(): Promise<readonly ITagRow[]> {
    return this.catalogo.map((nombre) => ({
      nombre,
      titulo: this.titulos[nombre] ?? '',
      color: this.colores[nombre] ?? '',
    }));
  }

  /**
   * Anade la etiqueta y dice si ha entrado de verdad.
   *
   * No dice `false` por tenerla ya sin mas: quien llama necesita distinguirlo
   * para poder avisar de que ya existe, que es una accion distinta de crear.
   * Un titulo ya escrito tampoco se pisa —quien lo escribio decidio como se ve—
   * pero el color si se acepta, porque es de la creacion.
   */
  async createTag(nombre: string, color = '', titulo = ''): Promise<boolean> {
    /*
     * La clave se normaliza aqui y no se espera que quien llama lo haga, por lo
     * mismo que en SQLite: `nombre` es la identidad de la etiqueta y si
     * entrara «Cumplidos» tendriamos dos entradas para la misma palabra, y el
     * borrado, el color y el renombrado —que buscan por la clave normalizada—
     * no tocarian ninguna de las dos.
     */
    const clave = cleanTag(nombre);

    if (clave.length === 0 || this.catalogo.includes(clave)) return false;

    /*
     * Sin titulo se deduce del nombre recibido, igual que en SQLite: perder la
     * caja con la que se ha escrito al entrar no dice ninguna parte de la
     * operacion.
     */
    const escrito = titulo !== '' ? titulo : cleanTag(nombre);
    const visible = escrito === clave ? '' : escrito;

    this.catalogo = [...this.catalogo, clave];
    this.colores = { ...this.colores, [clave]: color };

    if (visible !== '') {
      this.titulos = { ...this.titulos, [clave]: visible };
    }

    persistCatalogo(this.catalogo);
    persistColores(this.colores);
    persistTitulos(this.titulos);

    return true;
  }

  async setTagColor(nombre: string, color: string): Promise<void> {
    const clave = cleanTag(nombre);

    this.colores = { ...this.colores, [clave]: color };

    persistColores(this.colores);
  }

  /**
   * Quita la etiqueta del catalogo y de todas las claves que la llevan.
   *
   * Se reescriben las filas enteras antes de guardarlas, asi que o se quita
   * de las dos partes o de ninguna: a medias, el catalogo y las claves
   * dirian cosas distintas y el boton de borrar pareceria no hacer nada.
   */
  async deleteTag(nombre: string): Promise<number> {
    const clave = cleanTag(nombre);

    let afectadas = 0;

    this.keys = this.keys.map((claveActual) => {
      if (!claveActual.tags.includes(clave)) return claveActual;

      afectadas += 1;

      return {
        ...claveActual,
        tags: claveActual.tags.filter((tag) => tag !== clave),
      };
    });

    this.catalogo = this.catalogo.filter((tag) => tag !== clave);

    /*
 * El tono se va con la etiqueta. Si se dejaba, el nombre borrado se quedaria
 * guardando su color para siempre y, si alguien volviera a crear una
 * etiqueta igual, se encontraria con un color y un nombre que nadie eligio
 * para ella.
 */
    const { [clave]: _fuera, ...resto } = this.colores;
    const { [clave]: _fueraTitulo, ...restoTitulos } = this.titulos;

    this.colores = resto;
    this.titulos = restoTitulos;

    persist(this.keys);
    persistCatalogo(this.catalogo);
    persistColores(this.colores);
    persistTitulos(this.titulos);

    return afectadas;
  }

  /**
   * Solo anade: para quitar esta `deleteTag`, que ademas limpia las claves.
   * Una sincronizacion que borrara por su cuenta desharia el borrado que el
   * usuario acaba de hacer a proposito.
   */
  async syncTagsFromKeys(
    _claves: readonly IGameKey[],
    _catalogoLeido?: readonly ITagRow[],
  ): Promise<number> {
    const antes = new Set(this.catalogo);

    this.syncCatalogo();

    return this.catalogo.filter((tag) => !antes.has(tag)).length;
  }

  /**
   * Renombra la etiqueta en el catalogo y, si la clave cambia, en las claves.
   *
   * Son dos cosas y solo una necesita tocar las claves. La **clave** es la
   * identidad —tiene que ser una sola para que «dlc» y «DLC» no sean dos
   * etiquetas— y por eso propagar es lo que hace que el filtro siga
   * encontrándola. El **titulo** es lo que se ve y no vive en las claves:
   * renombrar «dlc» a «DLC» lo unico que cambia es como se enseña.
   *
   * Si el destino ya existe, se fusiona en lugar de duplicar: las claves que
   * lo llevaban se quedan con una sola vez el nombre nuevo.
   */
  async renameTag(
    actual: string,
    claveNueva: string,
    tituloNuevo: string,
  ): Promise<number> {
    const desde = cleanTag(actual);
    const hasta = cleanTag(claveNueva);
    const titulo = tituloNuevo === hasta ? '' : tituloNuevo;

    /*
     * Misma clave, otra caja: no hay claves que reescribir. Es el caso de
     * renombrar «dlc» a «DLC», que antes de existir `titulo` no se podia ni
     * dejar escrito.
     */
    if (desde === hasta) {
      const { [desde]: _fuera, ...resto } = this.titulos;

      this.titulos = titulo === '' ? resto : { ...resto, [desde]: titulo };

      persistTitulos(this.titulos);

      return 0;
    }

    let afectadas = 0;

    this.keys = this.keys.map((clave) => {
      const tieneActual = clave.tags.includes(desde);

      if (!tieneActual) return clave;

      afectadas += 1;

      // Se filtra el nombre nuevo antes de anadirlo: una clave que ya llevaba
      // los dos nombres no puede acabar con el nuevo dos veces.
      const quedan = clave.tags.filter((tag) => tag !== desde && tag !== hasta);

      return { ...clave, tags: [...quedan, hasta] };
    });

    this.catalogo = [
      ...this.catalogo.filter((tag) => tag !== desde && tag !== hasta),
      hasta,
    ];

    /*
     * El color **acompana** al renombrado, igual que en SQLite, donde la fila
     * se renombra y el tono se queda en ella. Y si el destino ya existia, gana
     * el color de la etiqueta que se renombra: es la que se sigue usando, la
     * otra desaparece.
     */
    const { [desde]: colorActual, [hasta]: _colorNuevo, ...resto } =
      this.colores;

    this.colores =
      colorActual === undefined ? resto : { ...resto, [hasta]: colorActual };

    const { [desde]: _tituloActual, [hasta]: _tituloNuevo, ...restoTitulos } =
      this.titulos;

    this.titulos =
      titulo === '' ? restoTitulos : { ...restoTitulos, [hasta]: titulo };

    persist(this.keys);
    persistCatalogo(this.catalogo);
    persistColores(this.colores);
    persistTitulos(this.titulos);

    return afectadas;
  }

  async countAll(): Promise<number> {
    return this.keys.length;
  }

  async listKeyValues(): Promise<readonly string[]> {
    return this.keys.map((key) => key.keyValue);
  }

  async importRows(rows: readonly IImportRow[]): Promise<IImportSummary> {
    const existing = new Set(this.keys.map((key) => keyFingerprint(key.keyValue)));
    let inserted = 0;
    let alreadyInDb = 0;
    const now = nowSqliteTimestamp();

    for (const row of rows) {
      const fingerprint = keyFingerprint(row.keyValue);
      if (existing.has(fingerprint)) {
        alreadyInDb += 1;
        continue;
      }
      existing.add(fingerprint);

      this.keys.push({
        id: nextId(),
        title: row.title,
        keyValue: row.keyValue,
        platform: row.platform as KeyPlatform,
        status: row.status as KeyStatus,
        source: row.source as KeySource,
        giftedTo: row.giftedTo,
        parentTitle: row.parentTitle,
        note: row.note,
        tags: parseTags(row.tags),
        addedOn: row.addedOn,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      inserted += 1;
    }

    persist(this.keys);

    return resumenDeImportacion(rows, inserted, alreadyInDb);
  }
}

/**
 * Clave de `localStorage` de las claves.
 *
 * Sale de `STORAGE_KEY_PREFIX` y no esta escrita a mano: `memory-database.client`
 * guarda los ajustes en `steam-keys:settings` y aqui las claves en
 * `steam-keys:memory-repository`, y el prefijo tenia que cambiar en los dos a
 * la vez. Los datos ya guardados con la escritura anterior se siguen leyendo:
 * el valor es identico.
 */
const STORAGE_KEY = `${STORAGE_KEY_PREFIX}:memory-repository`;

/**
 * Clave aparte para el catalogo de etiquetas.
 *
 * No se guarda dentro del mismo valor que las claves porque su forma es otra
 * —una lista de cadenas, no de objetos— y porque asi una coleccion ya
 * guardada se sigue leyendo igual, sin conversion ni migracion.
 */
const STORAGE_KEY_CATALOGO = `${STORAGE_KEY_PREFIX}:memory-tags`;

function loadCatalogo(): string[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CATALOGO);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function persistCatalogo(catalogo: readonly string[]): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY_CATALOGO, JSON.stringify(catalogo));
  } catch {
    // Cuota superada o modo privado: la app sigue funcionando en memoria.
  }
}

/**
 * Los tonos van en **otra clave**, y no dentro del catalogo.
 *
 * El catalogo se guarda como una lista de cadenas desde siempre, y cambiarle la
 * forma obligaria a decidir que hacer con lo que ya hay escrito —una lista de
 * objetos donde se esperaba una lista de cadenas no es un catalogo, es un
 * `undefined` por cada fila—. Con una clave aparte, lo viejo se sigue leyendo
 * tal cual y lo nuevo simplemente empieza vacio.
 */
const STORAGE_KEY_COLORES = `${STORAGE_KEY_PREFIX}:memory-tag-colors`;

function loadColores(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY_COLORES);

    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function persistColores(colores: Readonly<Record<string, string>>): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY_COLORES, JSON.stringify(colores));
  } catch {
    // Cuota superada o modo privado: la app sigue funcionando en memoria.
  }
}

/**
 * Los titulos van en **otra clave**, igual que los tonos y por el mismo motivo.
 *
 * Solo se guardan los que **se diferencian** de la clave —«DLC» para «dlc»— y
 * vacio significa «enseñame la clave». Asi el valor mas comun de la coleccion,
 * que es la etiqueta que nadie ha renombrado nunca, no ocupa sitio en el disco.
 */
const STORAGE_KEY_TITULOS = `${STORAGE_KEY_PREFIX}:memory-tag-titles`;

function loadTitulos(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY_TITULOS);

    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function persistTitulos(titulos: Readonly<Record<string, string>>): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY_TITULOS, JSON.stringify(titulos));
  } catch {
    // Cuota superada o modo privado: la app sigue funcionando en memoria.
  }
}

function loadFromStorage(): IGameKey[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IGameKey[]) : [];
  } catch {
    return [];
  }
}

function persist(keys: readonly IGameKey[]): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Cuotasuperada o modo privado: la app sigue funcionando en memoria.
  }
}

function nextId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

