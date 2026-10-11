import { useState } from 'react';
import { Button } from '@/components/ui.component';
import { Icon } from '@/components/icon.component';
import { useT } from '@/context/locale.context';
import { fileService } from '@/services/file.service';
import { basename } from '@/helpers/path.helper';
import { DB_FILE_NAME } from '@/contracts';

interface IFirstRunProps {
  /** Donde estara la base de datos, para poder nombrarla en el aviso. */
  databasePath: string | null;
  /** El usuario empieza de cero: seguimos sin base de datos. */
  onStartEmpty: () => void;
}

/**
 * Lo que se ve la primera vez, cuando no hay base de datos.
 *
 * Hay dos caminos y los dos estan a la vista desde el principio, porque son los
 * dos que de verdad van a darse:
 *
 * - **Traer la base de datos**: has copiado el programa desde otra carpeta y
 *   solo has traído el ejecutable. Sin el `.db`, las claves, los ajustes y la
 *   cuenta de Steam se quedan en la carpeta de origen.
 * - **Empezar de cero**: es la primera vez y no hay nada que traer.
 *
 * Importante: mientras se elige, **no se crea nada**. No se crea la base de
 * datos ni un fichero vacio que ocupe el sitio de la copia buena. Se crea
 * sola cuando se anade o importa la primera clave, que es cuando ya hay algo que
 * guardar.
 *
 * El aviso sale en el idioma del navegador y no en el guardado, porque el
 * idioma guardado esta **dentro** de la base de datos que todavia no existe.
 */
export function FirstRun({ databasePath, onStartEmpty }: IFirstRunProps) {
  const { t } = useT();

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Solo el nombre del fichero: la ruta entera en un aviso de cinco lineas no
  // cabe en una ventana estrecha, y el nombre es justo lo que hay que buscar
  // para traerlo desde la otra carpeta.
  const donde = databasePath === null ? DB_FILE_NAME : basename(databasePath);

  async function traer(): Promise<void> {
    setOcupado(true);
    setError(null);

    try {
      const traida = await fileService.adoptDatabase(t('storage.data.where'));

      // Si se cancela el dialogo de ficheros no se recarga nada: recargando
      // con `false` se perderia el aviso para volver a leerlo, y el usuario
      // tendria que volver a abrir el programa para intentarlo otra vez.
      if (!traida) {
        setOcupado(false);
        return;
      }

      // Rust comprueba la cabecera del fichero antes de colocarlo, asi que si
      // ha llegado hasta aqui es que es una base de datos de verdad. Recargar
      // es lo mas honesto: el arranque vuelve a preguntar por el fichero y ya
      // lo encuentra, sin tener que reconstruir a mano el estado de la app.
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('app.saveFailed'));
      setOcupado(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-lg rounded-2xl bg-surface-1 p-7 shadow-xl ring-1 ring-line">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info ring-1 ring-info/20">
            <Icon name="key" size={22} />
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-semibold text-t1">{t('firstRun.title')}</h2>
            <p className="mt-1.5 text-sm text-t2">
              {t('firstRun.body', [donde])}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-surface-2 p-4 ring-1 ring-line">
          <h3 className="text-sm font-medium text-t1">{t('firstRun.moved.title')}</h3>
          <p className="mt-1 text-xs text-t2">
            {t('firstRun.moved.body', [donde])}
          </p>
        </div>

        {error !== null ? (
          <p className="mt-4 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" icon="upload" disabled={ocupado} onClick={traer}>
            {t('firstRun.bring')}
          </Button>
          <Button variant="subtle" icon="plus" disabled={ocupado} onClick={onStartEmpty}>
            {t('firstRun.create')}
          </Button>
        </div>
      </div>
    </div>
  );
}