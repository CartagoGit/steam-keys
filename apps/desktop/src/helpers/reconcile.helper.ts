import type { IParsedEntry } from '@/contracts';
import { keyFingerprint, parseTags } from './normalize-text.helper';

/**
 * Calcular que hay que cambiar para que la base de datos diga lo mismo que el
 * TXT original.
 *
 * Vive aqui y no dentro del script que lo usa, por la misma razon que el
 * resto de la app: **la decision se prueba y el efecto no**. Un script de
 * nivel superior se ejecuta leyendo ficheros de verdad y escribiendo en la
 * base de datos de verdad, asi que no se puede probar sin tocar los datos de
 * verdad — y este script escribe sobre las 403 claves que hay ahi. Lo que
 * queda dentro son cuatro `console.log` y un `process.exit`.
 *
 * Lo que decide aqui es lo que importa: que claves cambian de estado, cuales
 * reciben etiquetas nuevas, y cuales se dejan como estan. Un error aqui cambia
 * estados de verdad y no se ve hasta que se abre la app, que es tarde.
 */

/** Lo que el TXT dice de una clave: lo unico que se compara con la fila. */
type IParseada = Pick<IParsedEntry, 'status' | 'tags'>;

/** Una fila de la base de datos con lo justo para saber que cambiar. */
export interface IReconcilableRow {
  id: number;
  title: string;
  key_value: string;
  status: string;
  tags: string;
}

/** Un cambio de estado pendiente de aplicar. */
export interface IChange {
  id: number;
  title: string;
  before: string;
  after: string;
  /** Etiquetas nuevas que hay que anadir a la clave. */
  tags: readonly string[];
}

/** Lo que hay que hacer, y lo que se deja como esta. */
export interface IReconciliation {
  cambios: readonly IChange[];
  /** Claves de la base que no estan en el TXT: se dejan como estan. */
  sinPareja: readonly IReconcilableRow[];
}

/**
 * Que cambia entre lo que hay en la base y lo que dice el TXT.
 *
 * Solo se compara el estado y las etiquetas. La nota, el destinatario y el
 * resto de campos editables a mano **no** se tocan: el TXT no es la fuente de
 * verdad de esos, y si alguien escribio algo a mano, se queda.
 *
 * Las claves se emparejan por `keyFingerprint`, no por el texto de la clave:
 * el TXT puede traerlas con los guiones puestos de otra manera y con espacios
 * alrededor, y comparar literales daria cero parejas en cuanto variase el
 * formato.
 */
export function reconcileRows(
  filas: readonly IReconcilableRow[],
  entradas: readonly IParsedEntry[],
): IReconciliation {
  const porClave = new Map<string, IParseada>();

  for (const entrada of entradas) {
    porClave.set(keyFingerprint(entrada.keyValue), {
      status: entrada.status,
      tags: entrada.tags ?? [],
    });
  }

  const cambios: IChange[] = [];
  const sinPareja: IReconcilableRow[] = [];

  for (const fila of filas) {
    const delTxt = porClave.get(keyFingerprint(fila.key_value));

    /*
     * Una clave que no esta en el TXT se deja como esta.
     *
     * No se marca para borrar ni para nada: lo mas probable es que se haya
     * anadido a mano —el TXT es de 2015 y la base es de ahora—, y borrar lo
     * que no aparece en un fichero viejo seria tirar trabajo. Se cuenta aparte
     * para que el script lo diga, y asi se ve que ha habido claves que el
     * reconciliador no ha mirado.
     */
    if (delTxt === undefined) {
      sinPareja.push(fila);
      continue;
    }

    const actuales = parseTags(fila.tags);

    /*
     * Las etiquetas del TXT que la clave aun no tiene.
     *
     * Se comparan en minuscula porque la app las guarda normalizadas asi, y
     * porque «Navidad» y «navidad» son la misma etiqueta puesta desde dos
     * sitios: si se数目earan como distintas, cada ejecucion del script
     * volveria a anadir la que falta y la base creeria cada vez mas.
     */
    const nuevas = delTxt.tags.filter(
      (tag) => !actuales.some((actual) => actual.toLowerCase() === tag.toLowerCase()),
    );

    const cambiaEstado = delTxt.status !== fila.status;

    if (!cambiaEstado && nuevas.length === 0) continue;

    cambios.push({
      id: fila.id,
      title: fila.title,
      before: fila.status,
      after: delTxt.status,
      tags: nuevas,
    });
  }

  return { cambios, sinPareja };
}

/**
 * Junta las etiquetas que ya tiene la clave con las nuevas.
 *
 * Las nuevas se **anaden**, nunca se reemplazan: las que se hayan puesto a
 * mano se quedan. Por eso esto vive fuera de `reconcileRows` — que calcula los
 * cambios sin tocar nada— y lo llama el script justo antes de escribir, donde
 * vuelve a leer las etiquetas del propio momento: entre el calculo y la
 * escritura la clave puede haber cambiado, y usar las de entonces escribiria
 * encima de algo que ya no era lo que se leyo.
 */
export function mergeTagsInto(
  actuales: readonly string[],
  nuevas: readonly string[],
): string[] {
  const juntas = [...actuales];

  for (const tag of nuevas) {
    if (!juntas.some((existente) => existente.toLowerCase() === tag.toLowerCase())) {
      juntas.push(tag);
    }
  }

  return juntas;
}

/**
 * Cuenta los cambios por tipo, para el resumen que imprime el script.
 *
 * Ordenado por cantidad de mayor a menor, que es como se lee una lista de
 * problemas: primero el patron que mas veces pasa, que es el que mas probable
 * sea un fallo del parser y no de los datos.
 */
export function summarizeChanges(
  cambios: readonly Pick<IChange, 'before' | 'after'>[],
): string {
  const cuenta = new Map<string, number>();

  for (const cambio of cambios) {
    const clave = `${cambio.before} -> ${cambio.after}`;
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }

  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([clave, n]) => `    ${clave.padEnd(28)} ${n}`)
    .join('\n');
}