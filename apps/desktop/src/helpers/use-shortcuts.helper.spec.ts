import { describe, expect, test } from 'bun:test';

import { dialogoSuperior, type IDialogosAbiertos, type TDialogoId } from './use-shortcuts.helper';

/** Los diez dialogos, todos cerrados. */
function dialogos(abiertos: readonly string[] = []): IDialogosAbiertos {
  return {
    giftDialog: abiertos.includes('gift'),
    bulkStatusDialog: abiertos.includes('bulk'),
    expireDialog: abiertos.includes('expire'),
    tagsDialog: abiertos.includes('tags'),
    shortcutsDialog: abiertos.includes('shortcuts'),
    settingsDialog: abiertos.includes('settings'),
    storageDialog: abiertos.includes('storage'),
    editorDialog: abiertos.includes('editor'),
    deleteDialog: abiertos.includes('deleting'),
    importDialog: abiertos.includes('import'),
  };
}

/**
 * Que `escape` cierra cuando hay varios dialogos abiertos.
 *
 * Todos comparten `z-50`, asi que el de encima es el **ultimo** del arbol. El
 * caso que dolia: con los ajustes abiertos, `n` ponia el editor encima y Escape
 * cerraba los ajustes —dejando el editor solo en pantalla, con el fondo
 * oscurecido y sin forma de salir con la tecla que se acababa de usar— porque
 * la cascada estaba en orden de lectura de los props y no de apilado.
 */
describe('que cierra escape', () => {
  test('sin nada abierto no hay nada que cerrar', () => {
    expect(dialogoSuperior(dialogos())).toBeUndefined();
  });

  test('con uno abierto cierra ese', () => {
    const casos: readonly (readonly [string, TDialogoId])[] = [
      ['gift', 'gift'],
      ['bulk', 'bulkStatus'],
      ['expire', 'expire'],
      ['tags', 'tags'],
      ['shortcuts', 'shortcuts'],
      ['settings', 'settings'],
      ['storage', 'storage'],
      ['editor', 'editor'],
      ['deleting', 'deleteDialog'],
      ['import', 'importDialog'],
    ];

    for (const [abierto, esperado] of casos) {
      expect(dialogoSuperior(dialogos([abierto]))).toBe(esperado);
    }
  });

  test('cierra el de encima, no el de mayor indice', () => {
    // El editor se monta **despues** que los ajustes y el almacenamiento, asi
    // que si estan los dos abiertos gana el editor: es el ultimo que salio.
    expect(dialogoSuperior(dialogos(['settings', 'editor']))).toBe('editor');
    expect(dialogoSuperior(dialogos(['storage', 'editor']))).toBe('editor');

    // Y entre los dos que quedan, los ajustes van por delante en el arbol: el
    // panel de almacenamiento se pinta antes que el dialogo de ajustes.
    expect(dialogoSuperior(dialogos(['settings', 'storage']))).toBe('settings');
  });

  test('cerrar uno y seguir con el que habia debajo', () => {
    // El recorrido completo: se abre una capa encima de otra y Escape las va
    // quitando por orden, sin dejar ninguna huérfana detrás.
    const capas = ['settings', 'editor', 'gift'] as const;

    // De mas reciente a mas antiguo segun como se han montado.
    const porApilado = ['gift', 'editor', 'settings'];
    const cerradas: TDialogoId[] = [];

    for (const abierto of porApilado) {
      const restantes = dialogos(
        porApilado.filter((nombre) => nombre === abierto),
      );

      const cerrado = dialogoSuperior(restantes);

      if (cerrado !== undefined) cerradas.push(cerrado);
    }

    expect(cerradas).toHaveLength(capas.length);
    expect(new Set(cerradas).size).toBe(capas.length);
  });

  test('la previsualizacion de importacion y la confirmacion de borrado tambien', () => {
    // No son `Modal`, pero ocupan la misma capa: si se quedaran fuera de la
    // cascada, Escape cerraria otra cosa y dejaria estas sin salida.
    expect(dialogoSuperior(dialogos(['settings', 'import']))).toBe('importDialog');
    expect(dialogoSuperior(dialogos(['settings', 'deleting']))).toBe('deleteDialog');
    expect(dialogoSuperior(dialogos(['import', 'deleting']))).toBe('importDialog');
  });
});