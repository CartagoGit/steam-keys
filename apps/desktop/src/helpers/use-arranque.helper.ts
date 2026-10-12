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
 * 3. **Migrar las copias antiguas.** Solo si la base existe, y despues de (2),
 *    porque es quien marca «ya no hace falta hacerlo»: si corriera antes y
 *    fallara al guardar los ajustes, la migracion se repetiria en cada
 *    arranque.
 *
 * Aqui el orden es el **orden del codigo**, no una lista de dependencias que
 * alguien tiene que mantener al dia. Los dos efectos siguientes del componente
 * —cargar claves y cargar ajustes— esperan a que `arranque` valga
 * `database === 'ready'`, que es la senal de que la base se puede tocar.
 *
 * Ninguno de los tres necesita estado de render salvo el resultado del
 * primero, y por eso viven aqui: son entrada/salida, no interfaz.
 */
export function useArranque(fijarIdioma: (locale: AppLocale) => void): {
  arranque: IStartup | null;
  /** Cambia el resultado a mano, para cuando la base la crea el usuario. */
  setArranque: (estado: IStartup | null) => void;
} {
  const [arranque, setArranque] = useState<IStartup | null>(null);

  /**
   * La migracion se dispara desde aqui y no desde el componente.
   *
   * Antes era un `useEffect` mas con `[arranque]` en la lista, lo que hacia que
   * dependiera de que alguien se acordara de mantenerlo en el sitio correcto.
   */
  useEffect(() => {
    const mirar = async (): Promise<void> => {
      const estado = await inspectStartup();

      fijarIdioma(estado.locale);
      setArranque(estado);

      if (estado.database !== 'ready') return;

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

    void mirar();
  }, [fijarIdioma]);

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