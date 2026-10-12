import { useEffect, useMemo, useState } from 'react';
import { KEY_PLATFORM_VALUES, KEY_STATUS_VALUES, KeyPlatform, KeyStatus, TRANSLATIONS, platformLabel, statusMeta, type IGameKey, type IGameKeyDraft } from '@/contracts';
import { Button, Field, INPUT_CLASS, SELECT_CLASS } from './ui.component';
import { Icon } from './icon.component';
import { Modal } from './modal.component';
import { useT } from '@/context/locale.context';
import { parseTags } from '@/helpers/normalize-text.helper';
import { conTiempoLimite } from '@/helpers/use-loading.helper';

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
    /**
     * `error` y `saving` tambien se vacian al cambiar de entrada.
     *
     * El editor se reutiliza: se abre para la clave A, se cierra y se abre
     * para la B sin que React lo desmonte. Sin esto el error de A se queda
     * puesto encima del formulario de B —avisando de algo que ya no es
     * cierto— y, si A se dejo a medio guardar, el boton de B nace apagado y
     * no hay forma de encenderlo sin recargar la ventana entera.
     */
    setError(null);
    setSaving(false);

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

  // `parseTags`, que es lo que usa el resto del proyecto para cortar la lista.
  // Aqui se hacia a mano con `split`/`trim`/`filter`; es la misma operacion
  // escrita dos veces, y si un dia cambia una, la otra se queda hairy.
  const parsedTags = useMemo(() => parseTags(tagsText), [tagsText]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (draft.title.trim().length === 0 || draft.keyValue.trim().length === 0) {
      setError(t('editor.needBoth'));
      return;
    }

    setSaving(true);
    setError(null);

    /**
     * Tope de espera.
     *
     * Sin esto, un `onSave` que no resolviera dejaba el boton apagado para
     * siempre y el dialogo sin decir nada: se pulsaba «Anadir clave», no
     * pasaba nada, y no habia forma de saber si estaba guardando o colgado. Con
     * el tope, a los quince segundos el boton se vuelve a encender con un aviso
     * que dice que intente otra vez.
     *
     * Quince y no tres: guardar es una escritura local y deberia ser
     * instantaneo. Si tarda es que algo va mal de verdad, y avisar antes
     * compensa.
     */
    const ESPERA_MAXIMA_MS = 15_000;

    try {
      const r = await conTiempoLimite(
        // `onSave` admite devolver `void` —los dos dialogos que lo usan hacen
        // una cosa sincronica—, y `Promise.resolve` lo convierte en promesa sin
        // obligar a los dos a declarar lo mismo.
        Promise.resolve(onSave({ ...draft, tags: parsedTags })),
        ESPERA_MAXIMA_MS,
      );

      // `ok: false` no es un fallo del guardado —el error real, si lo hay, lo
      // habria lanzado `onSave`— sino que no se ha podido saber. Se distinguen
      // para no mentir sobre lo que ha pasado.
      //
      // `saving` se apaga en los tres caminos, no solo en los dos malos. En el
      // bueno casi nunca se ve —el padre cierra el dialogo al guardar—, pero
      // si decide no cerrarlo el boton se queda apagado para siempre y el
      // formulario parece congelado.
      setSaving(false);

      if (!r.ok) setError(t('app.saveTimedOut'));
    } catch (cause) {
      setSaving(false);
      setError(cause instanceof Error ? cause.message : t('editor.saveError'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      as="form"
      onSubmit={handleSubmit}
      size="lg"
      label={entry ? t('editor.editTitle') : t('editor.newTitle')}
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

          {/*
            Sin `trim` en el `onChange`, y a proposito.
            `event.target.value.trim()` en cada pulsacion hacia imposible
            escribir un espacio: se teclea «Ana», se pulsa espacio, el DOM
            tiene «Ana » y el valor vuelve a ser «Ana», asi que React
            repinta sin el espacio y «Ana Maria» se guarda «AnaMaria».

            Aqui es donde mas duele, porque es el nombre de una persona de
            verdad. Limpiar al guardar —que ya se hace— es lo unico que
            hace falta, y mientras se escribe lo que se quiere es el texto
            tal cual se teclea.
          */}
          <Field label={t('editor.recipient')} hint={t('editor.recipientHint')}>
            <input
              className={INPUT_CLASS}
              value={draft.giftedTo ?? ''}
              onChange={(event) => patch({ giftedTo: event.target.value || null })}
              placeholder={t('editor.recipientPlaceholder')}
            />
          </Field>

          <Field label={t('editor.parent')} hint={t('editor.parentHint')}>
            <input
              className={INPUT_CLASS}
              value={draft.parentTitle ?? ''}
              onChange={(event) =>
                patch({ parentTitle: event.target.value || null })
              }
              placeholder={t('editor.parentPlaceholder')}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label={t('editor.note')} hint={t('editor.noteHint')}>
              <input
                className={INPUT_CLASS}
                value={draft.note ?? ''}
                onChange={(event) => patch({ note: event.target.value || null })}
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
    </Modal>
  );
}