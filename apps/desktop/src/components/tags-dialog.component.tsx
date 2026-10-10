import { useMemo, useState } from 'react';
import {
  cleanTag,
  normalizeTag,
  suggestionsFor,
} from '@/contracts/constants/tag.constants';
import { KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { Icon } from './icon.component';
import { Button, INPUT_CLASS } from './ui.component';
import type { IGameKey } from '@/contracts/interfaces/game-key.interface';

export interface ITagsDialogProps {
  /** Las claves seleccionadas. */
  entries: readonly IGameKey[];
  /** Todas las claves de la coleccion, para saber que etiquetas existen. */
  todas: readonly IGameKey[];
  /** Las etiquetas finales, ya calculadas por quien abre el dialogo. */
  iniciales: readonly string[];
  /** Plataformas implicadas en la seleccion, para sugerir etiquetas. */
  plataformas: readonly KeyPlatform[];
  onConfirm: (tags: readonly string[]) => void;
  onCancel: () => void;
}

/**
 * Dialogo para poner etiquetas a varias claves de una vez.
 *
 * Se muestran todas las etiquetas que ya existen en la coleccion mas las
 * sugerencias de cada plataforma implicada. Al confirmar se devuelven las
 * etiquetas finales ya calculadas: quien llama decide si la operacion es
 * anadir, quitar o reemplazar, porque aqui solo se edita el conjunto.
 */
export function TagsDialog({
  entries,
  todas,
  iniciales,
  plataformas,
  onConfirm,
  onCancel,
}: ITagsDialogProps) {
  const [seleccionadas, setSeleccionadas] = useState<ReadonlySet<string>>(
    () => new Set(iniciales.map(normalizeTag)),
  );

  const [nueva, setNueva] = useState('');

  /** Etiquetas que ya hay en la coleccion, mas las sugerencias. */
  const sugeridas = useMemo(() => {
    const existentes = todas.flatMap((key) => key.tags);
    const vistas = new Set<string>();

    for (const platform of plataformas) {
      for (const tag of suggestionsFor(platform, existentes)) {
        if (!vistas.has(normalizeTag(tag))) vistas.add(normalizeTag(tag));
      }
    }

    return [...vistas];
  }, [todas, plataformas]);

  const alternar = (tag: string): void => {
    setSeleccionadas((anterior) => {
      const siguiente = new Set(anterior);
      const clave = normalizeTag(tag);

      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);

      return siguiente;
    });
  };

  const anadirNueva = (): void => {
    const limpia = cleanTag(nueva);

    if (limpia.length === 0) return;

    setSeleccionadas((anterior) => new Set([...anterior, limpia]));
    setNueva('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="animate-fade-in flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface-1 shadow-2xl ring-1 ring-white/10">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Icon name="tag" size={15} className="text-blue-400" />
              Etiquetas
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {entries.length === 1
                ? 'Se cambiara 1 clave'
                : `Se cambiaran ${entries.length} claves`}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            title="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* ------------------------------------------------- nueva etiqueta */}
          <div className="flex gap-2">
            <input
              type="text"
              value={nueva}
              onChange={(event) => setNueva(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  anadirNueva();
                }
              }}
              placeholder="Etiqueta nueva"
              className={INPUT_CLASS}
            />
            <Button
              variant="subtle"
              icon="plus"
              onClick={anadirNueva}
              disabled={cleanTag(nueva).length === 0}
              title="Anadir la etiqueta a la seleccion"
            >
              Anadir
            </Button>
          </div>

          {/* ------------------------------------------------------ existentes */}
          {sugeridas.length === 0 ? (
            <p className="mt-6 text-center text-xs text-slate-500">
              Todavia no hay etiquetas en la coleccion.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {sugeridas.map((tag) => {
                const activa = seleccionadas.has(normalizeTag(tag));

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => alternar(tag)}
                    aria-pressed={activa}
                    className={[
                      'rounded-full px-3 py-1.5 text-xs transition',
                      activa
                        ? 'bg-blue-600 text-white ring-1 ring-blue-400'
                        : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10',
                    ].join(' ')}
                  >
                    {activa ? <Icon name="check" size={11} className="mr-1 inline" /> : null}
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p className="text-[11px] text-slate-500">
            Las claves que no tengan la etiqueta la reciben; las que ya la tienen la conservan.
          </p>

          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => onConfirm([...seleccionadas])}
              title="Aplicar estas etiquetas a todas las claves seleccionadas"
            >
              Aplicar
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}