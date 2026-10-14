import { useCallback, useState } from 'react';

import { DuplicateTagError, type ITag, type Translator } from '@/contracts';
import { pluralKey } from './i18n.helper';

/**
 * Lo que el hook necesita del mundo exterior.
 *
 * Van por parametro y no importadas por capas, como en `use-arranque`,
 * `use-keys` y `use-selection`: un hook en `helpers/` solo puede mirar
 * `contracts`. Los servicios se los pasa el componente, que si puede importarlos.
 */
export interface IUseTagsInsumos {
  create: (nombre: string) => Promise<string | null>;
  remove: (nombre: string) => Promise<number>;
  rename: (actual: string, nuevo: string) => Promise<number | null>;
  existe: (nombre: string) => Promise<boolean>;
  setColor: (clave: string, color: string) => Promise<void>;
  /** El catalogo entero, ya con las claves que usan cada etiqueta. */
  list: () => Promise<readonly ITag[]>;
  /**
   * Envoltura de las acciones: apaga botones, enciende el indicador y avisa si
   * se cancelaron.
   *
   * Devuelve `{ ok: false }` en vez de lanzar cuando el usuario cancela, porque
   * cancelar no es un error y no debe salir un aviso rojo por ello. Un `throw`
   * de verdad si se captura, y sale por el aviso.
   */
  conCarga: <T>(
    label: string,
    accion: (senal: AbortSignal) => Promise<T>,
  ) => Promise<{ ok: true; valor: T } | { ok: false }>;
  /** Vuelve a pedir la lista de claves. Solo hace falta si las cambia una accion. */
  reload: () => Promise<unknown>;
  /** Enseña un aviso. */
  notify: (message: string, tone?: 'info' | 'success' | 'error') => void;
  traducir: Translator;
}

export interface IUseTags {
  /** El catalogo, con su recuento de usos. */
  tags: readonly ITag[];
  /** Crea una etiqueta. Devuelve el nombre normalizado, o `null` si fallo o se cancelo. */
  createTag: (nombre: string) => Promise<string | null>;
  /** Quita una etiqueta. Devuelve cuantas claves tocaba. */
  removeTag: (nombre: string) => Promise<number>;
  /** Renombra una etiqueta. Devuelve cuantas claves tocaba, o `null`. */
  renameTag: (actual: string, nuevo: string) => Promise<number | null>;
  /** `true` si la etiqueta ya existe en el catalogo. */
  tagExists: (nombre: string) => Promise<boolean>;
  /** Cambia el tono de una etiqueta. */
  colorTag: (clave: string, color: string) => Promise<void>;
  /**
   * `true` cuando el catalogo viene de la lista de claves y no de una lectura
   * propia. Lo usa el arranque para no leerlo dos veces.
   */
  setTags: (tags: readonly ITag[]) => void;
}

/**
 * El catalogo de etiquetas, y las acciones que lo cambian.
 *
 * Antes eran un `useState` y seis `useCallback` en el componente, y tenian un
 * detalle importante repartido por dos sitios: **cual de ellas recarga la lista
 * de claves** y cual no. Quitar y renombrar tocan claves de toda la coleccion,
 * asi que dejan obsoleta la lista entera; colorear no, porque el color vive en
 * el catalogo y no en la columna `tags` de las claves.
 *
 * Esa distincion estaba en un comentario al lado de `reload()` y en otro al
 * lado de `colorTag`, y no en el codigo. Aqui las dos acciones que recargan
 * llevan el `reload()` **dentro**, asi que no se puede llamar a una y olvidar
 * la otra: era el fallo mas facil de cometer al anadir una accion nueva.
 *
 * El catalogo se carga **con** la lista de claves, no aparte: leerlo al abrir
 * el dialogo de etiquetas daria un parpadeo de «cargando» cada vez que se
 * quisiera etiquetar algo, y antes se leia dos veces al arrancar.
 */
export function useTags(insumos: IUseTagsInsumos): IUseTags {
  const { conCarga, notify, reload, traducir } = insumos;

  const [tags, setTags] = useState<readonly ITag[]>([]);

  /*
   * Vuelve a pedir el catalogo y avisa si no pudo.
   *
   * El dialogo de etiquetas pinta lo que hay en este estado, asi que despues
   * de crear o de quitar hay que volver a pedirlo: si no, la etiqueta nueva se
   * veria marcada pero no saldria en la lista, y la quitada seguiria
   * apareciendo hasta que se cerrara y se abriera el dialogo otra vez.
   */
  const reloadTags = useCallback(async (): Promise<void> => {
    try {
      setTags(await insumos.list());
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.loadFailed'),
        'error',
      );
    }
  }, [insumos, notify, traducir]);

  const createTag = useCallback(
    async (nombre: string): Promise<string | null> => {
      try {
        const r = await conCarga('loading.saving', () => insumos.create(nombre));

        if (!r.ok) return null;

        await reloadTags();

        return r.valor;
      } catch (cause) {
        /*
         * La etiqueta repetida tiene su propio aviso, y no el generico.
         *
         * Sin esto salia «No se ha podido guardar», que no dice nada: quien
         * ha escrito «Zapatazo» no sabe si fallo por eso o porque ya existia,
         * y la diferencia es enorme —una se corrige escribiendo otra cosa y la
         * otra no se corrige de ninguna forma, porque la etiqueta ya esta y
         * solo hay que marcarla—. El mensaje lleva el nombre por el que ya se
         * conoce, no el que se ha escrito, que es lo que hay en pantalla.
         */
        if (cause instanceof DuplicateTagError) {
          notify(traducir('tags.duplicate', [cause.existente]), 'error');

          return null;
        }

        notify(
          cause instanceof Error ? cause.message : traducir('app.saveFailed'),
          'error',
        );

        return null;
      }
    },
    [insumos, conCarga, notify, reloadTags, traducir],
  );

  const removeTag = useCallback(
    async (nombre: string): Promise<number> => {
      try {
        const r = await conCarga('loading.tags', () => insumos.remove(nombre));

        if (!r.ok) return 0;

        const afectadas = r.valor;

        // Quitar una etiqueta toca claves de toda la coleccion, no solo las
        // seleccionadas, asi que la lista entera se queda obsoleta. Sin
        // recargar, las filas seguirian mostrando una etiqueta que ya no
        // tienen. Las dos lecturas van a la vez porque no dependen una de otra.
        await Promise.all([reloadTags(), reload()]);

        notify(
          traducir(
            pluralKey(afectadas, 'tags.removedOne', 'tags.removedMany'),
            [afectadas],
          ),
          'success',
        );

        return afectadas;
      } catch (cause) {
        notify(
          cause instanceof Error ? cause.message : traducir('app.tagsFailed'),
          'error',
        );

        return 0;
      }
    },
    [insumos, conCarga, notify, reload, reloadTags, traducir],
  );

  const renameTag = useCallback(
    async (actual: string, nuevo: string): Promise<number | null> => {
      try {
        const r = await conCarga('loading.tags', () =>
          insumos.rename(actual, nuevo),
        );

        if (!r.ok) return null;

        // Igual que al borrar: el renombrado toca claves de toda la
        // coleccion, asi que la lista entera se queda obsoleta.
        await Promise.all([reloadTags(), reload()]);

        if (r.valor !== null) {
          notify(
            traducir(
              pluralKey(r.valor, 'tags.renamedOne', 'tags.renamedMany'),
              [nuevo, r.valor],
            ),
            'success',
          );
        }

        return r.valor;
      } catch (cause) {
        notify(
          cause instanceof Error ? cause.message : traducir('app.tagsFailed'),
          'error',
        );

        return null;
      }
    },
    [insumos, conCarga, notify, reload, reloadTags, traducir],
  );

  const tagExists = useCallback(
    (nombre: string): Promise<boolean> => insumos.existe(nombre),
    [insumos],
  );

  /*
   * Cambia el tono de una etiqueta.
   *
   * Solo recarga el catalogo y **no** la lista de claves, y la diferencia no es
   * una mania: el color no esta en la columna `tags` de las claves —que solo
   * guarda el nombre— sino en el catalogo. Las claves no han cambiado de nada,
   * asi que volver a pedir cuatrocientas filas para que lo unico que se vea
   * distinto sea el color de una pastilla seria gasto sin motivo.
   */
  const colorTag = useCallback(
    async (clave: string, color: string): Promise<void> => {
      await insumos.setColor(clave, color);

      await reloadTags();
    },
    [insumos, reloadTags],
  );

  return { tags, createTag, removeTag, renameTag, tagExists, colorTag, setTags };
}