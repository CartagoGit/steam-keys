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

  constructor() {
    this.keys = loadFromStorage();
    this.catalogo = loadCatalogo();
    this.colores = loadColores();
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
   */
  private syncCatalogo(): void {
    const vistas = new Set<string>();

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
      color: this.colores[nombre] ?? '',
    }));
  }

  async createTag(nombre: string, color = ''): Promise<void> {
    if (this.catalogo.includes(nombre)) return;

    this.catalogo = [...this.catalogo, nombre];
    this.colores = { ...this.colores, [nombre]: color };

    persistCatalogo(this.catalogo);
    persistColores(this.colores);
  }

  async setTagColor(nombre: string, color: string): Promise<void> {
    this.colores = { ...this.colores, [nombre]: color };

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
    let afectadas = 0;

    this.keys = this.keys.map((clave) => {
      if (!clave.tags.includes(nombre)) return clave;

      afectadas += 1;

      return { ...clave, tags: clave.tags.filter((tag) => tag !== nombre) };
    });

    this.catalogo = this.catalogo.filter((tag) => tag !== nombre);

    /*
     * El tono se va con la etiqueta. Si se dejaba, el nombre borrado followed
     * guardando su color para siempre y, si alguien volviera a crear una
     * etiqueta igual, se encontraria con un color que nadie eligio.
     */
    const { [nombre]: _fuera, ...resto } = this.colores;

    this.colores = resto;

    persist(this.keys);
    persistCatalogo(this.catalogo);
    persistColores(this.colores);

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
   * Renombra la etiqueta en el catalogo y en todas las claves que la llevan.
   *
   * Una etiqueta es una entidad por si misma: si el catalogo dice una cosa y
   * las claves otra, hay dos etiquetas con el mismo significado y el filtro
   * deja de encontrar ninguna. Por eso el renombrado propaga.
   *
   * Si el destino ya existe, se fusiona en lugar de duplicar: las claves que
   * lo llevaban se quedan con una sola vez el nombre nuevo.
   */
  async renameTag(actual: string, nuevo: string): Promise<number> {
    if (actual === nuevo) return 0;

    let afectadas = 0;

    this.keys = this.keys.map((clave) => {
      const tieneActual = clave.tags.includes(actual);

      if (!tieneActual) return clave;

      afectadas += 1;

      // Se filtra el nombre nuevo antes de anadirlo: una clave que ya llevaba
      // los dos nombres no puede acabar con el nuevo dos veces.
      const quedan = clave.tags.filter((tag) => tag !== actual && tag !== nuevo);

      return { ...clave, tags: [...quedan, nuevo] };
    });

    this.catalogo = [
      ...this.catalogo.filter((tag) => tag !== actual && tag !== nuevo),
      nuevo,
    ];

    /*
     * El color **acompana** al renombrado, igual que en SQLite, donde la fila
     * se renombra y el tono se queda en ella. Y si el destino ya existia, gana
     * el color de la etiqueta que se renombra: es la que se sigue usando, la
     * otra desaparece.
     */
    const { [actual]: colorActual, [nuevo]: _colorNuevo, ...resto } = this.colores;

    this.colores = colorActual === undefined ? resto : { ...resto, [nuevo]: colorActual };

    persist(this.keys);
    persistCatalogo(this.catalogo);
    persistColores(this.colores);

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

