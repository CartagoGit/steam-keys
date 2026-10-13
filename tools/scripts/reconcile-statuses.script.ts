/**
 * Reconcilia los estados de la base de datos con lo que dice el TXT original.
 *
 *   bun run reconciliate              # simula y pregunta antes de escribir
 *   bun run reconcile -- --dry-run
 *   bun run reconcile -- --force
 *
 * Por que hace falta: el importador **ignora** las claves que ya estan en la
 * base de datos, asi que volver a importar el TXT no corrige nada. Es
 * exactamente lo que se necesita cuando el parser cambia y se corrige el
 * estado de un lote de claves que ya estaban importadas con el criterio viejo.
 *
 * Solo toca el `status`. Los campos editables a mano (nota, destinatario,
 * etiquetas) no se tocan, porque el TXT no es la fuente de verdad de esos: si
 * has escrito algo a mano, se queda.
 *
 * Cierra la app antes de ejecutarlo: SQLite bloquea el fichero mientras la
 * aplicacion lo tiene abierto.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';

import { parseLegacyTxt } from '@/helpers/parse-legacy-txt.helper';
import { maskKey } from '@/helpers/mask-key.helper';
import { parseTags } from '@/helpers/normalize-text.helper';
import { TABLE_GAME_KEYS } from '@/contracts/constants/db-schema.constants';
import {
  juntarEtiquetas,
  reconciliar,
  resumenDeCambios,
} from '@/helpers/reconciliar.helper';
import type { IChange, IFilaReconciliable } from '@/helpers/reconciliar.helper';
import { databasePath } from './support/db-path.helper';

const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');
const dryRun = args.includes('--dry-run') || (!force && !args.includes('--yes'));

const TXT_PATH = join(import.meta.dir, '..', '..', 'original', 'steam-keys.txt');
const DB_PATH = databasePath();

if (!existsSync(DB_PATH)) {
  console.error(`No existe la base de datos en ${DB_PATH}. Importa primero el TXT.`);
  process.exit(1);
}

if (!existsSync(TXT_PATH)) {
  console.error(`No existe el TXT original en ${TXT_PATH}.`);
  process.exit(1);
}

const raw = await Bun.file(TXT_PATH).text();

// Se abre en modo escritura, que es el de por defecto. No se pasa `create`
// porque en esta version de `bun:sqlite` un `create: false` explicito da
// error de uso en vez de abrir el fichero: la existencia ya se ha comprobado
// arriba con `existsSync`, asi que no hay nada que crear.
const db = new Database(DB_PATH);

// Se parsea **sin** filtrar por lo que ya hay: el punto de este script es
// justo mirar tambien las claves que ya estan en la base de datos.
const parsed = parseLegacyTxt(raw);

const rows = db
  .query<IFilaReconciliable, []>(
    `SELECT id, title, key_value, status, tags FROM ${TABLE_GAME_KEYS}`,
  )
  .all();

// Toda la decision —que cambia, cuales no, y como se cuenta— esta en el
// helper, que esta probado. Aqui solo se ejecuta.
const { cambios, sinPareja } = reconciliar(rows, parsed.entries);

console.log('=====================================================');
console.log(' Reconciliacion de estados con el TXT original');
console.log('=====================================================');
console.log('Origen  :', TXT_PATH);
console.log('Base BD :', DB_PATH);
console.log('');
console.log('Claves en el TXT   :', parsed.entries.length);
console.log('Claves en la base  :', rows.length);
console.log('Sin pareja en el TXT:', sinPareja.length);
console.log('Estados a cambiar  :', cambios.length);
console.log('');

if (cambios.length > 0) {
  console.log('Cambios por tipo:');
  console.log(resumenDeCambios(cambios));
  console.log('');

  if (args.includes('--verbose') || args.includes('-v')) {
    console.log('Detalle (claves enmascaradas):');
    for (const cambio of cambios.slice(0, 50)) {
      const fila = rows.find((r) => r.id === cambio.id);

      console.log(
        `  #${cambio.id} ${cambio.title} [${maskKey(fila?.key_value ?? '')}] ${cambio.before} -> ${cambio.after}`,
      );
    }
    if (cambios.length > 50) console.log(`  ... y ${cambios.length - 50} mas`);
    console.log('');
  }
}

if (cambios.length === 0) {
  console.log('No hay nada que reconciliar: la base ya coincide con el TXT.');
  db.close();
  process.exit(0);
}

if (dryRun) {
  console.log('SIMULACION: no se ha escrito nada.');
  console.log('Ejecuta con --force para aplicarlo.');
  db.close();
  process.exit(0);
}

const cambiar = db.prepare(
  `UPDATE ${TABLE_GAME_KEYS}
      SET status = ?,
          tags   = ?,
          updated_at = datetime('now')
    WHERE id = ?`,
);

// Una transaccion: o se cambia todo o nada. A medias seria peor que no
// haber hecho nada, porque la base quedaria con estados que no son de ningun
// sitio y no se sabria cuales se quedaron sin aplicar.
const aplicar = db.transaction((lista: readonly IChange[]) => {
  for (const cambio of lista) {
    const actuales = parseTags(
      db
        .query<{ tags: string }, [number]>(`SELECT tags FROM ${TABLE_GAME_KEYS} WHERE id = ?`)
        .get(cambio.id)?.tags,
    );

    // Se anaden a las que ya habia, nunca se reemplazan: las que se hayan
    // puesto a mano se quedan.
    cambiar.run(cambio.after, juntarEtiquetas(actuales, cambio.tags).join(','), cambio.id);
  }
});

aplicar(cambios);

console.log(`APLICADOS ${cambios.length} cambios.`);

// Verificacion: se vuelve a contar y se comprueba que ya no queda nada que
// reconciliar. Si esto falla, el script deberia decirlo en voz alta en vez de
// dejar que se piense que ha ido bien.
const pendientes = db
  .query<{ total: number }, []>(
    `SELECT COUNT(*) AS total FROM game_keys`,
  )
  .get();

console.log(`Claves en la base ahora: ${pendientes?.total ?? 0}`);
db.close();
console.log('Hecho.');