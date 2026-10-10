/**
 * Copias de seguridad de la base de datos, desde la terminal.
 *
 *   bun run backup:list
 *   bun run backup:now -- antes-de-importar
 *   bun run backup:restore -- steam-keys-20261010-153427-manual.db
 *   bun run backup:prune -- 5
 *
 * Replica la misma logica que los comandos de Rust, para poder comprobar el
 * estado de las copias desde WSL o desde una sesion de terminal.
 */
import { existsSync, mkdirSync, copyFileSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';

import { databasePath, appConfigDir } from './support/db-path.helper';

const BACKUP_DIR = join(appConfigDir(), 'backups');
const MAX_BACKUPS = 10;

const args = process.argv.slice(2);
const comando = args[0] ?? 'list';
const MAX_LEN = 120;

/** Mismo criterio de seguridad que en Rust: nada de rutas ni de escapes. */
function nombreSeguro(nombre: string): boolean {
  if (nombre.length === 0 || nombre.length > MAX_LEN) return false;
  if (!nombre.endsWith('.db')) return false;
  if (nombre.includes('..')) return false;

  return /^[A-Za-z0-9._-]+$/.test(nombre);
}

function listar(): string[] {
  if (!existsSync(BACKUP_DIR)) return [];

  return readdirSync(BACKUP_DIR)
    .filter((nombre) => nombreSeguro(nombre))
    .sort()
    .reverse();
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

function listarCopias(): void {
  const copias = listar();

  console.log('Base de datos :', databasePath());
  console.log('Carpeta      :', BACKUP_DIR);
  console.log('');

  if (copias.length === 0) {
    console.log('No hay copias de seguridad.');
    return;
  }

  console.log(`Copias (${copias.length}/${MAX_BACKUPS}):`);

  for (const nombre of copias) {
    const ruta = join(BACKUP_DIR, nombre);
    const fecha = statSync(ruta).mtime;

    console.log(
      `  ${nombre.padEnd(46)} ${kb(statSync(ruta).size).padStart(9)}  ` +
        `${fecha.toISOString().replace('T', ' ').slice(0, 16)}`,
    );
  }
}

function crear(motivo: string): void {
  const origen = databasePath();

  if (!existsSync(origen)) {
    console.error(`No hay base de datos que respaldar: ${origen}`);
    process.exit(1);
  }

  mkdirSync(BACKUP_DIR, { recursive: true });

  const ahora = new Date();
  const sello =
    ahora.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

  const sufijo =
    motivo
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 24) || 'manual';

  let nombre = `steam-keys-${sello}-${sufijo}.db`;
  let intento = 2;
  while (existsSync(join(BACKUP_DIR, nombre))) {
    nombre = `steam-keys-${sello}-${sufijo}-${intento}.db`;
    intento += 1;
  }

  const destino = join(BACKUP_DIR, nombre);
  copyFileSync(origen, destino);

  console.log('Copia creada:', destino);
  console.log('Tamaño      :', kb(statSync(destino).size));

  rotar();
}

function rotar(): void {
  const copias = listar();

  if (copias.length <= MAX_BACKUPS) return;

  for (const sobra of copias.slice(MAX_BACKUPS)) {
    unlinkSync(join(BACKUP_DIR, sobra));
    console.log('Copia antigua eliminada:', sobra);
  }
}

/**
 * Restaura una copia.
 *
 * No se copia encima de la base de datos viva: la app puede tenerla abierta y
 * SQLite se quedaria con una referencia obsoleta. La copia se deposita como
 * `restore-candidate.db` para que la app la fusione con su propia conexion.
 */
function restaurar(nombre: string): void {
  const base = basename(nombre);

  if (!nombreSeguro(base)) {
    console.error('Nombre de copia no valido.');
    process.exit(1);
  }

  const origen = join(BACKUP_DIR, base);

  if (!existsSync(origen)) {
    console.error(`La copia ${base} ya no existe.`);
    process.exit(1);
  }

  const destino = join(appConfigDir(), 'restore-candidate.db');
  copyFileSync(origen, destino);

  console.log('Copia preparada para restaurar:', destino);
  console.log('');
  console.log('Cierra la app y vuelve a abrirla: fusionara las claves de la copia');
  console.log('con tu coleccion actual sin borrar nada.');
}

// --------------------------------------------------------------------- main ---

switch (comando) {
  case 'list':
    listarCopias();
    break;

  case 'now':
    crear(args[1] ?? 'manual');
    break;

  case 'prune': {
    const limite = Number(args[1] ?? MAX_BACKUPS);
    const copias = listar();

    if (!Number.isFinite(limite) || limite < 1) {
      console.error('El limite debe ser un numero mayor que cero.');
      process.exit(1);
    }

    for (const sobra of copias.slice(limite)) {
      unlinkSync(join(BACKUP_DIR, sobra));
      console.log('Eliminada:', sobra);
    }
    console.log(`Se conservan ${Math.min(copias.length, limite)} copia(s).`);
    break;
  }

  case 'restore':
    if (!args[1]) {
      console.error('Falta el nombre de la copia. Usa "bun run backup:list".');
      process.exit(1);
    }
    restaurar(args[1]);
    break;

  default:
    console.error(`Comando desconocido: ${comando}`);
    console.error('Disponibles: list, now, prune, restore');
    process.exit(1);
}