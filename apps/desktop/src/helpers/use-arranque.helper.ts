import { useCallback, useEffect, useState } from 'react';

import type { AppLocale } from '@/contracts';
import { getDatabaseClient } from '@/repositories/repository.factory';
import {
  legacyBackupsMigrated,
  migrateLegacyBackups,
} from '@/services/legacy-backups.service';
import { inspectStartup, type IStartup } from '@/services/startup.service';

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
 * nada, y la migracion se quedaba sin ejecutar en ese camino. Colgada de
 * `arranque?.database` salta las dos veces: cuando llega el resultado y cuando
 * la base pasa a existir.
 *
 * Los dos efectos siguientes del componente —cargar claves y cargar ajustes—
 * esperan tambien a `database === 'ready'`, que es la senal de que la base se
 * puede tocar.
 */
export function useArranque(fijarIdioma: (locale: AppLocale) => void): {
  arranque: IStartup | null;
  /** Cambia el resultado a mano, para cuando la base la crea el usuario. */
  setArranque: (estado: IStartup | null) => void;
} {
  const [arranque, setArranque] = useState<IStartup | null>(null);

  useEffect(() => {
    const mirar = async (): Promise<void> => {
      const estado = await inspectStartup();

      fijarIdioma(estado.locale);
      setArranque(estado);
    };

    void mirar();
  }, [fijarIdioma]);

  useEffect(() => {
    if (arranque?.database !== 'ready') return;

    const migrar = async (): Promise<void> => {
      try {
        const db = await getDatabaseClient();

        if (await legacyBackupsMigrated(db)) return;

        await migrateLegacyBackups(db);
      } catch {
        // Sin carpeta de copias antiguas, o sin permisos para leerla: no hay
        // nada que hacer y la app sigue con lo que hay. Que la migracion no se
        // haya marcado como hecha no tiene consecuencia: los ficheros siguen
        // donde estaban y en el siguiente arranque se vuelve a mirar.
      }
    };

    void migrar();
  }, [arranque?.database]);

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