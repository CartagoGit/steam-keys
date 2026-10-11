import { useEffect, useMemo, useState } from 'react';
import { platformLabel } from '@/contracts/constants/key-platform.constants';
import { statusMeta } from '@/contracts/constants/key-status.constants';
import { KEY_PLATFORM_VALUES, KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KEY_STATUS_VALUES, KeyStatus } from '@/contracts/enums/key-status.enum';
import { Button, Field, INPUT_CLASS, SELECT_CLASS } from './ui.component';
import { Icon } from './icon.component';
import { useT } from '@/context/locale.context';
import { TRANSLATIONS } from '@/contracts/constants/i18n.constants';
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
  const { t, locale } = useT();

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
      setError(t('editor.needBoth'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({ ...draft, tags: parsedTags });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('editor.saveError'));
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
        className="animate-scale-in flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-surface-1 shadow-2xl ring-1 ring-line"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-t1">
              {entry ? t('editor.editTitle') : t('editor.newTitle')}
            </h2>
            <p className="text-xs text-t4">
              {entry
                ? t('editor.editHint')
                : t('editor.newHint')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-t4 transition hover:bg-hover hover:text-t1"
            title={t('action.close')}
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="grid gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t('editor.title')} required>
              <input
                autoFocus
                className={INPUT_CLASS}
                value={draft.title}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder={t('editor.titlePlaceholder')}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label={t('editor.key')} required hint={t('editor.keyHint')}>
              <input
                className={`${INPUT_CLASS} font-mono`}
                value={draft.keyValue}
                onChange={(event) => patch({ keyValue: event.target.value })}
                placeholder={t('editor.keyPlaceholder')}
              />
            </Field>
          </div>

          <Field label={t('editor.platform')}>
            <select
              className={SELECT_CLASS}
              value={draft.platform}
              onChange={(event) => patch({ platform: event.target.value as KeyPlatform })}
            >
              {KEY_PLATFORM_VALUES.map((platform) => (
                <option key={platform} value={platform}>
                  {platformLabel(platform, TRANSLATIONS[locale])}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('editor.status')}>
            <select
              className={SELECT_CLASS}
              value={draft.status}
              onChange={(event) => patch({ status: event.target.value as KeyStatus })}
            >
              {KEY_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {statusMeta(status, TRANSLATIONS[locale]).label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('editor.recipient')} hint={t('editor.recipientHint')}>
            <input
              className={INPUT_CLASS}
              value={draft.giftedTo ?? ''}
              onChange={(event) =>
                patch({ giftedTo: event.target.value.trim() || null })
              }
              placeholder={t('editor.recipientPlaceholder')}
            />
          </Field>

          <Field label={t('editor.parent')} hint={t('editor.parentHint')}>
            <input
              className={INPUT_CLASS}
              value={draft.parentTitle ?? ''}
              onChange={(event) =>
                patch({ parentTitle: event.target.value.trim() || null })
              }
              placeholder={t('editor.parentPlaceholder')}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label={t('editor.note')} hint={t('editor.noteHint')}>
              <input
                className={INPUT_CLASS}
                value={draft.note ?? ''}
                onChange={(event) => patch({ note: event.target.value.trim() || null })}
                placeholder={t('editor.notePlaceholder')}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label={t('editor.tags')} hint={t('editor.tagsHint')}>
              <input
                className={INPUT_CLASS}
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                placeholder={t('editor.tagsPlaceholder')}
              />
            </Field>
          </div>

          {error ? (
            <p className="sm:col-span-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger ring-1 ring-danger/30">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={saving} icon="check">
            {entry ? t('editor.save') : t('editor.add')}
          </Button>
        </footer>
      </form>
    </div>
  );
}