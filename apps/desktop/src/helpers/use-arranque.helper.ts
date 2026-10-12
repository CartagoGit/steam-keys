import { useCallback, useEffect, useState } from 'react';

import type { AppLocale } from '@/contracts';
import type { IStartup } from '@/services/startup.service';

/**
 * Lo que el arranque necesita del mundo exterior.
 *
 * Va **por parametro** y no importado, y es por capas, no por comodidad: un
 * hook en `helpers/` solo puede mirar `contracts`. Importando `startup.service`
 * y `repository.factory` desde aqui, el fichero rompia la cadena —`helpers →
 * repositories` y `helpers → services`— y arrastraba Tauri entero a cualquier
 * test que quisiera ejercitarlo.
 *
 * Pasando las funciones, el hook no sabe de donde vienen, se puede probar sin
 * levantar nada, y quien lo usa —el componente— es quien si puede importar
 * servicios. La dependencia se hace explicita en la llamada en vez de estar
 * escondida en un `import`.
 */
export interface IArranqueInsumos {
  /** Mira, sin abrir, si hay base de datos y de que idioma son los ajustes. */
  inspeccionar: () => Promise<IStartup>;
  /**
   * Trae las copias de seguridad de la version anterior, una sola vez.
   *
   * Solo se llama cuando hay base de datos, y solo una vez por arranque: el
   * propio servicio es quien marca «ya no hace falta hacerlo».
   */
  migrarCopias: () => Promise<void>;
}

export interface IArranque {
  arranque: IStartup | null;
  /** Cambia el resultado a mano, para cuando la base la crea el usuario. */
  setArranque: (estado: IStartup | null) => void;
}

/**
 * Como arranca la aplicacion, en un sitio.
 *
 * Tres tareas encadenadas que antes vivian en tres `useEffect` sueltos dentro
 * del componente, con el orden puesto a mano:
 *
 * 1. **Mirar si hay base de datos.** Antes de abrirla. Abrirla la crea, asi que
 *    la pregunta tiene que ser «mira el fichero», no «abre y mira si hay
 *    tablas»; preguntar despues seria tarde, el fichero ya esta en disco.
 * 2. **Fijar el idioma.** Sale de aqui y no de los ajustes, porque todavia no
 *    hay ajustes que leer: estan dentro de la base de datos que estamos
 *    comprobando. `settingsService.load()` abriria la base, y con eso ya no se
 *    podria saber si estaba antes.
 * 3. **Migrar las copias antiguas**, solo si la base existe.
 *
 * Las dos ultimas van en **efectos separados** y no encadenadas con un `await`
 * dentro del primero, porque dependen de cosas distintas y tienen que despertar
 * de distinta manera.
 *
 * Encadenarlas fue justo el error de la primera version: la migracion colgaba
 * del efecto de inspeccion, cuyas dependencias no cambian cuando el usuario
 * crea la base a mano desde el primer arranque. Ese `setArranque` no dispara
 * nada, y la migracion se quedaba sin ejecutar en ese camino — que es el
 * unico donde puede haber una carpeta de copias antigua junto a un programa
 * recien instalado. Colgada de `arranque?.database` salta las dos veces.
 *
 * Los dos efectos siguientes del componente —cargar claves y cargar ajustes—
 * esperan tambien a `database === 'ready'`, que es la senal de que la base se
 * puede tocar.
 */
export function useArranque(
  fijarIdioma: (locale: AppLocale) => void,
  { inspeccionar, migrarCopias }: IArranqueInsumos,
): IArranque {
  const [arranque, setArranque] = useState<IStartup | null>(null);

  useEffect(() => {
    const mirar = async (): Promise<void> => {
      const estado = await inspeccionar();

      fijarIdioma(estado.locale);
      setArranque(estado);
    };

    void mirar();
  }, [fijarIdioma, inspeccionar]);

  useEffect(() => {
    if (arranque?.database !== 'ready') return;

    /**
     * Que un fallo aqui no rompa el arranque.
     *
     * Sin carpeta de copias antiguas, o sin permisos para leerla, no hay nada
     * que hacer y la app sigue con lo que hay. Que la migracion no se haya
     * marcado como hecha no tiene consecuencia: los ficheros siguen donde
     * estaban y en el siguiente arranque se vuelve a mirar.
     */
    const migrar = async (): Promise<void> => {
      try {
        await migrarCopias();
      } catch {
        // A proposito: el error no se propaga ni se avisa. Ver arriba.
      }
    };

    void migrar();
  }, [arranque?.database, migrarCopias]);

  /**
   * `setArranque` con la forma de un dispatch, envuelto para no salir del hook.
   *
   * Lo usa el primer arranque, que es una decision del usuario —«empezar de
   * cero» crea el fichero— y por tanto no puede venir de un efecto.
   */
  const cambiarArranque = useCallback((estado: IStartup | null): void => {
    setArranque(estado);
  }, []);

  return { arranque, setArranque: cambiarArranque };
}