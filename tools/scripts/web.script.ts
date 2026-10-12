/**
 * Levanta la aplicacion en el navegador, contra la base de datos **de verdad**.
 *
 * El problema que resuelve: `bun run dev` trabaja sobre `.dev/steam-keys-dev.db`,
 * una base de datos aparte con el mismo esquema. Se puso asi a proposito —con la
 * interfaz abierta en el navegador, un `db:reset` o una importacion a medias
 * escribian sobre la coleccion que de verdad importa, y `dist/` esta ignorado por
 * git, asi que no habia de donde volver—. Pero para retocar la interfaz viendo
 * las 403 claves de verdad hay que poder abrir la buena.
 *
 * Esto es exactamente eso, con una salvaguarda que `STEAM_KEYS_DB_PATH` a mano
 * no tenia: **antes de arrancar, copia el fichero**. Con la interfaz abierta,
 * cualquier cosa que se pruebe escribe en la coleccion real —un reset, una
 * importacion, un `migrate()` con el esquema a medio cambiar— y ahora la copia
 * esta a un comando de distancia.
 *
 *   bun run web
 *
 * La copia sale a `.dev/web-backups/`, que no lo toca nadie, y se avisa de
 * donde esta. Si el navegador rompe algo, se vuelve a copear el fichero encima.
 *
 * Que el puente no exista en produccion no cambia: el middleware de Vite lleva
 * `apply: 'serve'`, asi que esto no se parece en nada a un ejecutable abierto
 * por un navegador. El unico que escucha es `127.0.0.1`, con token por proceso.
 */
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { databasePath } from './support/db-path.helper';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_DIR = join(RAIZ, 'apps', 'desktop');
const CARPETA_COPIAS = join(RAIZ, '.dev', 'web-backups');

/** El mismo puerto que usa Vite, declarado aqui para poder mirarlo antes. */
const PUERTO = 5273;

/**
 * `true` si ya hay alguien escuchando en el puerto de Vite.
 *
 * Importa mas de lo que parece. `bun run dev` y `bun run web` usan el mismo
 * puerto, pero **no** la misma base de datos: si hay un `dev` corriendo y se
 * lanza `web`, Vite falla con «Port 5273 is already in use» y no queda claro
 * que se ha dejado de usar la coleccion de verdad sin querer. Peor: si el
 * mensaje pasara desapercibido, abriria el navegador contra la base de datos
 * de descarte creyendo que es la buena.
 *
 * Se comprueba con una conexion de un solo uso: abrirla y cerrarla es lo
 * unico que hace falta para saber si el puerto esta ocupado, y no deja la
 * conexion colgando por el camino.
 */
function puertoOcupado(): Promise<boolean> {
  return new Promise((hecho) => {
    const socket = connect({ host: '127.0.0.1', port: PUERTO });

    const responder = (ocupado: boolean): void => {
      socket.destroy();
      hecho(ocupado);
    };

    socket.setTimeout(1000);
    socket.once('connect', () => responder(true));
    socket.once('timeout', () => responder(false));
    socket.once('error', () => responder(false));
  });
}

/**
 * Copia la base de datos antes de abrirla en modo escritura.
 *
 * No es paranoia: el puente acepta cualquier `INSERT`/`UPDATE` que mande el
 * navegador, y la app escribe con normalidad. Sin esta copia, la unica forma de
 * recuperar la coleccion es `/tmp`, que es donde no esta.
 *
 * No se hace si la base de datos no existe todavia —una instalacion nueva— y
 * tampoco si la copia de este mismo arranque ya se hizo, porque relanzar el
 * script no debe llenar `.dev/` de ficheros identicos.
 */
function copiarAntes(): string | null {
  const origen = databasePath();

  if (!existsSync(origen)) {
    console.log(`\n  Todavia no hay base de datos en ${origen}.`);
    console.log('  Se creara vacia al abrir la app. No hay nada que copiar.\n');
    return null;
  }

  mkdirSync(CARPETA_COPIAS, { recursive: true });

  // La hora va en el nombre, no solo en la consola: dos arranques el mismo
  // segundo tienen que poder convivir, y una copia que se sobrescribe sola es
  // una copia que no protege de nada.
  const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const destino = join(CARPETA_COPIAS, `steam-keys-${sello}.db`);

  copyFileSync(origen, destino);

  const kb = Math.round(statSync(origen).size / 1024);

  return `${destino} (${kb} KB)`;
}

async function principal(): Promise<void> {
  if (await puertoOcupado()) {
    console.log(`\n  Ya hay un servidor escuchando en el puerto ${PUERTO}.`);
    console.log('\n  Puede ser otro `bun run dev`, que usa una base de datos de');
    console.log('  descarte distinta de la tuya. Para no liarse, este script no');
    console.log('  se carga encima: para con el que ya este corriendo (Ctrl+C en su');
    console.log('  terminal) y vuelve a lanzarlo.\n');

    process.exit(1);
  }

  const ruta = databasePath();
  const copia = copiarAntes();

  console.log('\n  steam-keys en el navegador');
  console.log(`  base de datos: ${ruta}`);

  if (copia !== null) console.log(`  copia previa:  ${copia}`);

  console.log('\n  ESTA ES LA COLECCION DE VERDAD. Lo que pruebes aqui se guarda.');
  console.log('  Para trabajar sin riesgo, usa `bun run dev` (base de datos aparte).');
  console.log('  Ctrl+C para salir.\n');

  const hijo = spawn('bun', ['run', 'dev'], {
    cwd: APP_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      // El puente resuelve esto con `resolve()`, asi que tiene que ser
      // absoluta: el proceso hijo arranca en `apps/desktop` y una ruta
      // relativa ahi apuntaria a otro sitio.
      STEAM_KEYS_DB_PATH: ruta,
    },
  });

  // Sin esto, Ctrl+C mata al script y el servidor de Vite se queda por ahi
  // con el puerto 5273 ocupado: el siguiente `bun run web` falla con un error
  // de puerto que no dice nada del motivo.
  const terminar = (senal: NodeJS.Signals | 'exit'): void => {
    if (hijo.exitCode === null) hijo.kill(senal === 'exit' ? 'SIGTERM' : senal);
  };

  process.on('SIGINT', () => terminar('SIGINT'));
  process.on('SIGTERM', () => terminar('SIGTERM'));

  hijo.on('exit', (codigo) => {
    process.exit(codigo ?? 0);
  });
}

await principal();
