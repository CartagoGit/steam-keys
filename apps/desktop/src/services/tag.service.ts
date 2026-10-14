import { getRepository } from '@/repositories/repository.factory';
import { DuplicateTagError, normalizeTag, parseTagColor, presentaTag, type IGameKey, type ITag } from '@/contracts';
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
   *
   * `claves` es opcional y solo sirve para no releer la tabla: quien ya la
   * tiene cargada —la pantalla, al abrir— la pasa y el recuento sale de ahi.
   * Quien no, la lee. El resultado es el mismo en los dos casos.
   */
  async list(claves?: readonly IGameKey[]): Promise<readonly ITag[]> {
    const repository = await getRepository();

    /*
     * Las claves se leen una vez.
     *
     * Antes esta funcion hacia dos viajes por la misma tabla: uno para
     * `syncTagsFromKeys()` y otro para contar. Y como la pantalla carga las
     * claves por su cuenta en paralelo, eran tres. Con cuatrocientas filas y
     * por el puente de desarrollo eso son tres SELECT identicos que podian
     * ser uno.
     *
     * Quien ya las tiene en la mano las pasa y se ahorra el viaje. Quien no,
     * las lee —que es lo unico que puede hacer—, y el resultado es el mismo.
     */
    const propias = claves ?? (await repository.listAll());

    /*
     * El catalogo se lee **una vez** y se usa para las dos cosas.
     *
     * Antes se leia dos veces con la misma sentencia y una detrás de otra:
     * `syncTagsFromKeys()` lo leia para agrupar por nombre, y acto seguido
     * `listTags()` lo releia para pintar. La sincronizacion solo anade nombres
     * que falten y nunca toca un color, asi que lo que habia leido antes sigue
     * valiendo despues —salvo las filas que ella misma haya añadido, que no
     * existen hasta que se escriben—.
     */
    const delCatalogoInicial = await repository.listTags();

    const anadidas = await repository.syncTagsFromKeys(propias, delCatalogoInicial);

    /*
     * Si la sincronizacion ha anadido algo, se relee.
     *
     * Es el unico caso en que la lectura de antes queda corta: las etiquetas
     * que estaban solo en las claves no existen en la tabla hasta que se
     * escriben, y sin esta segunda lectura no saldrian en el catalogo hasta la
     * proxima vez que se pidiera —que es justo el fallo que el comentario de
     * `list()` dice querer evitar.
     *
     * Ocurre una vez por coleccion, no en cada arranque: en cuanto la
     * etiqueta esta en la tabla, la sincronizacion no anade nada y aqui no se
     * vuelve a leer.
     */
    const delCatalogo =
      anadidas > 0 ? await repository.listTags() : delCatalogoInicial;

    const cuenta = contarUsos(propias.map((clave) => clave.tags));

    /*
     * El nombre con el que **se ve** cada etiqueta.
     *
     * Sale de las claves, y no del catalogo, porque es ahi donde esta escrito
     * con la caja que le dio el usuario. El catalogo guarda lo que se escribio
     * la primera vez —«Cumplidos»— y usarlo para todo hacia que la etiqueta de
     * la fila, que pone «zapatazo», no se reconociera en el filtro ni en la
     * ficha.
     *
     * El de reserva tambien sale normalizado, y por el mismo motivo: una
     * etiqueta del catalogo que no lleva ninguna clave se veria con la caja
     * con la que se creo —«Zapatazo» al lado de «zapatazo» en la misma lista—
     * mientras que en cuanto se le pone a una clave ya sale de `parseTags`, en
     * minusculas. Dos formas de la misma palabra en el mismo sitio, que es
     * justo lo que hace ilegible el filtro.
     */
    /*
     * El nombre con el que **se ve** cada etiqueta sale del catalogo, y no de
     * las claves.
     *
     * Antes se buscaba en las claves y el nombre que ganaba era el primero que
     * aparecia en la lista, asi que «Zapatazo» y «zapatazo» se repartian la
     * pantalla segun el orden de las filas. Y despues de normalizar al leer,
     * ganaba siempre el de la clave —en minusculas— y un renombrado a «DLC»
     * se deshacia en el siguiente arranque.
     *
     * El catalogo es quien sabe como se llama cada etiqueta, porque es el unico
     * sitio donde se guarda el renombrado. Las claves guardan la clave, y para
     * ellas da igual: una clave es lo que se busca, no lo que se enseña.
     */
    return sortTags(
      delCatalogo.map((fila) => ({
        clave: fila.nombre,
        nombre: fila.titulo !== '' ? fila.titulo : fila.nombre,
        /*
         * El color se comprueba al leer y no al escribir, para que una base
         * editada a mano con cualquier cosa dentro de la columna se pinte sin
         * color en vez de romperse: lo que no es un `hex` se trata como si la
         * etiqueta no tuviera color elegido, que es justo lo que se ve entonces.
         */
        color: parseTagColor(fila.color),
        // Una etiqueta del catalogo que no lleva ninguna clave tiene cero usos:
        // es una etiqueta creada para usar despues, que es uno de los motivos
        // por los que existe el catalogo.
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
   * **No** crea la que ya esta, y avisa con `DuplicateTagError`. Que «Zapatazo»
   * y «zapatazo» no puedan acabar siendo dos filas no es un capricho del indice:
   * son la misma palabra, y con dos filas el filtro de una no encontraria la
   * otra, el color se pondria en una y no en la otra, y borrar una dejaria la
   * otra puesta.
   *
   * Se guarda la clave normalizada y, aparte, **la caja con la que se ha
   * escrito** como titulo. Sin lo segundo, crear «DLC» y luego buscar «dlc» son
   * la misma etiqueta pero solo se guarda una de las dos formas, y «se ha
   * creado» no podria distinguirse de «no ha pasado nada».
   *
   * Devuelve la clave ya normalizada, para que quien llama la use tal cual.
   */
  async create(entrada: string): Promise<string | null> {
    const titulo = presentaTag(entrada);
    const nombre = normalizeTag(titulo);

    if (nombre.length === 0) return null;

    const repository = await getRepository();

    /*
     * El «¿existe?» lo responde el propio `INSERT OR IGNORE`, y no una consulta
     * previa. Preguntar antes deja hueco para que entre las dos cosas otra
     * peticion cree la misma etiqueta, y entonces el aviso de «ya existe»
     * saldaria justo en el caso en que si se acaba de crear.
     */
    if (!(await repository.createTag(nombre, '', titulo))) {
      /*
       * El aviso lleva el nombre **por el que ya se conoce**, no el que se ha
       * escrito: si ya hay una «Zapatazo» y alguien intenta crear «zapatazo»,
       * el mensaje tiene que decir «Zapatazo», que es lo que hay en pantalla.
       * Salir con el texto nuevo haria pensar que hay dos.
       */
      const yaEsta = (await repository.listTags()).find(
        (fila) => fila.nombre === nombre,
      );

      throw new DuplicateTagError(
        yaEsta === undefined || yaEsta.titulo === ''
          ? (yaEsta?.nombre ?? nombre)
          : yaEsta.titulo,
      );
    }

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
   * nombre escrito no sirve —esta vacio, o es el mismo nombre con el mismo
   * aspecto—.
   *
   * **Renombrar «dlc» a «DLC» no es «no hay nada que renombrar».** Antes lo
   * era: las dos mitades se comparaban ya normalizadas y el servicio devolvia
   * `null` sin tocar nada, de modo que cambiar la caja de un nombre era
   * imposible —no habia sitio donde guardarla—. Ahora la clave puede ser la
   * misma y el titulo distinto, que es justo lo que hace que la ultima edicion
   * se quede, y devuelve `0` porque no ha tocado ninguna clave.
   */
  async rename(actual: string, nuevo: string): Promise<number | null> {
    const titulo = presentaTag(nuevo);
    const desde = normalizeTag(actual);
    const hasta = normalizeTag(titulo);

    if (titulo.length === 0) return null;

    // Mismo nombre y misma caja: no hay nada escrito ni que escribir.
    if (hasta === desde && titulo === presentaTag(actual)) return null;

    const repository = await getRepository();

    return repository.renameTag(desde, hasta, titulo);
  },

  /**
   * Cambia el color con el que se pinta una etiqueta.
   *
   * El color pasa por `parseTagColor`, que devuelve `''` para lo que no es un
   * `hex`. Asi, desde la interfaz no hay forma de guardar un color que la app no
   * sepa pintar, aunque el dato venga de una base editada a mano.
   */
  async setColor(clave: string, color: string): Promise<void> {
    const repository = await getRepository();

    await repository.setTagColor(clave, parseTagColor(color));
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