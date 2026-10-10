import { beforeEach, describe, expect, test } from 'bun:test';

import { parseLegacyTxt } from './parse-legacy-txt.helper';
import { serializeTags } from './normalize-text.helper';
import { KeySource } from '@/contracts/enums/key-source.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { MemoryGameKeyRepository } from '@/repositories/memory-game-key.repository';
import type { IImportRow } from '@/contracts/interfaces/import-summary.interface';

/**
 * Almacen en memoria que sustituye a `localStorage`, para poder ejercitar la
 * ruta de persistencia del repositorio sin un navegador.
 */
class AlmacenFalso {
  private datos = new Map<string, string>();

  getItem(clave: string): string | null {
    return this.datos.get(clave) ?? null;
  }

  setItem(clave: string, valor: string): void {
    this.datos.set(clave, valor);
  }

  removeItem(clave: string): void {
    this.datos.delete(clave);
  }

  clear(): void {
    this.datos.clear();
  }
}

const almacen = new AlmacenFalso();
(globalThis as { localStorage?: unknown }).localStorage = almacen;

/**
 * Regresion del fallo que hacia que la importacioniese por dos dialogos.
 *
 * Antes: `preview` leia el fichero A y `commit` volvia a abrir el dialogo para
 * leer el fichero B, de modo que lo que se confirmaba no era lo que se habia
 * previsualizado. Aqui se fija el invariante: previsualizar e importar tienen
 * que trabajar **sobre el mismo contenido**, sin volver a leer nada.
 *
 * Las claves son sinteticas: ninguna existe.
 */
const TXT = [
  '# 22-01-25',
  '',
  'Celeste - MQ7RT-29XKL-ZPN84',
  '- Hollow Knight - B4KMD-58RQW-LNCT3 - Olga',
  '',
  'EARTH DEFENSE FORCE 4.1',
  '{',
  'ZR92N-7JDMK-QPW45',
  'T7XBN2PLQW9MK4CR',
  '}',
  '',
  '.................FIN 4 Sesion de regalos...........................',
  '',
  'UWFGQ-7XPL3-9KMDR - Two Worlds II',
].join('\n');

/** Convierte el TXT en filas de importacion, igual que hace el servicio. */
function aFilas(contents: string, existentes: readonly string[]): readonly IImportRow[] {
  return parseLegacyTxt(contents, { existingKeys: existentes }).entries.map((entry) => ({
    title: entry.title,
    keyValue: entry.keyValue,
    platform: entry.platform,
    status: entry.status,
    source: KeySource.LegacyTxt,
    giftedTo: entry.giftedTo,
    parentTitle: entry.parentTitle,
    note: entry.note,
    tags: serializeTags(entry.tags),
    addedOn: entry.addedOn,
  }));
}

/** Simula lo que hace el servicio: previsualizar sin escribir. */
function previsualizar(contents: string, existentes: readonly string[]) {
  const filas = aFilas(contents, existentes);

  return {
    skipped: filas.length,
    duplicates: parseLegacyTxt(contents, { existingKeys: existentes }).stats.duplicates,
    available: filas.filter((f) => f.status === KeyStatus.Available).length,
    gifted: filas.filter((f) => f.status === KeyStatus.Gifted).length,
    inserted: 0,
  };
}

describe('importacion en dos pasos sobre el mismo contenido', () => {
  let repo: MemoryGameKeyRepository;

  beforeEach(() => {
    almacen.clear();
    repo = new MemoryGameKeyRepository();
  });

  test('la previsualizacion no escribe nada', async () => {
    const preview = previsualizar(TXT, await repo.listKeyValues());

    expect(preview.skipped).toBe(5);
    expect(preview.inserted).toBe(0);
    expect(await repo.countAll()).toBe(0);
  });

  test('lo previsualizado es exactamente lo que se importa', async () => {
    const preview = previsualizar(TXT, await repo.listKeyValues());

    const resumen = await repo.importRows(aFilas(TXT, await repo.listKeyValues()));

    expect(resumen.inserted).toBe(preview.skipped);
    expect(resumen.available).toBe(preview.available);
    expect(resumen.gifted).toBe(preview.gifted);
  });

  test('reimportar el mismo TXT no duplica nada', async () => {
    await repo.importRows(aFilas(TXT, await repo.listKeyValues()));
    expect(await repo.countAll()).toBe(5);

    // El parser ya descarta lo que existe, asi que al repositorio no le llega
    // ni una fila: el duplicado se cuenta una sola vez, en la capa de arriba.
    const existentes = await repo.listKeyValues();
    const segunda = parseLegacyTxt(TXT, { existingKeys: existentes });

    expect(segunda.entries).toHaveLength(0);
    expect(segunda.stats.duplicates).toBe(5);

    const resumen = await repo.importRows(aFilas(TXT, existentes));
    expect(resumen.inserted).toBe(0);
    expect(await repo.countAll()).toBe(5);
  });

  test('un TXT distinto en el segundo paso importaria mas claves', async () => {
    await repo.importRows(aFilas(TXT, await repo.listKeyValues()));

    const otro = 'Grim Dawn _ N8VQP-3KLMR-7XWZY';
    const preview = previsualizar(otro, await repo.listKeyValues());

    expect(preview.skipped).toBe(1);

    await repo.importRows(aFilas(otro, await repo.listKeyValues()));

    expect(await repo.countAll()).toBe(6);
  });

  test('se conservan los estados al importar', async () => {
    await repo.importRows(aFilas(TXT, await repo.listKeyValues()));

    const claves = await repo.listAll();

    expect(claves.filter((k) => k.status === KeyStatus.Available)).toHaveLength(4);
    expect(claves.filter((k) => k.status === KeyStatus.Gifted)).toHaveLength(1);
  });

  test('se conserva el destinatario y el juego padre', async () => {
    await repo.importRows(aFilas(TXT, await repo.listKeyValues()));

    const claves = await repo.listAll();

    expect(claves.find((k) => k.title === 'Hollow Knight')?.giftedTo).toBe('Olga');

    // Las claves del bloque `{ ... }` heredan el nombre de la cabecera.
    const dlc = claves.filter((k) => k.parentTitle === 'EARTH DEFENSE FORCE 4.1');
    expect(dlc).toHaveLength(2);
    expect(dlc.map((k) => k.title)).toEqual([
      'EARTH DEFENSE FORCE 4.1',
      'EARTH DEFENSE FORCE 4.1',
    ]);
  });
});

describe('la coleccion sobrevive a cerrar y reabrir la app', () => {
  beforeEach(() => {
    almacen.clear();
  });

  test('una instancia nueva recupera lo que habia guardado otra', async () => {
    const primera = new MemoryGameKeyRepository();
    await primera.importRows(aFilas(TXT, await primera.listKeyValues()));

    expect(await primera.countAll()).toBe(5);

    // Equivale a cerrar la app y volver a abrirla.
    const segunda = new MemoryGameKeyRepository();

    expect(await segunda.countAll()).toBe(5);
    expect((await segunda.listAll()).map((k) => k.title)).toContain('Celeste');
  });

  test('las claves se recuperan con su valor exacto, no enmascarado', async () => {
    const primera = new MemoryGameKeyRepository();
    await primera.importRows(aFilas(TXT, await primera.listKeyValues()));

    const segunda = new MemoryGameKeyRepository();
    const celeste = (await segunda.listAll()).find((k) => k.title === 'Celeste');

    expect(celeste?.keyValue).toBe('MQ7RT-29XKL-ZPN84');
  });

  test('editar una clave y reabrir conserva la edicion', async () => {
    const primera = new MemoryGameKeyRepository();
    await primera.importRows(aFilas(TXT, await primera.listKeyValues()));

    const celeste = (await primera.listAll()).find((k) => k.title === 'Celeste');
    if (!celeste) throw new Error('no se encontro la clave');

    await primera.setStatus(celeste.id, KeyStatus.Redeemed);

    const segunda = new MemoryGameKeyRepository();
    const recuperado = (await segunda.listAll()).find((k) => k.id === celeste.id);

    expect(recuperado?.status).toBe(KeyStatus.Redeemed);
  });
});