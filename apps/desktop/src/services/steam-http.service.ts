/**
 * Cliente HTTP que habla con Steam a traves de Rust.
 *
 * Existe por un motivo concreto: `steamcommunity.com` no envia cabeceras CORS,
 * asi que desde el navegador la peticion se rechaza antes de salir. En la app
 * de escritorio hay `invoke`, que no tiene esa restriccion, y se usa.
 *
 * Cuando no hay Tauri —el navegador de `bun run dev`— no hay `invoke` y no hay
 * proxy, asi que se avisa con un mensaje claro en vez de dejar que falle con un
 * error de CORS que no dice nada.
 */

let invokeDisponible: boolean | null = null;

/**
 * `true` si de verdad hay una ventana de Tauri detras.
 *
 * No basta con que el modulo `invoke` se pueda importar: se importa bien
 * fuera de Tauri tambien, y al llamarlo ahi no hace nada y devuelve un
 * error raro. La senal fiable es el objeto global que Tauri inyecta, que solo
 * existe dentro de la app.
 */
function dentroDeTauri(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window
  );
}

async function hayInvoke(): Promise<boolean> {
  if (invokeDisponible !== null) return invokeDisponible;

  if (!dentroDeTauri()) {
    invokeDisponible = false;
    return false;
  }

  try {
    const modulo = await import('@tauri-apps/api/core');
    invokeDisponible = typeof modulo.invoke === 'function';
  } catch {
    // Sin Tauri —el navegador de `bun run dev`, o los tests de Bun— se usa
    // `fetch` directamente. No es error: solo hay dominios que el navegador no
    // deja leer.
    invokeDisponible = false;
  }

  return invokeDisponible;
}

/**
 * Coge el cuerpo de una peticion GET a Steam como texto.
 *
 * `signal` solo llega a la rama del navegador, y no por descuido: la otra es un
 * `invoke`, y el comando de Rust no es cancelable desde fuera — Tauri v2 no
 * expone forma de abortar un comando ya lanzado—. La verdad es que el comando
 * de Rust lleva su propio tiempo limite del lado de `ureq`, asi que no se
 * cuelga para siempre; pero desde Javascript no se puede cortar antes.
 *
 * Por eso, en la app de escritorio, resolver el nombre de un perfil **no** se
 * puede cancelar, y el indicador de carga se queda hasta que Steam conteste.
 * Es un caso lo bastante raro —un solo `GET` a un XML diminuto— como para no
 * construir un puente de cancelacion entero por el.
 */
export async function steamGet(
  ruta: string,
  signal?: AbortSignal,
): Promise<string> {
  if (await hayInvoke()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('steam_get', { ruta });
  }

  // Sin Tauri se intenta igualmente: `api.steampowered.com` si que manda
  // cabeceras CORS, asi que la biblioteca se puede leer desde el navegador.
  // Lo que no funciona es el XML del perfil, que es justo donde hace falta el
  // comando de Rust.
  const respuesta = await fetch(
    `https://${ruta}`,
    signal === undefined ? undefined : { signal },
  );

  if (!respuesta.ok) {
    // El estado va en el mensaje y no en una clase propia porque aqui no hay
    // quien lo distinga: el llamador —`resolveSteamId`— solo necesita saber
    // que fallo, y el detalle se enseña en el aviso de la app.
    throw new Error(`Steam respondio con el estado ${respuesta.status}`);
  }

  return respuesta.text();
}
