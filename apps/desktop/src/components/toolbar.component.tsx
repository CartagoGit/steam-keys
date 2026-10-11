import { KEY_PLATFORM_META, platformLabel } from '@/contracts/constants/key-platform.constants';
import { statusMeta } from '@/contracts/constants/key-status.constants';
import { SEARCH_SHORTCUT } from '@/contracts/constants/app.constants';
import { KEY_PLATFORM_VALUES, KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KEY_STATUS_VALUES, KeyStatus } from '@/contracts/enums/key-status.enum';
import { KeySort } from '@/contracts/enums/key-sort.enum';
import { Icon } from './icon.component';
import { Button, INPUT_CLASS, SELECT_CLASS } from './ui.component';
import { Chip, ChipGroup } from './chip.component';
import { Segmented } from './segmented.component';
import { ViewSwitch } from './view-switch.component';
import { useT } from '@/context/locale.context';
import { TRANSLATIONS } from '@/contracts/constants/i18n.constants';
import { KeyKind, KeyScope } from '@/contracts/enums/key-scope.enum';
import { AppView } from '@/contracts/enums/app-view.enum';
import {
  statusesUsables,
} from '@/helpers/filter-keys.helper';
import type { IKeyFilter, IKeyStats } from '@/contracts/interfaces/key-filter.interface';
import type { SteamAccountStatus } from '@/contracts/interfaces/steam-account.interface';

export interface IToolbarProps {
  filter: IKeyFilter;
  stats: IKeyStats;
  sort: KeySort;
  busy: boolean;
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
  onImport: () => void;
  onExport: () => void;
  onOpenStorage: () => void;
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
  busy,
  searchRef,
  view,
  cuenta,
  onFilterChange,
  onSortChange,
  onViewChange,
  onOpenSteamSettings,
  onCreate,
  onImport,
  onExport,
  onOpenStorage,
  onOpenSettings,
}: IToolbarProps) {
  const { t, locale } = useT();

  const togglePlatform = (platform: KeyPlatform): void => {
    const next = filter.platforms.includes(platform)
      ? filter.platforms.filter((item) => item !== platform)
      : [...filter.platforms, platform];

    onFilterChange({ platforms: next });
  };

  const toggleStatus = (status: KeyStatus): void => {
    const next = filter.statuses.includes(status)
      ? filter.statuses.filter((item) => item !== status)
      : [...filter.statuses, status];

    onFilterChange({ statuses: next });
  };

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
        */}
        <div className="flex flex-wrap items-center gap-2">
          {/*
            El interruptor de "solo disponibles" se ha ido al panel de filtros,
            junto al de tipo. Aqui solo queda lo que no es un filtro de la
            lista: el buscador, el orden y las acciones.
          */}

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

          <Button variant="ghost" icon="download" onClick={onExport} title={t('toolbar.export')}>
            {t('toolbar.export')}
          </Button>
          <Button
            variant="ghost"
            icon="upload"
            onClick={onImport}
            disabled={busy}
            title={t('toolbar.import')}
          >
            {t('toolbar.import')}
          </Button>
          <Button
            variant="ghost"
            icon="package"
            onClick={onOpenStorage}
            title={t('toolbar.data')}
          >
            {t('toolbar.data')}
          </Button>

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
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
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

          {/*
            Los chips de plataforma y de estado van en recuadros distintos,
            cada uno con su titulo: a primera vista los de plataforma son
            rectangulos azules y los de estado redondos con su punto de color.
            Antes eran dos hileras de pastillas iguales y no se distinguian
            sin leer los titulos.
          */}
          <ChipGroup label={t('filter.platform')} tone="sky">
            {KEY_PLATFORM_VALUES.map((platform) => {
              const meta = KEY_PLATFORM_META[platform];
              const active = filter.platforms.includes(platform);
              const count = stats.byPlatform[platform] ?? 0;

              return (
                <Chip
                  key={platform}
                  label={meta.short}
                  count={count}
                  active={active}
                  icon={meta.icon}
                  onClick={() => togglePlatform(platform)}
                  title={`${platformLabel(platform, TRANSLATIONS[locale])} — ${count}`}
                />
              );
            })}
          </ChipGroup>

          <ChipGroup
            label={t('filter.status')}
            tone="emerald"
            disabled={!statusesUsables(filter)}
            disabledTitle={t('filter.status.locked')}
          >
            {KEY_STATUS_VALUES.map((status) => {
              const meta = statusMeta(status, TRANSLATIONS[locale]);
              const active = filter.statuses.includes(status);

              return (
                <Chip
                  key={status}
                  label={meta.label}
                  active={active}
                  icon={meta.icon}
                  dot={meta.tone}
                  onClick={() => toggleStatus(status)}
                  title={meta.hint}
                />
              );
            })}
          </ChipGroup>

          <button
            type="button"
            onClick={() =>
              onFilterChange({
                search: '',
                scope: KeyScope.Available,
                kind: KeyKind.All,
                platforms: [],
                statuses: [],
              })
            }
            className="ml-auto text-xs text-t4 underline-offset-2 hover:text-t2 hover:underline"
            title={t('filter.reset')}
          >
            {t('action.clear')}
          </button>
        </div>
      </div>
      ) : null}
    </header>
  );
}
