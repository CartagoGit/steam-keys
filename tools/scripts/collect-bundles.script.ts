/**
 * Copia los bundles de Tauri a `dist/` en la raiz del proyecto.
 *
 * Tauri deja los instaladores donde le apetece:
 *
 *   apps/desktop/src-tauri/target/<target>/release/bundle/nsis/*.exe
 *   apps/desktop/src-tauri/target/<target>/release/bundle/msi/*.msi
 *
 * y no hay forma de cambiarlo: el CLI de Tauri 2 rechaza tanto la propiedad
 * `bundle.distDir` del `tauri.conf.json` como el flag `--out-dir` de
 * `tauri build`. Como el proyecto promise que los artefactos estan en `dist/`,
 * este script los bringa ahi.
 *
 *   bun run collect:bundles
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

/** Donde Tauri deja el ejecutable y los instaladores. */
const ORIGEN = join(
  'apps',
  'desktop',
  'src-tauri',
  'target',
  'x86_64-pc-windows-msvc',
  'release',
);

/** Destino promestado por el README. */
const DESTINO = 'dist';

/** Formatos de instalador que nos interesan. */
const FORMATOS = ['nsis', 'msi'];

/** Lista los ficheros de un directorio, sin fallar si no existe. */
function listar(ruta: string): string[] {
  if (!existsSync(ruta)) return [];

  return readdirSync(ruta)
    .map((nombre) => join(ruta, nombre))
    .filter((fichero) => statSync(fichero).isFile());
}

function principal(): void {
  if (!existsSync(ORIGEN)) {
    console.error(
      `No hay nada compilado todavia.\n` +
        `Se esperaba encontrar artefactos en: ${ORIGEN}\n` +
        `Compila primero con "bun run build:windows" o "bun run build:windows:docker".`,
    );
    process.exitCode = 1;
    return;
  }

  mkdirSync(DESTINO, { recursive: true });

  let total = 0;

  // El ejecutable: siempre esta, incluso si el instalador no se pudo generar.
  const ejecutable = join(ORIGEN, 'steam-keys.exe');

  if (existsSync(ejecutable)) {
    cpSync(ejecutable, join(DESTINO, 'steam-keys.exe'));
    total += 1;
    console.log(`${relative('.', join(DESTINO, 'steam-keys.exe'))}`);
  }

  // Los instaladores, si los hay.
  for (const formato of FORMATOS) {
    const origen = join(ORIGEN, 'bundle', formato);

    for (const fichero of listar(origen)) {
      const destino = join(DESTINO, basename(fichero));
      cpSync(fichero, destino);
      total += 1;
      console.log(`${relative('.', destino)}`);
    }
  }

  if (total === 0) {
    console.error(
      `La carpeta de compilacion existe pero no hay ni .exe ni instaladores en: ${ORIGEN}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n${total} artefacto(s) en ${DESTINO}/`);
}

principal();