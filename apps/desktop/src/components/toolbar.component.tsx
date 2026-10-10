import { KEY_PLATFORM_META } from '@/contracts/constants/key-platform.constants';
import { KEY_STATUS_META } from '@/contracts/constants/key-status.constants';
import { SEARCH_SHORTCUT } from '@/contracts/constants/app.constants';
import { KEY_PLATFORM_VALUES, KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KEY_STATUS_VALUES, KeyStatus } from '@/contracts/enums/key-status.enum';
import { KeySort } from '@/contracts/enums/key-sort.enum';
import { Icon } from './icon.component';
import { Badge, Button, INPUT_CLASS, SELECT_CLASS } from './ui.component';
import type { IKeyFilter, IKeyStats } from '@/contracts/interfaces/key-filter.interface';

export interface IToolbarProps {
  filter: IKeyFilter;
  stats: IKeyStats;
  sort: KeySort;
  busy: boolean;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onFilterChange: (patch: Partial<IKeyFilter>) => void;
  onSortChange: (sort: KeySort) => void;
  onCreate: () => void;
  onImport: () => void;
  onExport: () => void;
  onOpenStorage: () => void;
  onToggleFilters: () => void;
  onToggleGiftMode: () => void;
  giftMode: boolean;
  filtersOpen: boolean;
}

const SORTS: ReadonlyArray<{ value: KeySort; label: string }> = [
  { value: KeySort.Reciente, label: 'Mas recientes' },
  { value: KeySort.Alfabetico, label: 'A - Z' },
  { value: KeySort.Estado, label: 'Por estado' },
  { value: KeySort.Plataforma, label: 'Por plataforma' },
];

/** Barra superior: buscador, filtros rapidos y acciones. */
export function Toolbar({
  filter,
  stats,
  sort,
  busy,
  searchRef,
  onFilterChange,
  onSortChange,
  onCreate,
  onImport,
  onExport,
  onOpenStorage,
  onToggleFilters,
  onToggleGiftMode,
  giftMode,
  filtersOpen,
}: IToolbarProps) {
  const activeChips = filter.platforms.length + filter.statuses.length;

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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400 ring-1 ring-blue-500/25">
            <Icon name="key" size={18} />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold text-slate-100">Steam Keys</h1>
            <p className="text-[11px] text-slate-500">
              {stats.available} disponibles de {stats.total}
            </p>
          </div>
        </div>

        <div className="relative min-w-[14rem] flex-1 max-[900px]:order-last max-[900px]:basis-full">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
          />
          <input
            ref={searchRef}
            type="search"
            value={filter.search}
            placeholder="Buscar por juego, clave, destinatario o nota…"
            onChange={(event) => onFilterChange({ search: event.target.value })}
            className={`${INPUT_CLASS} pl-9`}
          />
          {filter.search.length === 0 ? (
            <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">
              {SEARCH_SHORTCUT}
            </kbd>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={giftMode ? 'primary' : 'ghost'}
            icon="gift"
            onClick={onToggleGiftMode}
            title="Seleccionar varios juegos para regalar"
          >
            Regalar
          </Button>

          <Button
            variant={activeChips > 0 || filtersOpen ? 'subtle' : 'ghost'}
            icon="filter"
            onClick={onToggleFilters}
            title="Filtros por plataforma y estado"
          >
            Filtros
            {activeChips > 0 ? (
              <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
                {activeChips}
              </span>
            ) : null}
          </Button>

          <div className="relative">
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as KeySort)}
              className={`${SELECT_CLASS} w-40 max-w-[45vw] py-2 pr-8`}
              aria-label="Ordenar por"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Button variant="ghost" icon="download" onClick={onExport} title="Exportar a TXT">
            Exportar
          </Button>
          <Button
            variant="ghost"
            icon="upload"
            onClick={onImport}
            disabled={busy}
            title="Importar desde el TXT original"
          >
            Importar
          </Button>
          <Button
            variant="ghost"
            icon="package"
            onClick={onOpenStorage}
            title="Datos, copias de seguridad y salud de la base de datos"
          >
            Datos
          </Button>

          <Button variant="primary" icon="plus" onClick={onCreate}>
            Anadir
          </Button>
        </div>
      </div>

      {filtersOpen ? (
        <div className="animate-fade-in border-t border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                Plataforma
              </span>
              {KEY_PLATFORM_VALUES.map((platform) => {
                const meta = KEY_PLATFORM_META[platform];
                const active = filter.platforms.includes(platform);
                const count = stats.byPlatform[platform] ?? 0;

                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    disabled={count === 0}
                    className={[
                      'rounded-full transition',
                      active ? 'ring-2 ring-blue-500/60' : 'opacity-55 hover:opacity-100',
                      count === 0 ? 'cursor-not-allowed opacity-25' : '',
                    ].join(' ')}
                  >
                    <Badge
                      label={`${meta.short} ${count}`}
                      tone={meta.tone}
                      icon={meta.icon}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                Estado
              </span>
              {KEY_STATUS_VALUES.map((status) => {
                const meta = KEY_STATUS_META[status];
                const active = filter.statuses.includes(status);

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className={[
                      'rounded-full transition',
                      active ? 'ring-2 ring-blue-500/60' : 'opacity-55 hover:opacity-100',
                    ].join(' ')}
                  >
                    <Badge label={meta.label} tone={meta.tone} icon={meta.icon} title={meta.hint} />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4">
              <Toggle
                label="Solo regalables"
                checked={filter.onlyGiftable}
                onChange={(checked) => onFilterChange({ onlyGiftable: checked })}
              />
              <Toggle
                label="Solo DLC"
                checked={filter.onlyAddOns}
                onChange={(checked) => onFilterChange({ onlyAddOns: checked })}
              />
              <button
                type="button"
                onClick={() =>
                  onFilterChange({
                    search: '',
                    platforms: [],
                    statuses: [],
                    onlyGiftable: false,
                    onlyAddOns: false,
                  })
                }
                className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

interface IToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ label, checked, onChange }: IToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200"
    >
      <span
        className={[
          'relative h-4 w-7 rounded-full transition-colors',
          checked ? 'bg-blue-600' : 'bg-surface-3',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform',
            checked ? 'translate-x-3.5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
      {label}
    </button>
  );
}