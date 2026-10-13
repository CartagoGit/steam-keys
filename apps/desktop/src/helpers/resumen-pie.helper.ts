import { KeyKind, KeyPlatform, KeyStatus, type IGameKey, type IKeyFilter } from '@/contracts';

/**
 * Lo que la lista que se esta mirando dice de si misma.
 *
 * No es el recuento de los menus de filtro —que va sobre la coleccion entera y
 * tiene que seguir diciendo «Gifted: 222» aunque el filtro activo sea ese
 * mismo— sino el de **lo que hay en pantalla ahora**, que es otra pregunta.
 *
 * Lo que se cuenta aqui sale de datos que ya estan en cada clave y que la
 * pantalla no ensefia en ningun sitio:
 *
 * - **titulos**: cuantas claves son del mismo juego. En una coleccion con 403
 *   claves y 356 titulos, 47 son repetidas —y saberlo importa: son copias
 *   para regalar, o error de importacion, y en las dos casos es un dato que
 *   hay que tener delante y que no sale en ninguna parte.
 * - **porPlataforma**: no solo Steam. Una coleccion de claves de Steam con 28
 *   de Guild Wars 2 y 2 de Battle.net esconde metades de juegos que no son de
 *   la plataforma que da nombre a la app.
 * - **destinatarios**: cuantas personas distintas han recibido algo. Es lo que
 *   convierte «222 regaladas» en un recuento con significado, y es la
 *   pregunta de para quien se colecciona esto.
 * - **duplicadas**: las claves cuyo titulo aparece mas de una vez. Es el
 *   complemento de `titulos` y se enseña solo si hay alguna.
 */
export interface IResumenPie {
  /** Cuantas claves se ven. */
  total: number;
  available: number;
  gifted: number;
  redeemed: number;
  expired: number;
  unknown: number;
  /** Cuantas son juego base y cuantas DLC. */
  games: number;
  addOns: number;

  /** Cuantos **titulos distintos** hay, sin importar cuantas claves tengan. */
  titulos: number;
  duplicadas: number;
  destinatarios: number;
  porPlataforma: Record<string, number>;
  steam: number;
  otras: number;
}

/**
 * Un recuento con todo a cero, de donde sale el de verdad.
 *
 * No se exporta: solo `resumenPie` lo necesita, para tener donde ir summing
 * sin tener que mirar si el campo ya existe antes de sumarlo. Exportarlo
 * ademas invites a que otro sitio se inventase el suyo, que es como acaba
 * un recuento con dos fuentes de verdad.
 */
function resumenVacio(): IResumenPie {
  return {
    total: 0,
    available: 0,
    gifted: 0,
    redeemed: 0,
    expired: 0,
    unknown: 0,
    games: 0,
    addOns: 0,
    titulos: 0,
    duplicadas: 0,
    destinatarios: 0,
    porPlataforma: {},
    steam: 0,
    otras: 0,
  };
}

/**
 * Cuenta lo que dice la lista que se esta mirando.
 *
 * Sale del mismo golpe que la lista, sin volver a recorrerla: quien llama ya
 * la tiene filtrada en la mano, y recorrerla otra vez para contar lo mismo
 * seria tirar el trabajo que acaba de hacer el filtro.
 *
 * Los titulos y los destinatarios se comparan **sin caja y sin espacios
 * sobrantes**, porque es como los trata el resto de la app: «Portal 2» y
 * «portal 2» son el mismo juego a efectos de contar repetidas, y «Ana» y
 * «  ana  » son la misma persona a efectos de decir para cuanta gente se
 * colecciono. Separarlas daria numeros que no cuadran con lo que se ve.
 */
export function resumenPie(visibles: readonly IGameKey[]): IResumenPie {
  const resumen = resumenVacio();

  const titulos = new Map<string, number>();
  const personas = new Set<string>();

  for (const clave of visibles) {
    resumen.total += 1;

    if (clave.parentTitle) resumen.addOns += 1;
    else resumen.games += 1;

    switch (clave.status) {
      case KeyStatus.Available:
        resumen.available += 1;
        break;
      case KeyStatus.Gifted:
        resumen.gifted += 1;
        break;
      case KeyStatus.Redeemed:
        resumen.redeemed += 1;
        break;
      case KeyStatus.Expired:
        resumen.expired += 1;
        break;
      default:
        resumen.unknown += 1;
    }

    const normal = clave.title.trim().toLowerCase();

    titulos.set(normal, (titulos.get(normal) ?? 0) + 1);

    const plataforma = clave.platform;

    resumen.porPlataforma[plataforma] = (resumen.porPlataforma[plataforma] ?? 0) + 1;

    if (plataforma === KeyPlatform.Steam) resumen.steam += 1;
    else resumen.otras += 1;

    const persona = clave.giftedTo?.trim().toLowerCase();

    if (persona !== undefined && persona !== '') personas.add(persona);
  }

  resumen.titulos = titulos.size;

  for (const veces of titulos.values()) {
    if (veces > 1) resumen.duplicadas += veces;
  }

  resumen.destinatarios = personas.size;

  return resumen;
}

/**
 * Un trozo de la linea del pie.
 *
 * Va con su cuenta y con lo que hace al pulsarlo, porque el numero por si solo
 * es un dato y el mismo numero con filtro es una forma de mirar la
 * coleccion: «28 Guild Wars 2» no dice nada hasta que se pincha y salen las 28.
 */
export interface ITrozoPie {
  /** Texto ya traducido con el numero dentro. */
  texto: string;
  /** `true` si el filtro de este tramo **ya** esta puesto. */
  activo: boolean;
  /**
   * `false` cuando el tramo es solo informacion y no se puede pulsar.
   *
   * Va como bandera y no se deduce de que `cambios` este vacio porque las dos
   * cosas significan distinto en cuanto haya un tramo que se mande vacio de
   * verdad: «este numero no hace nada» y «este boton no filtra nada» no son lo
   * mismo, y en pantalla uno no se pincha y el otro si.
   */
  pulsable: boolean;
  /**
   * Lo que se le pasa a `patchFilter` al pulsarlo.
   *
   * Ya resuelto —poner o quitar— en vez de un filtro crudo, porque **poner y
   * quitar no son la misma operacion**. Poner es `{ statuses: ['gifted'] }`;
   * quitar es `{ statuses: [] }`, porque `patchFilter` va por encima de lo que
   * hay y una lista vacia es lo que deja de filtrar por estado. Con el filtro
   * crudo en la mano y el `onClick` aplicando siempre el mismo, el boton
   * encendido no tiene manera de apagarse.
   *
   * Un tramo que es solo informacion lleva `{}`: no hay nada que mandar, y es
   * mejor eso que un `null` que obliga a comprobarlo en cada sitio.
   */
  cambios: Partial<IKeyFilter>;
}

/**
 * El filtro **neutral** de otro: el mismo quitado.
 *
 * Existe porque poner y quitar no son la misma operacion, y no basta con
 * mandar el filtro de vuelta: `patchFilter` va por encima de lo que hay, asi
 * que reponer `{ kind: 'dlc' }` sobre `{ kind: 'dlc' }` no cambia nada y el
 * boton se queda encendido sin manera de apagarse.
 *
 * Hay dos maneras de quitar, y por eso esta funcion y no un `{}` a pelo:
 *
 * - Una **lista** se quita dejandola vacia —`{ statuses: [] }`—, que es lo que
 *   `filterKeys` lee como «no filtrar por estado».
 * - Un **campo que no es lista** se quita poniendo su valor por defecto —
 *   `{ kind: KeyKind.All }`—. Devolver el mismo valor no lo quita de nada:
 *   seguiria dizendo «solo DLC».
 *
 * `scope` se deja como esta a proposito, y no por casualidad. Los tramos de
 * estado ya no lo tocan —no salen en el ambito «solo disponibles» precisamente
 * para no tener que—it, pero si llegara, devolverlo al valor de partida seria
 * cambiar un filtro que el usuario no ha tocado: lo puso el desde la barra, y
 * el boton del pie no tiene por que deshacerlo. Lo mismo con `search` y
 * `excluir`, que ningun tramo pone.
 */
export function apagarFiltro(filtro: Partial<IKeyFilter>): Partial<IKeyFilter> {
  const apagado: Record<string, unknown> = { ...filtro };

  for (const [clave, valor] of Object.entries(apagado)) {
    if (Array.isArray(valor)) apagado[clave] = [];
    else if (clave === 'kind') apagado[clave] = KeyKind.All;
  }

  return apagado as Partial<IKeyFilter>;
}

/**
 * Que clave de filtro pone para el `IKeyFilter` que se le pasa.
 *
 * Vive aqui y no en el componente para que el mismo `IResumenPie` sirva tanto
 * para pintar como para saber si un boton esta encendido, y no haya dos
 * lugares donde comprobar si algo coincide.
 */
function coincide(actual: IKeyFilter, filtro: Partial<IKeyFilter>): boolean {
  return Object.entries(filtro).every(([clave, valor]) => {
    const suyo = (actual as unknown as Record<string, unknown>)[clave];

    if (Array.isArray(valor)) {
      const lista = Array.isArray(suyo) ? suyo : [];

      return valor.length === lista.length && valor.every((v) => lista.includes(v));
    }

    return suyo === valor;
  });
}

export { coincide };