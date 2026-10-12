import { describe, expect, test } from 'bun:test';

import { DEFAULT_SETTINGS } from '@/services/settings.service';
import type { IKeyFilter } from '@/contracts';
import { AppTheme, AppLocale, DEFAULT_LOCALE, KeyPlatform, KeyScope, KeyStatus } from '@/contracts';
import { emptyFilter, filterKeys } from './filter-keys.helper';

/**
 * Tests de lo que se ve al abrir la app por primera vez.
 *
 * No prueban que se vea bonito: prueban que sea **igual en todas las
 * maquinas**. Con el tema en «el del sistema» lo que aparecia dependia de la
 * configuracion del escritorio de cada uno, y entonces «la ventana esta rara»
 * no se podia ni confirmar ni discutir sin mirar antes cual era el tema. Con
 * Nord hay una sola respuesta correcta.
 *
 * El idioma tampoco se deduce ya del navegador, y por el mismo motivo: el
 * castellano se abria en ingles en un equipo y al reves en otro segun quien
 * escribiera la URL. Ahora es ingles siempre, hasta que se cambie a mano.
 */
describe('la primera vez que se abre', () => {
  test('el tema es Nord, no el del sistema', () => {
    // `System` no es un valor aqui por accidente: es lo que habia antes y lo
    // que hace que la app se vea distinta en cada equipo.
    expect(DEFAULT_SETTINGS.theme).toBe(AppTheme.Nord);
    expect(DEFAULT_SETTINGS.theme).not.toBe(AppTheme.System);
  });

  test('el idioma es ingles', () => {
    expect(DEFAULT_SETTINGS.locale).toBe(DEFAULT_LOCALE);
    expect(DEFAULT_SETTINGS.locale).not.toBe(AppLocale.Es);
  });

  test('Nord esta entre los temas que se pueden elegir', () => {
    // Si el tema por defecto no estuviera en la lista, el selector marcaria
    // una opcion que no existe y no habria forma de volver a el.
    expect(AppTheme.Nord).toBeTruthy();
  });
});

/**
 * El filtro de plataforma y de estado: vacio es **todas**.
 *
 * Es lo que hace el desplegable multi y lo que no puede fallar sin que se note:
 * si vacio pasara a significar «ninguna», la app se abriria sin claves y el
 * boton, que pone «Todas», estaria mintiendo.
 */
describe('un filtro sin nada marcado no restringe', () => {
  /**
   * Un filtro que no toca nada, con la ambito en «todo».
   *
   * `emptyFilter` viene en «solo disponibles», que por definicion esconde las
   * regaladas. Aqui se mira solo la plataforma y el estado, asi que se parte
   * de «todo»; si no, el recuento de cuatro salia de dos y el test pasaba por
   * casualidad sin comprobar nada.
   */
  const todo = (): IKeyFilter => ({ ...emptyFilter(), scope: KeyScope.All });

  /** Cuatro claves repartidas para que cualquier filtro se note. */
  const claves = [
    { id: 1, platform: KeyPlatform.Steam, status: KeyStatus.Available, title: 'A', keyValue: 'A' },
    { id: 2, platform: KeyPlatform.Steam, status: KeyStatus.Gifted, title: 'B', keyValue: 'B' },
    { id: 3, platform: KeyPlatform.BattleNet, status: KeyStatus.Available, title: 'C', keyValue: 'C' },
    { id: 4, platform: KeyPlatform.BattleNet, status: KeyStatus.Gifted, title: 'D', keyValue: 'D' },
  ] as never[];

  test('sin plataformas marcadas salen todas', () => {
    expect(filterKeys(claves, { ...todo(), platforms: [] })).toHaveLength(4);
  });

  test('sin estados marcados salen todas', () => {
    expect(filterKeys(claves, { ...todo(), statuses: [] })).toHaveLength(4);
  });

  test('con una plataforma marcada salen solo las suyas', () => {
    expect(filterKeys(claves, { ...todo(), platforms: [KeyPlatform.Steam] })).toHaveLength(2);
  });

  test('con dos plataformas marcadas se suman, no se eligen', () => {
    expect(
      filterKeys(claves, { ...todo(), platforms: [KeyPlatform.Steam, KeyPlatform.BattleNet] }),
    ).toHaveLength(4);
  });

  test('un estado marcado y una plataforma marcada se cruzan', () => {
    const filtradas = filterKeys(claves, {
      ...todo(),
      platforms: [KeyPlatform.Steam],
      statuses: [KeyStatus.Available],
    });

    expect(filtradas).toHaveLength(1);
  });

  test('desmarcar la ultima vuelve a ensenarlo todo', () => {
    // El ciclo que hace el desplegable: marcar uno, desmarcarlo y comprobar
    // que la lista se recupera. Es el gesto que hace la persona al arrepentirse.
    const conUno = filterKeys(claves, { ...todo(), platforms: [KeyPlatform.Steam] });
    const sinNinguno = filterKeys(claves, { ...todo(), platforms: [] });

    expect(conUno).toHaveLength(2);
    expect(sinNinguno).toHaveLength(4);
  });
});