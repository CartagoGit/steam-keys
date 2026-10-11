import { useMemo, useState } from 'react';
import { AppLocale } from '@/contracts/enums/app-locale.enum';
import {
  APP_THEME_SWATCHES,
  APP_THEME_VALUES,
  AppTheme,
} from '@/contracts/enums/app-theme.enum';
import { THEME_LABELS } from '@/contracts/constants/locale.constants';
import { STEAM_API_KEY_URL } from '@/contracts/constants/app.constants';
import { Icon } from './icon.component';
import { LocaleSelect } from './locale-select.component';
import { Modal } from './modal.component';
import {
  Badge,
  Button,
  ExternalLink,
  Field,
  INPUT_CLASS,
  PasswordInput,
} from './ui.component';
import { useT } from '@/context/locale.context';
import { normalizarClaveApi, normalizarIdSteam } from '@/helpers/steam-input.helper';
import type { IAppSettings } from '@/contracts/interfaces/app-settings.interface';
import type { SteamAccountStatus } from '@/contracts/interfaces/steam-account.interface';

export interface ISettingsDialogProps {
  settings: IAppSettings;
  /** `false` reproduce la animacion de salida antes de desaparecer. */
  open?: boolean;
  /**
   * Pestana con la que se abre.
   *
   * Existe para el caso de que se llegue aqui desde fuera (por ejemplo, desde
   * la vista de juegos de Steam sin cuenta conectada): abrir los ajustes en
   * "Apariencia" obligaria a buscar la pestana correcta a mano.
   */
  initialTab?: SettingsTab;
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

export type SettingsTab = 'appearance' | 'account';

/**
 * Dialogo de ajustes.
 *
 * Tres cosas y solo tres: tema, idioma y cuenta de Steam. La clave de la API se
 * guarda en la base de datos local, nunca se sube a ningun sitio, y se puede
 * borrar con un boton para no tener que editar el fichero a mano.
 *
 * Todo el texto pasa por el traductor. Este dialogo es el que cambia el
 * idioma, asi que si sus propios textos estuvieran en espanol se veria **el
 * idioma nuevo junto a un dialogo en el viejo**, que es justo lo que pasaba.
 * El `t` sale del contexto, no de una prop, porque el contexto se actualiza en
 * cuanto se elige el idioma y asi este texto cambia en el mismo instante.
 *
 * No hay boton de Guardar. Tema e idioma se aplican y se guardan al elegir,
 * porque un selector que hay que confirmar parece no funcionar: no se nota el
 * cambio hasta que ya no se puede deshacer.
 */
export function SettingsDialog({
  settings,
  open = true,
  initialTab = 'appearance',
  cuenta,
  onSave,
  onLinkSteam,
  onForgetApiKey,
  onClose,
}: ISettingsDialogProps) {
  const { t } = useT();

  const [tab, setTab] = useState<SettingsTab>(initialTab);

  const [tema, setTema] = useState<AppTheme>(settings.theme);
  const [idioma, setIdioma] = useState<AppLocale>(settings.locale);

  const [apiKey, setApiKey] = useState(settings.steamApiKey);
  const [steamId, setSteamId] = useState(settings.steamId);

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cuentaValida = useMemo(
    () =>
      /^7656119\d{10}$/.test(steamId.trim()) ||
      /^[a-z0-9._-]{2,32}$/i.test(steamId.trim()),
    [steamId],
  );

  /**
   * Cambia el idioma **al momento**, sin esperar a nada.
   *
   * Antes habia que elegirlo y luego guardar, y si se cerraba el dialogo sin
   * guardar se perdia: la seleccion parecia no funcionar.
   */
  const cambiarIdioma = async (valor: AppLocale): Promise<void> => {
    setIdioma(valor);
    await onSave({ locale: valor });
  };

  const cambiarTema = async (valor: AppTheme): Promise<void> => {
    setTema(valor);
    await onSave({ theme: valor });
  };

  /**
   * Conecta la cuenta.
   *
   * Al conectar bien **no** sale un "Ajustes guardados" generico: sale un
   * mensaje verde que dice que la conexion esta hecha. El aviso anterior
   * confirmaba una cosa distinta de la que se acaba de hacer, asi que no
   * confirmaba nada; con dos peticiones distintas que pueden fallar por
   * motivos distintos hace falta distinguir cual ha fallado.
   */
  const conectar = async (): Promise<void> => {
    setOcupado(true);
    setError(null);

    try {
      setError(await onLinkSteam(normalizarClaveApi(apiKey), normalizarIdSteam(steamId)));
    } finally {
      setOcupado(false);
    }
  };

  /**
   * Al conectar se limpian los dos campos antes de mandarlos.
   *
   * Aunque ya se limpian al escribir, se vuelven a limpiar aqui porque es el
   * ultimo punto antes de que el valor llegue a la base de datos, y la regla
   * que vale es "lo que se guarda es lo que habia escrito". Si alguien pega
   * desde otro sitio y el valor llega con espacios por una via que no pasa por
   * el campo, aqui sigue cogiendose.
   */

  const olvidar = async (): Promise<void> => {
    setOcupado(true);

    try {
      await onForgetApiKey();
      setApiKey('');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" label={t('settings.title')}>
      <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-t1">
          <Icon name="settings" size={16} className="text-t3" />
          {t('settings.title')}
        </h2>

        <button
          type="button"
          onClick={onClose}
          title={t('action.close')}
          aria-label={t('action.close')}
          className="rounded-lg p-1.5 text-t4 transition hover:bg-hover hover:text-t1"
        >
          <Icon name="x" size={16} />
        </button>
      </header>

      {/* ------------------------------------------------------------- pestanas */}
      <div className="flex shrink-0 gap-1 border-b border-line px-5 pt-2">
        {(
          [
            ['appearance', 'settings.tab.appearance'],
            ['account', 'settings.tab.account'],
          ] as const
        ).map(([id, clave]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-selected={tab === id}
            role="tab"
            className={[
              'rounded-t-lg px-3 py-2 text-xs font-medium transition',
              tab === id ? 'border-b-2 border-accent text-t1' : 'text-t4 hover:text-t2',
            ].join(' ')}
          >
            {t(clave)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {tab === 'appearance' ? (
          <div className="flex flex-col gap-6">
            <Field label={t('settings.theme')} hint={t('settings.theme.hint')}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {APP_THEME_VALUES.map((valor) => {
                  const activo = tema === valor;
                  const muestras = APP_THEME_SWATCHES[valor] ?? [];

                  return (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => void cambiarTema(valor)}
                      aria-pressed={activo}
                      className={[
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                        activo
                          ? 'bg-info/15 ring-2 ring-accent'
                          : 'bg-hover ring-1 ring-line hover:bg-hover-2',
                      ].join(' ')}
                    >
                      {/*
                        Muestra de color: fondo, texto y acento del tema. Es la
                        unica forma de elegir un tema viendo el color de verdad
                        y no leyendo el nombre.
                      */}
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 overflow-hidden rounded-md ring-1 ring-line-strong"
                      >
                        {muestras.map((color) => (
                          <span
                            key={color}
                            className="h-full flex-1"
                            style={{ background: color }}
                          />
                        ))}
                      </span>

                      <span
                        className={['truncate text-xs font-medium', activo ? 'text-t1' : 'text-t2'].join(
                          ' ',
                        )}
                      >
                        {THEME_LABELS[valor] ?? valor}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label={t('settings.language')} hint={t('settings.language.hint')}>
              <LocaleSelect
                value={idioma}
                onChange={(valor) => void cambiarIdioma(valor)}
                label={t('settings.language')}
              />
            </Field>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* --------------------------------------------------- estado actual */}
            {/*
              El estado de la conexion va en verde **solo cuando hay conexion**.
              Antes el estado de exito vivia en un aviso aparte que ponia
              "Ajustes guardados" tambien cuando lo unico que habia pasado era
              elegir un tema, que no es una conexion. Aqui se ve si la cuenta
              esta conectada de verdad, sin depender de que haya flashed un
              aviso.
            */}
            <div
              className={[
                'flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ring-1',
                cuenta.conectado
                  ? 'bg-ok/10 text-ok ring-ok/30'
                  : 'bg-hover text-t2 ring-line',
              ].join(' ')}
            >
              <span className="inline-flex items-center gap-2 text-xs">
                {cuenta.conectado ? (
                  <>
                    <Icon name="check-circle" size={13} />
                    <strong className="font-medium">{t('settings.steam.linkedOk')}</strong>
                    <span className="opacity-75">· {t('settings.steam.linked', [cuenta.steamId])}</span>
                  </>
                ) : (
                  t('settings.steam.notLinked')
                )}
              </span>

              <Badge
                label={
                  cuenta.juegos > 0 ? t('settings.steam.games', [cuenta.juegos]) : '—'
                }
                tone={
                  cuenta.conectado
                    ? 'bg-ok/15 text-ok ring-ok/30'
                    : 'bg-hover text-t3 ring-line'
                }
              />
            </div>

            {/*
              El enlace va **dentro** de la ayuda y no al lado. Es el paso
              siguiente ahi mismo: quien lee que la clave es gratuita ya sabe
              que tiene que ir a buscarla, y solo falta que no haya que copiar
              la direccion a mano para llegar.
            */}
            <Field
              label={t('settings.apiKey')}
              hint={
                <>
                  {t('settings.apiKey.hint')}{' '}
                  <ExternalLink url={STEAM_API_KEY_URL}>
                    {t('settings.apiKey.link')}
                  </ExternalLink>
                </>
              }
            >
              <PasswordInput
                value={apiKey}
                onChange={(valor) => setApiKey(normalizarClaveApi(valor))}
                labelVisible={t('settings.apiKey.show')}
                labelHidden={t('settings.apiKey.hide')}
                placeholder={t('settings.apiKey.placeholder')}
              />
            </Field>

            <Field label={t('settings.steamId.label')} hint={t('settings.steamId.hint')}>
              <input
                type="text"
                value={steamId}
                onChange={(event) => setSteamId(normalizarIdSteam(event.target.value))}
                placeholder={t('settings.steamId.placeholder')}
                autoComplete="off"
                spellCheck={false}
                className={INPUT_CLASS}
              />
            </Field>

            <p className="rounded-lg bg-warn/10 px-3 py-2 text-[11px] text-warn ring-1 ring-warn/20">
              {t('settings.steam.visibility')}
            </p>

            {error ? (
              <p
                role="alert"
                className="rounded-lg bg-danger/10 px-3 py-2 text-[11px] text-danger ring-1 ring-danger/20"
              >
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon="refresh"
                onClick={() => void conectar()}
                disabled={ocupado || !cuentaValida || apiKey.length === 0}
                title={
                  !cuentaValida
                    ? t('settings.steam.needId')
                    : apiKey.length === 0
                      ? t('settings.steam.needKey')
                      : t('settings.steam.link')
                }
              >
                {t('settings.steam.link')}
              </Button>

              <Button
                variant="ghost"
                onClick={() => void olvidar()}
                disabled={ocupado || settings.steamApiKey.length === 0}
                title={t('settings.steam.forgetHint')}
              >
                {t('settings.steam.forget')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}