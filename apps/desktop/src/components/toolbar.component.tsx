import { useMemo } from 'react';
import { AppView, KEY_PLATFORM_META, KEY_PLATFORM_VALUES, KEY_STATUS_VALUES, KeyKind, KeyScope, KeySort, SEARCH_SHORTCUT, TRANSLATIONS, platformLabel, statusMeta, type IKeyFilter, type IKeyStats, type ITag, type SteamAccountStatus } from '@/contracts';
import { Icon } from './icon.component';
import { Button, INPUT_CLASS, SELECT_CLASS } from './ui.component';
import { FilterMenu } from './filter-menu.component';
import { Segmented } from './segmented.component';
import { ViewSwitch } from './view-switch.component';
import { useT } from '@/context/locale.context';

export interface IToolbarProps {
  filter: IKeyFilter;
  stats: IKeyStats;
  /** El catalogo de etiquetas, para el filtro de etiquetas. */
  catalogo: readonly ITag[];
  sort: KeySort;
  searchRef: React.RefObject<HTMLInputElement | null>;
  /** Que tabla se ve ahora mismo. */
  view: AppView;
  /** Estado de la cuenta de Steam, para el selector de vista. */
  cuenta: SteamAccountStatus;
  onFilterChange: (patch: Partial<IKeyFilter>) => void;
  onSortChange: (sort: KeySort) => void;
  onViewChange: (view: AppView) => void;
  /** Abrir los ajustes ya en la pestana de Steam. */
  onOpenSteamSettings: () => void;
  onCreate: () => void;
  onOpenSettings: () => void;
}

/**
 * Las opciones de orden, con su clave de traduccion.
 *
 * El texto se resuelve al pintar y no al declarar: aqui no hay contexto de
 * idioma todavia, y una vez translated el boton se queda en el idioma con el
 * que se abrio la app.
 */
const SORTS: ReadonlyArray<{ value: KeySort; clave: string }> = [
  { value: KeySort.Reciente, clave: 'sort.recent' },
  { value: KeySort.Alfabetico, clave: 'sort.alpha' },
  { value: KeySort.Estado, clave: 'sort.status' },
  { value: KeySort.Plataforma, clave: 'sort.platform' },
];

/** Barra superior: buscador, filtros rapidos y acciones. */
export function Toolbar({
  filter,
  stats,
  sort,
  searchRef,
  view,
  cuenta,
  onFilterChange,
  onSortChange,
  onViewChange,
  onOpenSteamSettings,
  onCreate,
  onOpenSettings,
  catalogo,
}: IToolbarProps) {
  const { t, locale } = useT();

  /**
   * Las etiquetas del catalogo, como opciones del filtro.
   *
   * El nombre va **tal cual**, sin pasar por `t()` para nada mas: es texto del
   * usuario, no una clave de traduccion. `FilterMenu` lo pasa por `t` al
   * pintar, y ahi `t` devuelve lo que le dan si no lo encuentra, con lo que
   * sale tal cual —que es lo unico razonable, porque traducir una etiqueta
   * propia no tiene sentido.
   *
   * Se ordenan por **numero de usos, de mas a menos**, no alfabeticamente: las
   * que se usan estan a mano para marcar y las que no, al fondo de la lista
   * donde estorban menos. Con el catalogo ya ordenado por usos, es solo un
   * `slice` del orden de la base.
   */
  const opcionesEtiqueta = useMemo(
    () => catalogo.map((tag) => ({ value: tag.nombre, label: tag.nombre, count: tag.usos })),
    [catalogo],
  );

  /**
   * Los recuentos de plataforma, para la lista del desplegable.
   *
   * Salen de `stats`, que ya viene calculado, en vez de contarlos aqui: es
   * el mismo dato que hay en el `byPlatform` de la barra y en el de abajo.
   */
  const opcionesPlataforma = useMemo(
    () =>
      KEY_PLATFORM_VALUES.map((platform) => ({
        value: platform,
        label: platformLabel(platform, TRANSLATIONS[locale]),
        icon: KEY_PLATFORM_META[platform].icon,
        count: stats.byPlatform[platform] ?? 0,
      })),
    [locale, stats.byPlatform],
  );

  /**
   * Las etiquetas de estado, con su color.
   *
   * El color es el del propio estado —el que ya se usa en la tabla y en las
   * pastillas—, no uno generico para el filtro entero. Es lo que permite
   * reconocer «canducadas» por el color sin leer el nombre.
   */
  const opcionesEstado = useMemo(
    () =>
      KEY_STATUS_VALUES.map((status) => ({
        value: status,
        label: statusMeta(status, TRANSLATIONS[locale]).label,
        dot: statusMeta(status, TRANSLATIONS[locale]).tone,
      })),
    [locale],
  );

  return (
    <header className="shrink-0 border-b border-line bg-surface-1">
      {/* Una sola fila mientras hay sitio; al estrechar, el buscador se baja a
          una fila propia y los botones se reparten. Con `flex-wrap` a secas se
          apretaba todo hasta que los botones se cortaban a media palabra. */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5 pr-2">
          {/*
            El logo de la app, el mismo que va en la barra de tareas y en el
            favicon. Antes aqui habia un icono de llave dibujado con lineas: se
            veia bien dentro de la app, pero no era el mismo que aparecia en la
            barra de tareas, y una app cuyo icono cambia entre la ventana y la
            barra parece dos apps distintas.
          */}
          <img
            src="/favicon.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-lg"
          />
          <div className="leading-tight">
            <h1 className="text-sm font-semibold text-t1">{t('app.title')}</h1>
            <p className="text-[11px] text-t4">
              {t('app.subtitle', [stats.available, stats.total])}
            </p>
          </div>
        </div>

        {/*
          El selector de tabla va aqui y no en la fila de filtros porque no es
          un filtro: cambia de tabla entera. Los filtros dicen que claves se
          ven, este dice que coleccion.
        */}
        <ViewSwitch
          view={view}
          onChange={onViewChange}
          cuenta={cuenta}
          onOpenSteamSettings={onOpenSteamSettings}
          claves={stats.total}
        />

        <div className="relative min-w-[14rem] flex-1 max-[900px]:order-last max-[900px]:basis-full">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-t4"
          />
          <input
            ref={searchRef}
            type="search"
            value={filter.search}
            placeholder={t('search.placeholder')}
            onChange={(event) => onFilterChange({ search: event.target.value })}
            className={`${INPUT_CLASS} pl-9`}
          />
          {filter.search.length === 0 ? (
            <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-t4">
              {SEARCH_SHORTCUT}
            </kbd>
          ) : null}
        </div>

        {/*
          `flex-wrap` aqui no es cosmetico: sin el, los botones se salen por la
          derecha al estrechar la ventana y aparece una barra de scroll
          horizontal en toda la aplicacion. Con el, bajan a la fila siguiente.

          Aqui solo quedan el buscador, el orden y «Anadir». Exportar, Importar
          y Datos viven ya en **Ajustes > Claves**: son de la base de datos, se
          usan una vez cada varios meses y no tenian por que ocupar la barra de
          trabajo del dia a dia.
        */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as KeySort)}
              className={`${SELECT_CLASS} w-40 max-w-[45vw] py-2 pr-8`}
              aria-label={t('toolbar.sort')}
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.clave)}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="ghost"
            icon="settings"
            onClick={onOpenSettings}
            title={t('toolbar.settings')}
          >
            {t('toolbar.settings')}
          </Button>

          <Button variant="primary" icon="plus" onClick={onCreate}>
            {t('toolbar.add')}
          </Button>
        </div>
      </div>

      {/*
        Los filtros solo tienen sentido en la tabla de claves, asi que en la
        vista de juegos desaparece la fila entera en vez de quedar apagada:
        para quien esta mirando sus juegos, un filtro de plataforma es ruido.

        Y dentro de la tabla de claves no se ocultan tras un boton: escondidos
        obligaban a dos pulsaciones para cambiar de vista, que es la forma
        segura de no filtrar nunca y acabar creyendo que la lista ya viene
        filtrada.

        El orden es por decision, no por costumbre: primero los dos selectores
        que dicen **que se esta viendo** (estado y tipo), y despues los chips
        que afinan.

        Con "solo disponibles" activo se apaga **solo el filtro de estado**, y
        no el de tipo. Son cosas distintas y solo una sobra:

        - Estado: "muestra las regaladas" con el filtro en "solo disponibles"
          no significa nada. Todo lo visible ya esta disponible, asi que acortar
          por estado solo puede dar la lista vacia. Por eso se apaga, con el
          motivo en el tooltip.
        - Tipo: "solo DLC" con el filtro en "solo disponibles" significa "los
          DLC que aun tengo", y eso es una consulta de lo mas normal. Se
          bloqueaba antes solo por simetria con el de estado, y lo unico que
          conseguia era impedir responderla.
      */}
      {view === AppView.Keys ? (
      <div className="border-t border-line px-4 py-2.5">
        {/*
          `items-start`, no `items-center`.

          Con `items-center` cada bloque se centraba dentro de la linea, y
          mientras todos median lo mismo no se notaba. En cuanto un filtro
          cambio de alto —que es lo que hace la columna de tags al growar— la
          linea la marco su alto y los demas se hundieron: «Estado» y
          «Etiquetas» quedaron treinta y tantos pixeles por debajo de
          «Plataforma», con sus titulos descentrados y sus botones en otra
          fila visual.

          Arriba, todos los titulos comparten linea y todos los botones
          tambien, que es de lo que se trata en una fila de filtros.
        */}
        <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
          {/*
            Los cuatro filtros, cada uno con su color.

            No es decoracion: son cuatro preguntas distintas —cuales veo, de
            que tipo, de que plataforma, en que estado— y con el mismo color
            los cuatro parecian el mismo filtro cuatro veces. Con el color se
            distinguen de reojo y no hace falta leer el titulo.

            El de disponibilidad va en verde porque es el estado «bueno» por
            definicion: «solo disponibles» es una opinion sobre la clave, no
            una categoria. El de tipo en ambar, el de plataforma en azul y el
            de estado en rojo, que es donde acaban las claves que ya no
            sirven.
          */}
          <Segmented
            options={[
              { value: KeyScope.All, label: t('filter.scope.all') },
              { value: KeyScope.Available, label: t('filter.scope.available') },
            ]}
            value={filter.scope}
            onChange={(scope) => onFilterChange({ scope })}
            tone="emerald"
            label={t('filter.scope.label')}
          />

          <Segmented
            options={[
              { value: KeyKind.All, label: t('filter.kind.all') },
              { value: KeyKind.Games, label: t('filter.kind.games') },
              { value: KeyKind.Dlc, label: t('filter.kind.dlc') },
            ]}
            value={filter.kind}
            onChange={(kind) => onFilterChange({ kind })}
            tone="amber"
            label={t('filter.kind.label')}
          />

          <FilterMenu
            label={t('filter.platform')}
            options={opcionesPlataforma}
            selected={filter.platforms}
            onChange={(platforms) => onFilterChange({ platforms: [...platforms] })}
            allLabel={t('filter.menu.all')}
            tone="sky"
          />

          <FilterMenu
            label={t('filter.status')}
            options={opcionesEstado}
            selected={filter.statuses}
            onChange={(statuses) => onFilterChange({ statuses: [...statuses] })}
            allLabel={t('filter.menu.all')}
            tone="rose"
          />

          {/*
            El filtro de etiquetas, el ultimo de la barra.

            Va al final porque es el que menos se usa de los cuatro: se abre
            cuando se busca «mis cosas de aquel tema», no cada dos minutos como
            el ambito. Con el catalogo vacio —una coleccion recien creada— no se
            pinta: un desplegable de etiquetas con la lista vacia no invita a
            marcar nada.
          */}
          {catalogo.length > 0 ? (
            <FilterMenu
              label={t('filter.tags')}
              options={opcionesEtiqueta}
              selected={filter.tags}
              onChange={(tags) => onFilterChange({ tags: [...tags] })}
              allLabel={t('filter.menu.all')}
              tone="violet"
              excluir={filter.excluir}
              onExcluir={(excluir) => onFilterChange({ excluir })}
              // Entre llaves y con comillas simples, no como atributo pelado:
              // el guard de claves muertas busca el literal con comillas
              // simples y en el atributo no lo encontraria, y daria por buena
              // una pista que en realidad nadie ve.
              footHint={'filter.tags.footHint'}
            />
          ) : null}

          {/*
            «Limpiar», con la misma forma que todo lo demas de la fila.

            Antes era un enlace con subrayado, sin fondo y mas bajo: el texto
            suelto mide 16 px y un boton con relleno 32. En una fila de cinco
            botones redondeados se leia como otra cosa, no como un boton.

            Ahora es boton, con el mismo `py-2` que los desplegables —la misma
            cifra que lleva el boton del pompa por dentro— para que todos midan
            lo mismo. El hueco de arriba lleva un titulo invisible con las
            mismas clases que los de los filtros, que es lo unico que alinea sin
            un numero magico, y `self-start` porque la fila ya no centra.

            Y lleva una cruz y el tono de peligro. Es la unica accion de la
            barra que **tira algo**: no cambia lo que se ve, deshace. Con el
            tono neutro de antes no se distinguia de un filtro mas, y con solo
            un subrayado el peligro —«se me va a borrar la busqueda»— no se
            anunciaba en ninguna parte. El tono fuerte solo en el hover, para
            que estar encima no grite.
          */}
          <div className="ml-auto flex shrink-0 flex-col gap-1.5 self-start">
            <span aria-hidden="true" className="invisible text-[10px] font-medium tracking-wide uppercase">
              {t('filter.reset')}
            </span>

            <button
              type="button"
              onClick={() =>
                onFilterChange({
                  search: '',
                  scope: KeyScope.Available,
                  kind: KeyKind.All,
                  platforms: [],
                  statuses: [],
                  // Sin esto el filtro de etiquetas sobrevive a «Limpiar»: la
                  // lista se queda filtrada y el boton dice todo lo contrario.
                  tags: [],
                  // Y tampoco la exclusion, que si no el filtro sigue
                  // acotando con un «y» que ya no se ve en ninguna parte.
                  excluir: false,
                })
              }
              title={t('filter.reset')}
              className={[
                'inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-3.5 py-2',
                'text-sm font-medium transition-colors',
                // El borde va a /60 y no /30 porque a /30 el circulo se ve
                // dibujado pero no se ve * delineado: el contraste contra el
                // fondo salia en 1.3:1, y un borde que no se distingue del
                // fondo no es un borde. A /60 pasa de 3:1, que es lo que pide
                // el criterio de contraste no textual para los limites de un
                // control.
                'border border-danger/60 bg-danger/10 text-danger-strong',
                'hover:border-danger hover:bg-danger hover:text-on-danger',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              ].join(' ')}
            >
              {/* Mismo tamano de icono, mismo `gap` y mismo `px` que el
                  boton de «Anadir»: si el uno mide 15px con 8px de separacion
                  y el otro 12px con 6px, los dos botones de la misma barra se
                  leen como de familias distintas. */}
              <Icon name="x" size={15} className="shrink-0" />

              {t('action.clear')}
            </button>
          </div>
        </div>
      </div>
      ) : null}
    </header>
  );
}
