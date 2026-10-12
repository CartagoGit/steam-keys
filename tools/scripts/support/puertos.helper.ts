/**
 * Puertos de los dos servidores de desarrollo.
 *
 * Antes los dos usaban el mismo: `bun run dev` y `bun run web` arrancaban
 * Vite en 5273, con **distintas bases de datos**. Con el puerto compartido,
 * lanzar `web` mientras `dev` estaba vivo fallaba con un «Port is already in
 * use» a medias, y el peligro de verdad era otro: si ese mensaje pasaba
 * desapercibido, abrias el navegador contra el `dev` que ya estaba vivo y
 * creías estar tocando la coleccion buena mientras tocabas la de descarte.
 *
 * Con puertos distintos ese enredo no puede ocurrir: cada mando tiene el
 * suyo y la URL dice cuál es cuál sin tener que acordarse.
 *
 * Vive aqui y no duplicado en cada consumidor porque hay tres sitios que
 * necesitan el numero —Vite, el script de `web` y el `devUrl` de Tauri— y
 * solo dos se pueden enlazar entre si. El tercero es JSON, y de ahi el test
 * de este fichero.
 */

/** Puerto de `bun run dev`: la base de datos de trabajo, en `.dev/`. */
export const PUERTO_DEV = 4200;

/** Puerto de `bun run web`: la coleccion de verdad, en `dist/`. */
export const PUERTO_WEB = 4500;

/**
 * El puerto que le toca a Vite en este proceso.
 *
 * `web.script.ts` pasa `PUERTO_VITE` para que el hijo arranque en el puerto
 * del navegador sin tener que cambiar el de por defecto. Sin esto habria que
 * arrancar `vite --port 4500` a mano y el script perderia el control de a
 * que puerto esta mirando antes de lanzarlo.
 *
 * Un valor que no es un numero se ignora en vez de romper el arranque: es
 * mejor un aviso en consola que un Vite que no arranca con «port must be a
 * number» y ninguna pista de por que.
 */
export function puertoVite(): number {
  const crudo = process.env.PUERTO_VITE;

  if (crudo === undefined || crudo === '') return PUERTO_DEV;

  const valor = Number(crudo);

  if (!Number.isInteger(valor) || valor < 1 || valor > 65535) {
    console.warn(
      `  PUERTO_VITE="${crudo}" no es un puerto valido; se usa ${PUERTO_DEV}.`,
    );

    return PUERTO_DEV;
  }

  return valor;
}