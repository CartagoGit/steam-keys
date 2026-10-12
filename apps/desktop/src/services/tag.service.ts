import { getRepository } from '@/repositories/repository.factory';
import { cleanTag, normalizeTag, type ITag } from '@/contracts';
import { contarUsos, sortTags } from '@/helpers/tags.helper';

/**
 * El catalogo de etiquetas: cuales existen y cuantas claves las usan.
 *
 * Se separa de `game-key.service` porque son cosas distintas. Aquel trabaja
 * con **claves** —alta, edicion, borrado— y este con el **vocabulario** de la
 * coleccion: que etiquetas hay, cual se crea, cual se deja de usar. Una
 * etiqueta sobrevive a que la ultima clave que la llevaba se borre, y eso
 * desde el servicio de claves no se puede ni expresar.
 *
 * El recuento de usos se hace aqui y no con un contador guardado, porque la
 * unica fuente de la verdad es la columna de cada clave. Un contador en la
 * tabla de etiquetas se desincroniza en cuanto una etiqueta se pone o se quita
 * por cualquier via, y entonces el boton de borrar —que avisa de cuantas
 * claves van a perder la etiqueta— diria una cifra que no es.
 */
export const tagService = {
  /**
   * Las etiquetas que existen, con su recuento y en el orden de pintarlas.
   *
   * Antes de devolverlas sincroniza: mete en el catalogo todo lo que ya usan
   * las claves. Sin eso, una coleccion con cuatrocientas claves tendria el
   * catalogo vacio la primera vez y sus decenas de etiquetas —«contexto»,
   * «promo winter»— no se podrian volver a marcar nunca. Es idempotente, asi
   * que llamarlo en cada apertura no cuesta nada.
   */
  async list(): Promise<readonly ITag[]> {
    const repository = await getRepository();

    await repository.syncTagsFromKeys();

    const [delCatalogo, claves] = await Promise.all([
      repository.listTags(),
      repository.listAll(),
    ]);

    const cuenta = contarUsos(claves.map((clave) => clave.tags));

    return sortTags(
      delCatalogo.map((fila) => ({
        nombre: fila.nombre,
        // Una etiqueta del catalogo que no lleva ninguna clave tiene cero
        // usos: es una etiqueta creada para usar despues, que es justo uno de
        // los motivos por los que existe el catalogo.
        usos: cuenta.get(fila.nombre) ?? 0,
      })),
    );
  },

  /**
   * Crea una etiqueta y la deja marcada en la seleccion.
   *
   * Se escribe **ya** en el catalogo, no solo en la seleccion del dialogo: si
   * se cancelara, se perderia una etiqueta que el usuario ha decidido que
   * existe. Un catalogo de etiquetas se parece mas a un conjunto de palabras
   * que a un borrador, y por eso vive en la base de datos.
   *
   * Devuelve el nombre ya limpio, para que quien llama lo use tal cual.
   */
  async create(entrada: string): Promise<string | null> {
    const nombre = cleanTag(entrada);

    if (nombre.length === 0) return null;

    const repository = await getRepository();

    // Con la clave primaria, «humble» y «Humble» no pueden ser dos filas, y
    // la que se guarda es la que se ha limpiado ya.
    await repository.createTag(nombre);

    return nombre;
  },

  /**
   * Quita la etiqueta de la coleccion entera.
   *
   * Devuelve cuantas claves se han visto afectadas, para poder decirselo al
   * usuario. No es un dato decorativo: si son treinta, «se ha quitado la
   * etiqueta» y «se ha quitado de 30 claves» no son el mismo aviso, y el
   * segundo es el que hace que la accion destructiva se entienda.
   */
  async remove(nombre: string): Promise<number> {
    const repository = await getRepository();

    return repository.deleteTag(normalizeTag(nombre));
  },

  /**
   * Renombra una etiqueta de toda la coleccion.
   *
   * Devuelve el numero de claves afectadas para poder decirlo, o `null` si el
   * nombre escrito no sirve —esta vacio, o es el mismo que ya tenia—. Un
   * `null` aqui no es un fallo: es «no hay nada que renombrar», y quien llama
   * lo trata cerrando el dialogo sin avisar.
   *
   * Se comparan los nombres ya normalizados, no los que ha escrito la persona.
   * Renombrar «Humble» a «humble» no es un cambio de nada, es el mismo
   * nombre con otra caja: sin esta comparacion se reescribirian cuarenta
   * claves para que no cambiasen.
   */
  async rename(actual: string, nuevo: string): Promise<number | null> {
    const desde = normalizeTag(actual);
    const hasta = cleanTag(nuevo);

    if (hasta.length === 0 || normalizeTag(hasta) === desde) return null;

    const repository = await getRepository();

    return repository.renameTag(desde, hasta);
  },

  /**
   * Si una etiqueta existe ya en el catalogo, bajo otro nombre o con otra
   * caja.
   *
   * Lo pregunta el dialogo de renombrado para avisar **antes** de escribir:
   * renombrar «dlc» a «dlc extra» cuando «dlc extra» ya existe no es un
   * renombrado, es una fusion que se lleva por delante el nombre viejo. Es una
   * accion valida, pero tiene que ser una decision y no un accidente de
   * tecleo.
   */
  async existe(nombre: string): Promise<boolean> {
    const repository = await getRepository();
    const limpio = normalizeTag(nombre);

    if (limpio.length === 0) return false;

    return repository.listTags().then((filas) =>
      filas.some((fila) => normalizeTag(fila.nombre) === limpio),
    );
  },
};