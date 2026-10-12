/**
 * Los dialogos abiertos, del mas antiguo al mas reciente.
 *
 * Existe para que **Escape cierre el de encima**, y hay que decir mas de por
 * que.
 *
 * Todos los dialogos comparten `z-50`, asi que el de encima es el **ultimo** que
 * se abrio, no el de mayor indice. Y el orden de apertura no siempre se puede
 * adivinar: el panel de datos se abre **desde** Ajustes, asi que encima esta el
 * panel de datos; el editor se abre con `n` desde cualquier sitio, y encima de
 * lo que hubiera.
 *
 * Antes esto se hacia con una lista escrita a mano de los diez dialogos de la
 * app, en el orden en que se suponia que se apilaban, mas diez banderas en
 * `app.component` y diez funciones de cierre. Tres sitios que habia que
 * mantener de acuerdo para que una tecla cerrara el dialogo correcto, y sin
 * ninguna comprobacion: un dialogo nuevo que se olvidara en la lista se
 * quedaba sin cerrar con Escape, sin avisar.
 *
 * Y la lista estaba **mal**. Decia que Ajustes queda encima del panel de datos,
 * y es justo al reves: se llega al panel desde Ajustes. Con los dos abiertos, un
 * Escape cerraba Ajustes y dejaba el panel de datos solo en pantalla, con el
 * fondo oscurecido y sin forma de salir con la tecla que se acababa de usar.
 *
 * Aqui se apila cada dialogo al montarse, en el orden en que React lo monta —que
 * es el orden real en el que se abren— y se consulta el ultimo. No hay lista
 * que mantener y no puede quedar desfasada del arbol.
 */

/** Como cerrar un dialogo apilado. */
export type TCerrarDialogo = () => void;

interface IApilado {
  cerrar: TCerrarDialogo;
}

/**
 * De mas antiguo a mas reciente.
 *
 * Va como lista y no como objeto porque en JavaScript el orden de las claves de
 * un objeto no esta garantizado, y aqui el orden es lo unico que importa.
 */
const APILADOS: IApilado[] = [];

/**
 * Apila un dialogo y devuelve como quitarlo.
 *
 * Lo devuelve el `apilar` y no hay una funcion suelta de `desapilar` porque el
 * token es el que hay que quitar: quitar «el ultimo» o «el primero» por
 * posicion va mal cuando dos dialogos se abren y se cierran a la vez, que es lo
 * que pasa con el editor al abrir otro desde dentro.
 */
export function apilarDialogo(cerrar: TCerrarDialogo): () => void {
  const entrada: IApilado = { cerrar };

  APILADOS.push(entrada);

  return (): void => {
    const i = APILADOS.indexOf(entrada);

    if (i >= 0) APILADOS.splice(i, 1);
  };
}

/**
 * El dialogo que esta encima, o `undefined` si no hay ninguno.
 *
 * Los que no se cierran con Escape **no se apilan**: se filtran en
 * `apilarDialogo`, no al leer. Un dialogo que ignora la tecla sigue estando
 * encima de verdad, asi que filtrarlos al leer dejaria la pila diciendo que el
 * de debajo es el de encima y Escape no cerraria nada.
 */
export function dialogoSuperior(): TCerrarDialogo | undefined {
  for (let i = APILADOS.length - 1; i >= 0; i -= 1) {
    const entrada = APILADOS[i];

    if (entrada !== undefined) return entrada.cerrar;
  }

  return undefined;
}

/** Cuantos hay apilados. Para las guardas. */
export function cuantosDialogos(): number {
  return APILADOS.length;
}
