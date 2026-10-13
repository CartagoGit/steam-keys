import { Button } from './ui.component';
import { Icon } from './icon.component';
import { useT } from '@/context/locale.context';

export interface IEmptyStateProps {
  /**
   * `true` cuando hay claves pero el filtro no deja ver ninguna.
   *
   * Distingue **las dos pantallas vacias**, que son cosas distintas y se
   * confundian: una es «no hay nada que enseñar con estos filtros» y la otra
   * es «no tienes claves». La primera se arregla limpiando el filtro; la
   * segunda, importando o añadiendo. Sin el parametro, quien instala la app
   * —que es cuando se ve— recibia la pantalla equivocada.
   */
  hasKeys: boolean;
  onCreate: () => void;
  onImport: () => void;
  onClearFilters: () => void;
}

/**
 * Lo que se ve cuando la lista no tiene filas.
 *
 * Vive en su propio fichero y no en `app.component.tsx` por la misma razon que
 * el resto de los componentes: no tiene estado, no lee de la base y no depende
 * de nada de la app salvo del traductor. Es un `return` condicional con dos
 * ramas, y mientras siga al final del componente grande es codigo que hay que
 * buscar con `grep` en un archivo de dos mil y pico lineas.
 *
 * Los textos van con `useT()` y no escritos en el marcado, porque con la app en
 * cualquier otro idioma salian en castellano justo en las pantallas que se ven
 * la primera vez.
 */
export function EmptyState({
  hasKeys,
  onCreate,
  onImport,
  onClearFilters,
}: IEmptyStateProps) {
  const { t } = useT();

  if (hasKeys) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-hover text-t4">
          <Icon name="search" size={22} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-t2">{t('empty.noResults')}</h3>
          <p className="mt-1 text-xs text-t4">{t('empty.noResultsHint')}</p>
        </div>
        <Button variant="subtle" size="sm" onClick={onClearFilters}>
          {t('empty.clearFilters')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10 text-info ring-1 ring-info/20">
        <Icon name="key" size={22} />
      </div>
      <div>
        <h3 className="text-sm font-medium text-t2">{t('empty.title')}</h3>
        <p className="mt-1 text-xs text-t4">{t('empty.hint')}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" icon="upload" onClick={onImport}>
          {t('empty.import')}
        </Button>
        <Button variant="subtle" icon="plus" onClick={onCreate}>
          {t('empty.create')}
        </Button>
      </div>
    </div>
  );
}