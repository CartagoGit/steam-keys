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
};