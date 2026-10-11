import { Icon } from './icon.component';
import { useT } from '@/context/locale.context';
import { LOCALE_BCP47, type ISteamOwnedGame, type SteamAccountStatus } from '@/contracts';
import { formatShortDate } from '@/helpers/format-date.helper';

/**
 * Tabla de juegos de Steam.
 *
 * Se parece a la de claves en forma pero no en contenido: aqui no hay nada
 * que editar ni que regalar, asi que las acciones desaparecen y solo queda
 * el catalogo con sus datos. Lo que interesa aqui es saber **que tienes** y
 * **cual de tus claves ya esta en la biblioteca**, que es la pregunta que uno
 * se hace al abrir la app.
 */
export function SteamGamesTable({
  juegos,
  cuenta,
  /** AppIds que ya tienen alguna clave en la coleccion. */
  conClave,
  onRefresh,
  busy,
}: {
  juegos: readonly ISteamOwnedGame[];
  cuenta: SteamAccountStatus;
  conClave: ReadonlySet<number>;
  onRefresh: () => void;
  busy: boolean;
}) {
  const { t, locale } = useT();

  const ordenados = [...juegos].sort((a, b) => {
    if (b.playtimeForever !== a.playtimeForever) {
      return b.playtimeForever - a.playtimeForever;
    }

    // Se ordena con el idioma de la app, no con 'es' fijo: en alemán la E y la A
    // no se ordenan igual, y con castellano la lista salia en orden distinto al
    // que el usuario tiene delante.
    return a.name.localeCompare(b.name, LOCALE_BCP47[locale]);
  });

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-3 px-1">
        <div className="leading-tight">
          <h2 className="text-sm font-medium text-t1">{t('view.games')}</h2>
          <p className="text-[11px] text-t4">
            {t('footer.count', [cuenta.juegos, cuenta.juegos])}
          </p>
        </div>

        {cuenta.sincronizadoAt ? (
          <span className="text-[11px] text-t4">
            {t('settings.steam.syncedAt', [
              formatShortDate(cuenta.sincronizadoAt, locale),
            ])}
          </span>
        ) : null}

        <button
          type="button"
          onClick={onRefresh}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-t3 transition hover:bg-hover hover:text-t1 disabled:opacity-40"
          title={t('settings.steam.link')}
        >
          <Icon name="refresh" size={12} />
          {t('settings.steam.link')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-surface-1 ring-1 ring-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2 text-left text-[11px] uppercase tracking-wide text-t4">
            <tr>
              <th className="w-14 px-3 py-2 font-medium" />
              <th className="px-3 py-2 font-medium">{t('library.name')}</th>
              <th className="w-28 px-3 py-2 text-right font-medium">
                {t('library.playtimeShort')}
              </th>
              <th className="w-40 px-3 py-2 font-medium">{t('library.owned')}</th>
            </tr>
          </thead>

          <tbody>
            {ordenados.map((juego) => (
              <tr
                key={juego.appId}
                className="border-t border-line-soft transition hover:bg-hover"
              >
                <td className="px-3 py-2">
                  {juego.iconUrl ? (
                    <img
                      src={juego.iconUrl}
                      alt=""
                      loading="lazy"
                      className="h-8 w-8 rounded"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-hover text-t4">
                      <Icon name="gamepad" size={14} />
                    </div>
                  )}
                </td>

                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-t1">{juego.name}</span>
                    {juego.isDlc ? (
                      <span className="shrink-0 rounded border border-line px-1 text-[10px] text-t4">
                        {t('owned.dlc')}
                      </span>
                    ) : null}
                  </div>
                </td>

                <td className="px-3 py-2 text-right text-xs text-t3 tabular-nums">
                  {juego.playtimeForever > 0
                    ? t('library.playtime', [
                        (juego.playtimeForever / 60).toFixed(1),
                      ])
                    : '—'}
                </td>

                <td className="px-3 py-2">
                  {juego.playtimeForever === 0 ? (
                    <span className="text-xs text-t4">
                      {t('library.notPlayed')}
                    </span>
                  ) : conClave.has(juego.appId) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-[11px] text-ok ring-1 ring-ok/30">
                      <Icon name="check" size={11} />
                      {t('owned.owned')}
                    </span>
                  ) : (
                    <span className="text-xs text-t3">
                      {t('owned.unverified')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}