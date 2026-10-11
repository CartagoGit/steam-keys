import { useMemo, useState } from 'react';
import { APP_LOCALE_VALUES, AppLocale } from '@/contracts/enums/app-locale.enum';
import { APP_THEME_VALUES, AppTheme } from '@/contracts/enums/app-theme.enum';
import { LOCALE_META, THEME_LABELS } from '@/contracts/constants/locale.constants';
import { Icon } from './icon.component';
import { Modal } from './modal.component';
import { Badge, Button, Field, INPUT_CLASS, PasswordInput } from './ui.component';
import type { IAppSettings } from '@/contracts/interfaces/app-settings.interface';
import type { SteamAccountStatus } from '@/contracts/interfaces/steam-account.interface';

export interface ISettingsDialogProps {
  settings: IAppSettings;
  /** `false` reproduce la animacion de salida antes de desaparecer. */
  open?: boolean;
  /** Estado actual de la conexion con Steam, para mostrarlo. */
  cuenta: SteamAccountStatus;
  /** Guarda los ajustes. Puede fallar y entonces devuelve un mensaje. */
  onSave: (patch: Partial<IAppSettings>) => Promise<string | null>;
  /** Intenta conectar la cuenta de Steam. */
  onLinkSteam: (apiKey: string, steamId: string) => Promise<string | null>;
  /** Borra la clave de la API de la base de datos. */
  onForgetApiKey: () => Promise<void>;
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'account';

/**
 * Dialogo de ajustes.
 *
 * Tres cosas y solo tres: tema, idioma y cuenta de Steam. La clave de la API se
 * guarda en la base de datos local, nunca se sube a ningun sitio, y se puede
 * borrar con un boton para no tener que editar el fichero a mano.
 */
export function SettingsDialog({
  settings,
  open = true,
  cuenta,
  onSave,
  onLinkSteam,
  onForgetApiKey,
  onClose,
}: ISettingsDialogProps) {
  const [tab, setTab] = useState<SettingsTab>('appearance');

  const [tema, setTema] = useState<AppTheme>(settings.theme);
  const [idioma, setIdioma] = useState<AppLocale>(settings.locale);

  const [apiKey, setApiKey] = useState(settings.steamApiKey);
  const [steamId, setSteamId] = useState(settings.steamId);

  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cuentaValida = useMemo(
    () =>
      /^7656119\d{10}$/.test(steamId.trim()) ||
      /^[a-z0-9._-]{2,32}$/i.test(steamId.trim()),
    [steamId],
  );

  const guardar = async (): Promise<void> => {
    setOcupado(true);

    try {
      const error = await onSave({ theme: tema, locale: idioma });

      setAviso(error ?? 'Ajustes guardados.');
    } finally {
      setOcupado(false);
    }
  };

  const conectar = async (): Promise<void> => {
    setOcupado(true);
    setAviso(null);

    try {
      const error = await onLinkSteam(apiKey.trim(), steamId.trim());

      setAviso(error ?? null);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" label="Ajustes">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Icon name="settings" size={16} className="text-slate-400" />
            Ajustes
          </h2>

          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        {/* ------------------------------------------------------------- pestanas */}
        <div className="flex gap-1 border-b border-line px-5 pt-2">
          {(
            [
              ['appearance', 'Apariencia'],
              ['account', 'Cuenta de Steam'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                'rounded-t-lg px-3 py-2 text-xs font-medium transition',
                tab === id
                  ? 'border-b-2 border-blue-500 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {tab === 'appearance' ? (
            <div className="flex flex-col gap-6">
              <Field label="Tema" hint="El tema del sistema cambia solo con el sistema operativo.">
                <div className="flex gap-2">
                  {APP_THEME_VALUES.map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setTema(valor)}
                      aria-pressed={tema === valor}
                      className={[
                        'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition',
                        tema === valor
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10',
                      ].join(' ')}
                    >
                      {THEME_LABELS[valor] ?? valor}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Idioma" hint="Cambia el idioma de los menus y los botones.">
                <select
                  value={idioma}
                  onChange={(event) => setIdioma(event.target.value as AppLocale)}
                  className={INPUT_CLASS}
                >
                  {APP_LOCALE_VALUES.map((valor) => {
                    const meta = LOCALE_META[valor];
                    return (
                      <option key={valor} value={valor}>
                        {meta?.label ?? valor}
                      </option>
                    );
                  })}
                </select>
              </Field>

              <Button variant="primary" onClick={guardar} disabled={ocupado}>
                Guardar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* --------------------------------------------------- estado actual */}
              <div className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
                <span className="text-xs text-slate-300">
                  {cuenta.conectado
                    ? `Conectada como ${cuenta.steamId}`
                    : 'Sin conectar'}
                </span>

                <Badge
                  label={cuenta.juegos > 0 ? `${cuenta.juegos} juegos` : '—'}
                  tone={
                    cuenta.conectado
                      ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
                      : 'bg-slate-500/15 text-slate-400 ring-slate-500/30'
                  }
                />
              </div>

              <Field
                label="Clave de la API de Steam"
                hint="Gratuita, en steamcommunity.com/dev/apikey. Se guarda solo en este ordenador y no se envia a ningun sitio."
              >
                <PasswordInput
                  value={apiKey}
                  onChange={setApiKey}
                  placeholder="Pega aqui tu clave"
                />
              </Field>

              <Field
                label="ID o nombre de perfil de Steam"
                hint="Vale cualquiera de los dos: tu numero de 17 cifras o el nombre que sale en la direccion de tu perfil."
              >
                <input
                  type="text"
                  value={steamId}
                  onChange={(event) => setSteamId(event.target.value)}
                  placeholder="7656119… o cartagonova"
                  autoComplete="off"
                  spellCheck={false}
                  className={INPUT_CLASS}
                />
              </Field>

              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300 ring-1 ring-amber-500/20">
                Tu perfil de Steam tiene que ser <strong>público</strong> para que la app
                pueda ver tu biblioteca. No hace falta darle tu contraseña ni la de la
                cuenta.
              </p>

              {aviso ? (
                <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300 ring-1 ring-rose-500/20">
                  {aviso}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  icon="refresh"
                  onClick={conectar}
                  disabled={ocupado || !cuentaValida || apiKey.trim().length === 0}
                  title={
                    !cuentaValida
                      ? 'Pon tu ID de 17 cifras o el nombre de tu perfil de Steam'
                      : apiKey.trim().length === 0
                        ? 'Hace falta la clave de la API'
                        : 'Conectar la cuenta y traer la biblioteca'
                  }
                >
                  Conectar
                </Button>

                <Button
                  variant="ghost"
                  onClick={async () => {
                    setOcupado(true);
                    await onForgetApiKey();
                    setApiKey('');
                    setOcupado(false);
                  }}
                  disabled={ocupado || settings.steamApiKey.length === 0}
                  title="Borrar la clave de la API de la base de datos"
                >
                  Olvidar la clave
                </Button>
              </div>
            </div>
          )}
        </div>
    </Modal>
  );
}