import { describe, expect, test } from 'bun:test';


import { apilarDialogo, cuantosDialogos, dialogoSuperior } from './dialogos.helper';

/**
 * Que `Escape` cierra cuando hay varios dialogos abiertos.
 *
 * Todos comparten `z-50`, asi que el de encima es el **ultimo que se abrio**,
 * que es justo el orden en que se apilan. Antes esto lo decidia una lista
 * escrita a mano con los diez dialogos de la app, y por eso hacia dos cosas
 * mal:
 *
 * - Un dialogo nuevo que se olvidara en la lista se quedaba **sin cerrar con
 *   Escape**, sin avisar: el boton de cerrar estaba, pero la tecla no hacia
 *   nada y no habia forma de saber que faltaba algo.
 * - La lista decia que Ajustes queda encima del panel de datos, y es al
 *   reves —al panel de datos se llega **desde** Ajustes—. Con los dos
 *   abiertos, Escape cerraba Ajustes y dejaba el panel de datos solo en
 *   pantalla, con el fondo oscurecido y sin forma de salir con la tecla.
 *
 * Aqui no hay lista: cada `Modal` se apila al montarse.
 */
describe('que cierra escape', () => {
  test('sin nada abierto no hay nada que cerrar', () => {
    expect(dialogoSuperior()).toBeUndefined();
    expect(cuantosDialogos()).toBe(0);
  });

  test('con uno abierto cierra ese', () => {
    let cerrados = 0;
    const quitar = apilarDialogo(() => { cerrados += 1; });

    dialogoSuperior()?.();

    expect(cerrados).toBe(1);

    quitar();
  });

  test('cierra el ultimo que se abrio, no el de mayor indice', () => {
    const orden: string[] = [];
    const quitarPrimero = apilarDialogo(() => orden.push('ajustes'));
    const quitarSegundo = apilarDialogo(() => orden.push('datos'));

    // El panel de datos se abre **desde** Ajustes, asi que encima esta el.
    dialogoSuperior()?.();
    quitarSegundo();

    dialogoSuperior()?.();
    quitarPrimero();

    expect(orden).toEqual(['datos', 'ajustes']);
  });

  test('cerrar uno deja al que habia debajo, y ninguno huerfano', () => {
    const orden: string[] = [];
    const quitar = ['ajustes', 'datos', 'editor'].map((capa) =>
      apilarDialogo(() => orden.push(capa)),
    );

    // Se van cerrando de uno en uno, como haria Escape.
    while (cuantosDialogos() > 0) {
      dialogoSuperior()?.();
      quitar.pop()?.();
    }

    expect(orden).toEqual(['editor', 'datos', 'ajustes']);
    expect(cuantosDialogos()).toBe(0);
  });

  test('cada uno sale por su ficha, no por su posicion', () => {
    // Dos dialogos que se abren y se cierran a la vez —el editor abriendo otro
    // desde dentro— no pueden quitar «el ultimo» ni «el primero» por posicion:
    // el que se cierra es el que entro con su propia ficha.
    const fechas: string[] = [];
    const quitarA = apilarDialogo(() => fechas.push('A'));
    const quitarB = apilarDialogo(() => fechas.push('B'));

    quitarA();
    dialogoSuperior()?.();
    quitarB();

    expect(fechas).toEqual(['B']);
    expect(cuantosDialogos()).toBe(0);
  });

  test('quitar dos veces el mismo no lo descuadra', () => {
    const quitar = apilarDialogo(() => undefined);

    quitar();
    quitar();

    apilarDialogo(() => undefined);

    expect(cuantosDialogos()).toBe(1);
  });
});
