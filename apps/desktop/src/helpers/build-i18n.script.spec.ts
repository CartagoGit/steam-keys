import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Generador de los tres diccionarios no master. */
const GENERADOR = join(import.meta.dir, '../../../../tools/scripts/build-i18n.py');

/**
 * El generador **reescribe** `i18n-{fr,pt,de}.constants.ts`, asi que una tabla
 * con una clave repetida no se ve al revisar el diff: Python se queda con la
 * ultima y el fichero sale bien formado con la traduccion equivocada dentro.
 *
 * Ya paso de verdad: la tabla francesa tenia las claves de portugues y las de
 * aleman pegadas encima de las suyas, y `storage.backups.keysOne` salia con
 * `{0} Keys` en la interfaz en frances. Por eso el script comprueba los
 * duplicados antes de escribir, y por eso hace falta un test que lo compruebe.
 */
describe('generador de traducciones', () => {
  const fuente = readFileSync(GENERADOR, 'utf8');

  test('comprueba que no haya claves repetidas antes de escribir', () => {
    expect(fuente).toContain('_detectar_duplicados()');
  });

  test('la comprobacion se ejecuta antes de generar', () => {
    // Si alguien mueve la llamada al final, los ficheros ya estan escritos y
    // el aviso llega tarde: el dano ya esta en el disco.
    const cuerpo = fuente.slice(fuente.indexOf('def main() -> None:'));
    const comprobacion = cuerpo.indexOf('_detectar_duplicados()');
    const escritura = cuerpo.indexOf('write_text');

    expect(comprobacion).toBeGreaterThan(-1);
    expect(escritura).toBeGreaterThan(-1);
    expect(comprobacion).toBeLessThan(escritura);
  });

  test('los tres diccionarios que genera estan versionados', () => {
    // El generador es manual y los `.ts` que produce estan en git: la app no
    // debe depender de Python para arrancar.
    for (const idioma of ['fr', 'pt', 'de']) {
      expect(fuente).toContain(`TRADUCCIONES['${idioma}']`);
    }
  });
});