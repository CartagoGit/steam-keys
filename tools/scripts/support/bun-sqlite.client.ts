import { Database, type SQLQueryBindings } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import type { IDatabaseClient } from '@/contracts';
import { SCHEMA_STATEMENTS } from '@/contracts';

/**
 * Cliente de SQLite para el servidor del puente, sobre `bun:sqlite`.
 *
 * Es el mismo `IDatabaseClient` que implementa el plugin de Tauri, de modo que
 * `SqliteGameKeyRepository` no distingue uno de otro: el servidor ejecuta el
 * repositorio que ya esta escrito y probado, no una copia.
 *
 * ## Por que no es una adaptacion cualquiera
 *
 * Es donde el puente se ha vuelto útil de verdad. Antes el navegador mandaba
 * el SQL y el servidor lo ejecutaba, asi que habia una frase SQL por un lado y
 * su resultado por otro, y ningun sitio de los dos tenia el mapa completo: para
 * saber que habia hecho una peticion habia que leer el SQL del cliente. Con el
 * repositorio aqui montado, **todo** el SQL esta en `apps/desktop/src`, y este
 * fichero solo traduce llamadas a `bun:sqlite`.
 *
 * ## La conexion es una y se queda
 *
 * Se abre al arrancar el servidor y no se cierra entre peticiones. No es una
 * optimizacion: `importRows` y `setTagsForKeys` escriben cientos de filas
 * dentro de un `BEGIN`/`COMMIT` de verdad, y una transaccion repartida entre
 * conexiones no es una transaccion.
 */
/**
   * Los valores que van a `run`/`all` tienen que ser de un tipo que SQLite
   * entienda, y `IDatabaseClient` los declara como `unknown[]` porque el
   * navegador tambien tiene que cumplirlo.
   *
   * La conversion va por `unknown` y no directamente: los dos tipos no se
 * *solapan* lo suficiente para que TypeScript acepte el salto, y avisar aqui
   * seria razonable —un repositorio que pasa un objeto donde SQLite espera un
 * *texto es un bug de verdad—. Lo que no puede hacer el compilador es
   * encontrarlo, asi que la conversion va con su explicacion y punto.
 */
function aBindings(bind: readonly unknown[]): SQLQueryBindings[] {
  return bind as unknown as SQLQueryBindings[];
}

export class BunSqliteClient implements IDatabaseClient {
  private readonly db: Database;

  constructor(ruta: string) {
    mkdirSync(dirname(ruta), { recursive: true });

    this.db = new Database(ruta, { create: true });

    for (const sentencia of SCHEMA_STATEMENTS) this.db.run(sentencia);
  }

  /** `true` si el fichero de la base de datos existe. */
  static existe(ruta: string): boolean {
    return existsSync(ruta);
  }

/**
 * Ejecuta una sentencia y devuelve **cuantas filas ha tocado**.
 *
 * El `as unknown as number` de antes no era un atajo: `bun:sqlite` devuelve un
 * objeto `{ lastInsertRowid, changes }`, no un numero, asi que el repositorio
 * recibia un objeto donde esperaba un conteo. El `as` tapaba el desajuste —el
 * compilador no puede mirarlo a traves de dos conversions— y en JavaScript un
 * objeto comparado con `> 0` se convierte a `"[object Object]"`, que es `NaN`.
 *
 * Con eso `INSERT OR IGNORE` devolvia **siempre** `false`, asi que crear una
 * etiqueta por el puente de desarrollo anunciaba «ya existe» y la creaba
 * igualmente: el aviso y el resultado decia lo contrario. Lo mismo pasaba con
 * `syncTagsFromKeys`, que suma el valor de `execute` para saber cuantas filas
 * han entrado —una suma con un objeto da una cadena— y con `renameTag`, que
 * compara contra `0` para saber si crear la etiqueta nueva.
 *
 * Se devuelve `changes` porque es lo que un `execute` significa en las otras dos
 * implementaciones: el plugin de Tauri y el cliente en memoria devuelven las
 * filas afectadas, y el repositorio esta escrito contra eso.
 */
async execute(sql: string, bind: readonly unknown[] = []): Promise<number> {
  const sentencia = this.db.prepare(sql);

  return sentencia.run(...aBindings(bind)).changes;
  }

  /**
   * `all()` y no `get()`.
   *
   * `get` devuelve una unica fila y lanza si hay mas de una; el plugin de
   * Tauri y el cliente en memoria devuelven siempre la lista. Por eso el
   * repositorio se escribe una sola vez y los tres motores pueden cumplirlo: un
   * `SELECT ... WHERE id = $1` con dos filas que no pueden existir no tiene por
   * que reventar.
   */
  async select<T>(sql: string, bind: readonly unknown[] = []): Promise<T[]> {
    const sentencia = this.db.prepare(sql);

    return sentencia.all(...aBindings(bind)) as T[];
  }

  /**
   * El esquema se despliega en el constructor.
   *
   * `SCHEMA_STATEMENTS` son `CREATE TABLE IF NOT EXISTS`, asi que son
   * idempotentes y no hay nada que decidir aqui. Va en el constructor y no en
   * un metodo aparte para que sea imposible tener un cliente con el esquema sin
   * desplegar.
   */
  async migrate(): Promise<void> {
    /* El esquema ya esta: lo despliega el constructor. */
  }

  /**
   * `BEGIN` / `COMMIT` / `ROLLBACK` de verdad, sobre la conexion cacheada.
   *
   * El `ROLLBACK` sale aunque el error no sea de SQLite —fallo de red, de lo
   * que sea—, porque si no la transaccion se queda abierta y todo lo que venga
   * despues se amonton sin confirmar. Por eso el `finally` va por delante del
   * `catch`.
   */
  async transaccion<T>(fn: () => Promise<T>): Promise<T> {
    this.db.run('BEGIN');

    try {
      const valor = await fn();

      this.db.run('COMMIT');

      return valor;
    } catch (error) {
      try {
        this.db.run('ROLLBACK');
      } catch {
        // Si el propio `ROLLBACK` falla, la transaccion ya no existe: el error
        // que importa es el de dentro, no este.
      }

      throw error;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}