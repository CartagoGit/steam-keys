import { describe, expect, test } from 'bun:test';

import { normalizarClaveApi, normalizarIdSteam } from './steam-input.helper';

describe('limpiar la clave de la API', () => {
  test('quita los espacios de los extremos', () => {
    expect(normalizarClaveApi('  ABC123  ')).toBe('ABC123');
  });

  test('quita los espacios de en medio', () => {
    // Una clave de la API son 32 hexadecimales y nada mas. Un espacio en medio
    // no es parte de la clave: es un fallo al pegar, y dejarlo solo produce un
    // error de autenticacion mas tarde sin explicar nada.
    expect(normalizarClaveApi('ABC1 23DEF')).toBe('ABC123DEF');
  });

  test('se come el salto de linea de un pegado desde un archivo de texto', () => {
    expect(normalizarClaveApi('ABC123\n')).toBe('ABC123');
    expect(normalizarClaveApi('\n\nABC123')).toBe('ABC123');
    expect(normalizarClaveApi(' ABC\t123\r\n')).toBe('ABC123');
  });

  test('una clave normal no se toca', () => {
    const clave = '0123456789ABCDEF0123456789ABCDEF';

    expect(normalizarClaveApi(clave)).toBe(clave);
  });

  test('no distingue mayusculas de minusculas', () => {
    // Solo quita espacios: si bajara la clave, la que se guardo seria otra y
    // la conexion dejaria de funcionar sin explicacion.
    expect(normalizarClaveApi('AbCdEf')).toBe('AbCdEf');
  });

  test('una cadena de espacios se queda vacia', () => {
    expect(normalizarClaveApi('   ')).toBe('');
  });
});

describe('limpiar el ID o nombre de perfil', () => {
  test('quita los espacios de los extremos', () => {
    expect(normalizarIdSteam('  half-life  ')).toBe('half-life');
    expect(normalizarIdSteam('76561198023249625 ')).toBe('76561198023249625');
  });

  test('respeta el guion y el punto, que si valen', () => {
    expect(normalizarIdSteam(' half-life-2 ')).toBe('half-life-2');
    expect(normalizarIdSteam(' mi.perfil ')).toBe('mi.perfil');
  });

  test('un espacio en medio no se quita', () => {
    // El campo lo marca como invalido. Arreglarlo en silencio convertiria un
    // error visible en uno invisible.
    expect(normalizarIdSteam('half  life')).toBe('half  life');
  });

  test('cadenas de espacios sueltos tambien fuera', () => {
    expect(normalizarIdSteam('\t  half-life  \n')).toBe('half-life');
  });

  test('una cadena de espacios se queda vacia', () => {
    expect(normalizarIdSteam('   ')).toBe('');
  });
});