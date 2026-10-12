import { useEffect, useMemo, useState } from 'react';
import { KeyPlatform, cleanTag, normalizeTag, suggestionsFor, type IGameKey } from '@/contracts';
import { Icon } from './icon.component';
import { Modal } from './modal.component';
import { Button, INPUT_CLASS } from './ui.component';
import { useT } from '@/context/locale.context';
import { pluralKey } from '@/helpers/i18n.helper';

export interface ITagsDialogProps {
  /** Las claves seleccionadas. */
  entries: readonly IGameKey[];
  /** `false` reproduce la animacion de salida antes de desaparecer. */
  open?: boolean;
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
  open = true,
  todas,
  iniciales,
  plataformas,
  onConfirm,
  onCancel,
}: ITagsDialogProps) {
  const { t } = useT();
  const [seleccionadas, setSeleccionadas] = useState<ReadonlySet<string>>(
    () => new Set(iniciales.map(normalizeTag)),
  );

  const [nueva, setNueva] = useState('');

  /**
   * Las etiquetas se reponen **al abrir**, no al montar.
   *
   * El dialogo no se desmonta al cerrarse —queda vivo para que la salida
   * se vea— asi que sin esto `seleccionadas` se traspasa de una
   * seleccion a la siguiente: se abre para un grupo de claves, se cierra
   * y se abre para otro, y aparecen marcadas las del primero. Pulsar
   * «Aplicar» las escribia encima de las nuevas, que es justo el fallo
   * que hace destructivo al dialogo.
   *
   * La transicion se mira en `open` y no en la identidad de `iniciales` a
   * proposito: `iniciales` es `etiquetasComunes(selectedKeys)`, un array
   * nuevo en cada repintado, asi que un efecto que dependiera de el
   * repondria las etiquetas con cada cambio de idioma y se comeria lo que
   * el usuario hubiera marcado. Mientras el dialogo esta abierto la
   * seleccion no cambia, asi que no hay caso que se pierda.
   *
   * El montaje tambien esta cubierto: `tagsVivo` monta el dialogo ya
   * abierto, y ese primer `open === true` dispara el efecto igual que
   * cualquier otra apertura.
   */
  useEffect(() => {
    if (!open) return;

    setSeleccionadas(new Set(iniciales.map(normalizeTag)));
    setNueva('');
  }, [open]);

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
    <Modal open={open} onClose={onCancel} size="lg" label={t('tags.title')}>
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-t1 flex items-center gap-2">
              <Icon name="tag" size={15} className="text-info" />
              {t('tags.title')}
            </h2>
            <p className="mt-0.5 text-[11px] text-t4">
              {t(pluralKey(entries.length, 'tags.count.one', 'tags.count.many'), [
                entries.length,
              ])}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            title={t('action.close')}
            className="rounded-lg p-1.5 text-t4 transition hover:bg-hover hover:text-t1"
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
              placeholder={t('tags.new')}
              className={INPUT_CLASS}
            />
            <Button
              variant="subtle"
              icon="plus"
              onClick={anadirNueva}
              disabled={cleanTag(nueva).length === 0}
              title={t('tags.addHint')}
            >
              {t('action.add')}
            </Button>
          </div>

          {/* ------------------------------------------------------ existentes */}
          {sugeridas.length === 0 ? (
            <p className="mt-6 text-center text-xs text-t4">
              {t('tags.empty')}
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
                        ? 'bg-accent text-on-accent ring-1 ring-accent'
                        : 'bg-hover text-t2 ring-1 ring-line hover:bg-hover-2',
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
          <p className="text-[11px] text-t4">{t('tags.merging')}</p>

          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={onCancel}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => onConfirm([...seleccionadas])}
              title={t('tags.applyHint')}
            >
              {t('action.apply')}
            </Button>
          </div>
        </footer>
    </Modal>
  );
}