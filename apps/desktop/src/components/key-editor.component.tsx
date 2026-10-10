import { useEffect, useMemo, useState } from 'react';
import { KEY_PLATFORM_META } from '@/contracts/constants/key-platform.constants';
import { KEY_STATUS_META } from '@/contracts/constants/key-status.constants';
import { KEY_PLATFORM_VALUES, KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KEY_STATUS_VALUES, KeyStatus } from '@/contracts/enums/key-status.enum';
import { Button, Field, INPUT_CLASS, SELECT_CLASS } from './ui.component';
import { Icon } from './icon.component';
import type {
  IGameKey,
  IGameKeyDraft,
} from '@/contracts/interfaces/game-key.interface';

export interface IKeyEditorProps {
  /** `null` para crear una key nueva. */
  entry: IGameKey | null;
  onSave: (draft: IGameKeyDraft) => Promise<void> | void;
  onClose: () => void;
}

const EMPTY_DRAFT: IGameKeyDraft = {
  title: '',
  keyValue: '',
  platform: KeyPlatform.Steam,
  status: KeyStatus.Available,
  giftedTo: null,
  parentTitle: null,
  note: null,
  tags: [],
  addedOn: null,
};

/** Formulario de alta y edicion. */
export function KeyEditor({ entry, onSave, onClose }: IKeyEditorProps) {
  const [draft, setDraft] = useState<IGameKeyDraft>(EMPTY_DRAFT);
  const [tagsText, setTagsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) {
      setDraft(EMPTY_DRAFT);
      setTagsText('');
      return;
    }

    setDraft({
      title: entry.title,
      keyValue: entry.keyValue,
      platform: entry.platform,
      status: entry.status,
      giftedTo: entry.giftedTo,
      parentTitle: entry.parentTitle,
      note: entry.note,
      tags: entry.tags,
      addedOn: entry.addedOn,
    });
    setTagsText(entry.tags.join(', '));
  }, [entry]);

  const patch = (changes: Partial<IGameKeyDraft>): void => {
    setDraft((current) => ({ ...current, ...changes }));
  };

  const parsedTags = useMemo(
    () =>
      tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    [tagsText],
  );

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();

    if (draft.title.trim().length === 0 || draft.keyValue.trim().length === 0) {
      setError('El nombre del juego y la clave son obligatorios.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({ ...draft, tags: parsedTags });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="animate-scale-in flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-surface-1 shadow-2xl ring-1 ring-white/10"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              {entry ? 'Editar key' : 'Nueva key'}
            </h2>
            <p className="text-xs text-slate-500">
              {entry
                ? 'Los cambios se guardan en tu base de datos local.'
                : 'Anade una clave a tu coleccion.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
            title="Cerrar"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="grid gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Juego" required>
              <input
                autoFocus
                className={INPUT_CLASS}
                value={draft.title}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder="Celeste, Hollow Knight, Half-Life 2…"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Clave" required hint="Se guarda tal cual la introduces.">
              <input
                className={`${INPUT_CLASS} font-mono`}
                value={draft.keyValue}
                onChange={(event) => patch({ keyValue: event.target.value })}
                placeholder="XXXXX-XXXXX-XXXXX"
              />
            </Field>
          </div>

          <Field label="Plataforma">
            <select
              className={SELECT_CLASS}
              value={draft.platform}
              onChange={(event) => patch({ platform: event.target.value as KeyPlatform })}
            >
              {KEY_PLATFORM_VALUES.map((platform) => (
                <option key={platform} value={platform}>
                  {KEY_PLATFORM_META[platform].label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Estado">
            <select
              className={SELECT_CLASS}
              value={draft.status}
              onChange={(event) => patch({ status: event.target.value as KeyStatus })}
            >
              {KEY_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {KEY_STATUS_META[status].label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Regalada a" hint="Solo si ya la has dado a alguien.">
            <input
              className={INPUT_CLASS}
              value={draft.giftedTo ?? ''}
              onChange={(event) =>
                patch({ giftedTo: event.target.value.trim() || null })
              }
              placeholder="Alberto"
            />
          </Field>

          <Field label="Juego padre" hint="Rellena si es un DLC.">
            <input
              className={INPUT_CLASS}
              value={draft.parentTitle ?? ''}
              onChange={(event) =>
                patch({ parentTitle: event.target.value.trim() || null })
              }
              placeholder="Half-Life 2"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Nota" hint="Promo de origen, fecha, instrucciones…">
              <input
                className={INPUT_CLASS}
                value={draft.note ?? ''}
                onChange={(event) => patch({ note: event.target.value.trim() || null })}
                placeholder="Junio 2018 Humble Monthly"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Etiquetas" hint="Separadas por comas.">
              <input
                className={INPUT_CLASS}
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                placeholder="humble, dlc, promo"
              />
            </Field>
          </div>

          {error ? (
            <p className="sm:col-span-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/30">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={saving} icon="check">
            {entry ? 'Guardar cambios' : 'Anadir key'}
          </Button>
        </footer>
      </form>
    </div>
  );
}