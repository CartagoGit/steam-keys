import { AppView, type SteamAccountStatus } from '@/contracts';
import { Icon } from './icon.component';
import { Button } from './ui.component';
import { useT } from '@/context/locale.context';

export interface IViewSwitchProps {
  view: AppView;
  onChange: (view: AppView) => void;
  /** Estado de la cuenta, para saber si la vista de juegos se puede abrir. */
  cuenta: SteamAccountStatus;
  /** `true` si el usuario ha pedido abrir ajustes a la pestaña de Steam. */
  onOpenSteamSettings: () => void;
  /** Numero de claves que hay ahora mismo. */
  claves: number;
}

/**
 * Selector entre la tabla de claves y la de juegos de Steam.
 *
 * Vive en el header y no en los filtros porque no es un filtro: **cambia de
 * tabla entera**. Por eso esta junto al titulo, que es donde se busca la
 * diferencia, y no al final de una fila de filtros.
 *
 * Cuando no hay cuenta conectada y se elige la vista de juegos, en vez de
 * mostrar una tabla vacia sin explicacion, se abre directamente la pestana de
 * la cuenta dentro de los ajustes: es el paso siguiente y no hay que buscarlo.
 */
export function ViewSwitch({
  view,
  onChange,
  cuenta,
  onOpenSteamSettings,
  claves,
}: IViewSwitchProps) {
  const { t } = useT();
  const sinCuenta = !cuenta.conectado;

  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-lg bg-hover p-1 ring-1 ring-line"
      role="tablist"
      aria-label={t('view.label')}
    >
      <ViewButton
        activo={view === AppView.Keys}
        onClick={() => onChange(AppView.Keys)}
        title={`${t('view.keys')} (${claves})`}
      >
        <Icon name="key" size={12} />
        {t('view.keys')}
      </ViewButton>

      <ViewButton
        activo={view === AppView.Games}
        onClick={() => {
          if (sinCuenta) {
            // Sin cuenta no hay nada que ver, asi que se lleva directamente al
            // sitio donde se configura. Abrir una tabla vacia sin decir nada
            // es la forma de que parezca que la app esta rota.
            onOpenSteamSettings();
            return;
          }

          onChange(AppView.Games);
        }}
        tono="sky"
        title={
          sinCuenta
            ? t('library.empty')
            : `${t('view.games')} (${cuenta.juegos})`
        }
      >
        <Icon name="gamepad" size={12} />
        {t('view.games')}
      </ViewButton>
    </div>
  );
}

interface IViewButtonProps {
  activo: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  tono?: 'sky';
}

function ViewButton({ activo, onClick, title, children, tono }: IViewButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={activo}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        activo
          ? tono === 'sky'
            ? 'bg-info/20 text-info-strong ring-1 ring-info/50'
            : 'bg-info/20 text-info-strong ring-1 ring-info/50'
          : 'text-t3 hover:bg-hover-2 hover:text-t1',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/**
 * Lo que se ve en la vista de juegos cuando no hay cuenta.
 *
 * Va como pantalla completa y no como tabla vacia: es un estado distinto, con
 * su boton, no una coleccion sin resultados.
 */
export function SteamNotConnected({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-info/10 text-info ring-1 ring-info/20">
        <Icon name="gamepad" size={26} />
      </div>

      <div className="max-w-sm">
        <h3 className="text-sm font-medium text-t1">{t('view.games')}</h3>
        <p className="mt-1 text-xs leading-relaxed text-t3">{t('library.empty')}</p>
      </div>

      <Button variant="primary" icon="settings" onClick={onOpen}>
        {t('settings.title')}
      </Button>
    </div>
  );
}