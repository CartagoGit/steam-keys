import { AppView, type SteamAccountStatus } from '@/contracts';
import { Icon } from './icon.component';
import { Segmented } from './segmented.component';
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
    /*
     * `Segmented`, y no dos botones con `aria-pressed` hechos a mano.
     *
     * Lo era, y era peor por dos motivos a la vez. El primero es que el boton
     * activo se distinguia solo por un fondo azul y un anillo: al cambiar de
     * pestana no se veia **moverse** nada, y un cambio sin movimiento se lee
     * como un salto. Lo segundo es que la prop `tono` no hacia nada —las dos
     * ramas del ternario eran la misma clase—, asi que las dos pestanas salian
     * siempre en azul y el parametro que decia «esta es la de juegos, ponla en
     * otro color» era mentira.
     *
     * Ahora es el mismo componente que «Disponibles» y «Tipo»: misma pompa que
     * se desliza, mismo criterio de color, misma curva. Cambiar de tabla
     * entera se mueve igual que cambiar de filtro, que es lo que hace que se
     * lean como lo que son: dos palancas del mismo tipo.
     *
     * El color es el mismo para las dos (`emerald`) a proposito: no son dos
     * categorias de dato, son la misma tabla con distinto filtro. El color lo
     * pone lo que **significa** cada selector —el filtro de tipo en ambar, el
     * de estado en rojo— y aqui ninguna de las dos vistas es mas «buena» o
     * mas «mala» que la otra.
     *
     * Los iconos van por la prop `icon` de `Segmented` y no como `<Icon>`
     * dentro de un boton hecho a mano: asi los mide la pompa tambien, y si el
     * ancho se midiera con el icono dentro se descuadraria el texto.
     */
    <Segmented
      label={t('view.label')}
      sinTitulo
      tone="emerald"
      value={view}
      options={[
        { value: AppView.Keys, label: `${t('view.keys')} (${claves})`, icon: 'key' },
        { value: AppView.Games, label: `${t('view.games')} (${cuenta.juegos})`, icon: 'gamepad' },
      ]}
      onChange={(elegida) => {
        if (elegida === AppView.Keys) {
          onChange(AppView.Keys);
          return;
        }

        /*
         * Sin cuenta no hay nada que ver, asi que se lleva directamente al
         * sitio donde se configura. Abrir una tabla vacia sin decir nada es la
         * forma de que parezca que la app esta rota.
         */
        if (sinCuenta) {
          onOpenSteamSettings();
          return;
        }

        onChange(AppView.Games);
      }}
      disabledTitle={sinCuenta ? t('library.empty') : undefined}
    />
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