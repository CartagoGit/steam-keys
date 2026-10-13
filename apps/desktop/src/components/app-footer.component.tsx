import { Fragment } from 'react';
import { useMemo } from 'react';
import { Icon } from './icon.component';
import { ExternalLink } from './ui.component';
import { useT } from '@/context/locale.context';
import { pluralKey } from '@/helpers/i18n.helper';
import {
  STORAGE_MODE_LABEL,
  STORAGE_MODE_NOTICE,
  getStorageMode,
} from '@/helpers/runtime.helper';
import {
  AppView,
  FIRMA_CODIGO,
  FIRMA_PERFIL,
  PERFIL_URL,
  PROYECTO_URL,
  SEARCH_SHORTCUT,
  KEY_PLATFORM_VALUES,
  TRANSLATIONS,
  platformLabel,
  KeyKind,
  KeyPlatform,
  KeyScope,
  KeyStatus,
  StorageMode,
  type IKeyFilter,
  type SteamAccountStatus,
} from '@/contracts';
import type { IUndoEntry } from '@/helpers/undo.helper';
import { apagarFiltro, coincide, type IResumenPie, type ITrozoPie } from '@/helpers/resumen-pie.helper';

export interface IAppFooterProps {
  vista: AppView;
  /** Lo que se ve ahora y lo que hay en total, para el recuento con filtro. */
  visibleCount: number;
  totalCount: number;
  /**
   * Lo que dicen las claves que se ven.
   *
   * No es el mismo que el de la barra de filtros, que va sobre la coleccion
   * entera: los menus tienen que seguir diciendo cuantos hay de cada cosa para
   * poder elegirla. Este es el que responde a «y de estas que veo, cuantas hay
   * de cada tipo» y, mas alla de los estados, cuantas son de juegos repetidos,
   * de que plataformas y para cuanta gente.
   */
  resumen: IResumenPie;
  cuenta: SteamAccountStatus;
  /** Ultima accion que se puede deshacer, o `null`. */
  undo: IUndoEntry | null;
  /** El filtro de ahora, para marcar que tramos estan ya puestos. */
  filter: IKeyFilter;
  /** Cambia el filtro. Los tramos del pie la usan como botones. */
  onFilter: (changes: Partial<IKeyFilter>) => void;
  onUndo: () => void;
  onOpenShortcuts: () => void;
}

/**
 * Pie de la ventana: recuento, firma, estado del almacenamiento y atajos.
 *
 * Vive aparte porque no tiene estado propio y porque es donde se acumulan tres
 * cosas que cambian por motivos distintos: lo que se ve, como esta la base de
 * datos y que se puede deshacer. En el componente eran treinta lineas de JSX
 * entre la lista y los dialogos.
 */
export function AppFooter({
  vista,
  visibleCount,
  totalCount,
  resumen,
  cuenta,
  undo,
  filter,
  onFilter,
  onUndo,
  onOpenShortcuts,
}: IAppFooterProps) {
  const { t, locale } = useT();

  const modo = getStorageMode();

  /*
   * Los tramos del pie, en el orden en que se leen de izquierda a derecha.
   *
   * Es una lista y no JSX suelto porque tienen que ser **comparables**: el
   * boton se enciende con `coincide(filter, tramo.filtro)`, y para eso el
   * filtro tiene que ser un dato al que se pueda mirar, no algo que se
   * escriba de nuevo dentro del onclick. Con JSX suelto cada boton
   * compararia el filtro con una condicion distinta escrita a mano y
   * bastaria con que una se equivocara para que un tramo quedara
   * encendido sin estar puesto.
   *
   * Y van sin los que valen cero. «0 repetidas», «0 para 0 personas» y «otras
   * plataformas: 0» ocupan sitio para decir que no hay ninguna, y lo que se
   * pierde de vista es justamente el dato raro: las 47 claves repetidas.
   */
  const tramos = useMemo<ITrozoPie[]>(() => {
    if (vista === AppView.Games) return [];

    const trozos: ITrozoPie[] = [];

    /*
     * Enciende un tramo y devuelve lo que hay que mandarle a `patchFilter`.
     *
     * Lo del return es lo que hace que el boton sea de poner y quitar: si ya
     * esta puesto, devuelve el filtro **vaciado** —`{ statuses: [] }` en vez de
     * `{ statuses: ['gifted'] }`— y con eso `patchFilter`, que va por encima de
     * lo que hay, se queda sin filtrar por estado. Sin esto el boton se
     * pulsaba y no pasaba nada, porque reponer el mismo valor sobre el mismo
     * valor no cambia el filtro: el boton quedaria encendido y sin manera de
     * apagarlo, que es la peor forma de boton.
     *
     * Y por eso el filtro lleva tambien `scope: All` cuando toca el estado:
     * `filterKeys` **ignora** `statuses` mientras el ambito sea «solo
     * disponibles», que es el de por defecto, asi que sin esto el boton se
     * encendia y la lista no cambiaba. Al pulsarlo tambien se pone el ambito
     * en «todos», que es lo que hace falta para que el filtro de estado
     * signifique algo —y es lo que haria alguien desde el menu de la barra—.
     */
    const anade = (
      texto: string,
      filtro: Partial<IKeyFilter> | null,
      alPulsar?: Partial<IKeyFilter>,
    ): void => {
      const activo = filtro !== null && coincide(filter, filtro);

      // Un tramo sin filtro es solo informacion: no hay nada que poner ni que
      // quitar, y `{}` es lo que hace que al pulsarlo no change nada en vez de
      // reponer un filtro que no existe.
      const cambios = filtro === null ? {} : (activo ? apagarFiltro(filtro) : (alPulsar ?? filtro));

      trozos.push({ texto, activo, pulsable: filtro !== null, cambios });
    };

    if (resumen.available > 0) {
      anade(t('footer.available', [resumen.available]), { statuses: [KeyStatus.Available] }, {
        statuses: [KeyStatus.Available],
        scope: KeyScope.All,
      });
    }
    if (resumen.gifted > 0) {
      anade(t('footer.gifted', [resumen.gifted]), { statuses: [KeyStatus.Gifted] }, {
        statuses: [KeyStatus.Gifted],
        scope: KeyScope.All,
      });
    }
    if (resumen.redeemed > 0) {
      anade(t('footer.redeemed', [resumen.redeemed]), { statuses: [KeyStatus.Redeemed] }, {
        statuses: [KeyStatus.Redeemed],
        scope: KeyScope.All,
      });
    }
    if (resumen.expired > 0) {
      anade(t('footer.expired', [resumen.expired]), { statuses: [KeyStatus.Expired] }, {
        statuses: [KeyStatus.Expired],
        scope: KeyScope.All,
      });
    }
    if (resumen.addOns > 0) anade(t('footer.addOns', [resumen.addOns]), { kind: KeyKind.Dlc });

    /*
     * Los juegos, y las claves repetidas.
     *
     * «356 juegos» es el dato que mas cambia de un filtro a otro y el que
     * nadie tiene a la vista: con 403 claves no se sabe si son 403 juegos o
     * 40 con cinco DLC cada uno, y son cosas muy distintas. Al pincharlo se
     * dejan fuera las DLC y se ven solo los juegos base, que es la unica
     * forma de que el numero de la lista y el de arriba digan lo mismo.
     *
     * Las repetidas solo salen si hay alguna, porque un cero aqui es ruido y
     * ademas invites a creerse que ya se esta mirando una lista sin
     * duplicados cuando lo que pasa es que no hay.
     */
    if (resumen.titulos > 0) {
      anade(
        t(pluralKey(resumen.titulos, 'footer.tituloOne', 'footer.tituloMany'), [
          resumen.titulos,
        ]),
        { kind: KeyKind.Games },
      );
    }

    /*
     * Las repetidas y los destinatarios salen **sin filtro**, y es a proposito.
     *
     * Los dos son preguntas que no tienen forma de filtro todavia —«solo las
     * claves cuyo titulo sale dos veces» y «solo las que tienen destinatario»—
     * y anadir esos dos campos al `IKeyFilter` para que dos numeros del pie
     * fueran pulsables es MUCHISIMO mas trabajo del que aportan: habria que
     * guardarlos, teacharlos en el `emptyFilter`, meterlos en `filterKeys`, en
     * la limpieza de la URL y en el menu que los muestra. Un boton que no
     * hace nada es peor que un numero, y aqui se sabe que no hace nada.
     *
     * Se enseñan igual porque el dato es bueno: que haya 47 claves repetidas
     * o 3 personas es justo lo que no se ve en ninguna parte de la pantalla.
     */
    if (resumen.duplicadas > 0) {
      anade(
        t(pluralKey(resumen.duplicadas, 'footer.repetidaOne', 'footer.repetidaMany'), [
          resumen.duplicadas,
        ]),
        null,
      );
    }

    if (resumen.destinatarios > 0) {
      anade(
        t(pluralKey(resumen.destinatarios, 'footer.paraUna', 'footer.paraVarias'), [
          resumen.destinatarios,
        ]),
        null,
      );
    }

    /*
     * Las plataformas que no son Steam, y solo esas.
     *
     * Steam sale ya en la cuenta de arriba, y repetir «370 Steam» al lado de
     * un filtro que ya es de Steam no aporta nada. Lo que si aporta es que
     * queden a la vista las que no lo son: una coleccion de claves de Steam
     * con 28 de Guild Wars 2 esconde media coleccion, y sin esto no hay forma
     * de saber que estan.
     */
    for (const plataforma of KEY_PLATFORM_VALUES) {
      const cuantas = resumen.porPlataforma[plataforma] ?? 0;

      if (cuantas === 0 || plataforma === KeyPlatform.Steam) continue;

      anade(`${cuantas} ${platformLabel(plataforma, TRANSLATIONS[locale])}`, {
        platforms: [plataforma],
      });
    }

    return trozos;
  }, [vista, resumen, filter, t, locale]);

  return (
    /*
     * Tres bloques en fila: **los recuentos a la izquierda**, la firma en el
     * centro, y el estado del almacenamiento y los atajos a la derecha.
     *
     * Los recuentos a la izquierda porque son **lo que cambia con el filtro**,
     * y a la izquierda es donde se mira cuando se acaba de cambiar algo. En el
     * centro competedian con la firma, que es lo unico que no cambia nunca y
     * que no se busca con el raton: dos cosas quietas no pueden compartir sitio
     * con una que cambia de largo cada vez que se toca un filtro.
     *
     * Y la rejilla de tres columnas es lo que mantiene el bloque quieto. Con
     * `justify-between` los dos extremos tendrian que medir igual para que el
     * centro no se moviera, y el recuento de la izquierda —que cambia de
     * longitud cada vez que se filtra— lo empujaria.
     */
    <footer className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-line bg-surface-1 px-4 py-2 text-[11px] text-t4">
      <span className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
        {vista === AppView.Games ? (
          <span className="truncate">
            {t('footer.games', [cuenta.juegos])}
            {cuenta.steamId ? ` · ${cuenta.steamId}` : ''}
          </span>
        ) : (
          <>
            {/*
              La forma la decide el TOTAL, no lo que se ve: con un filtro activo
              puede haber 1 clave visible de 200, y «1 clave» a secas diria que
              solo hay una. `footer.countMany` es «{0} de {1} claves»
              justamente para eso; el singular es solo el caso de una unica.
            */}
            <span className="shrink-0">
              {t(
                pluralKey(totalCount, 'footer.countOne', 'footer.countMany'),
                [visibleCount, totalCount],
              )}
            </span>

            {/*
              Los tramos, y **solo** los que dicen algo.

              Cada uno lleva su punto delante porque son trozos sueltos de una
              linea mas larga y sin el separador se leerian como una cifra mal
              puesta. Y van construidos en `tramos`, que ya ha dejado fuera lo
              que vale cero: «· 0 regaladas» ocupa sitio para decir que no hay
              ninguna, y con cuatro estados mas los DLC y las repetidas son
              justo el dato que se pierde de vista.
            */}
            {tramos.map((tramo, indice) => (
              <Fragment key={`${tramo.texto}-${indice}`}>
                {indice > 0 ? (
                  <span className="shrink-0 text-t5" aria-hidden="true">
                    ·
                  </span>
                ) : null}

                {tramo.pulsable ? (
                  /*
                    El tramo con filtro es un boton.
                    *
                    * Ponerlo y quitarlo, no anadir: si esta puesto y lo pulsas se
                    * va, y si no esta puesto lo pone. Lo que se manda al pulsarlo
                    * ya viene resuelto en `cambios` —poner o vaciar— porque son
                    * dos operaciones distintas y si se mandara siempre el
                    * filtro crudo el boton encendido no se podria apagar.
                    *
                    * El estado lo decide `coincide` y no una comparacion escrita
                    * aqui, para que el boton no pueda decir «estoy encendido»
                    * cuando el filtro que hay puesto es otro.
                    */
                  <button
                    type="button"
                    onClick={() => onFilter(tramo.cambios)}
                    title={t('footer.verTodo')}
                    aria-pressed={tramo.activo}
                    className={[
                      'shrink-0 rounded px-0.5 transition hover:bg-hover hover:text-t2',
                      tramo.activo ? 'font-semibold text-t2 underline decoration-dotted underline-offset-2' : '',
                    ].join(' ')}
                  >
                    {tramo.texto}
                  </button>
                ) : (
                  // Sin filtro no hay nada que pulsar: solo es informacion.
                  <span className="shrink-0">{tramo.texto}</span>
                )}
              </Fragment>
            ))}
          </>
        )}
      </span>

      <span className="flex min-w-0 items-center justify-center gap-2">
        {/*
          El aviso de derechos, con el icono delante del nombre en los dos
          enlaces.

          El icono primero porque es lo primero que se lee de un enlace a GitHub
          o a LinkedIn —el dibujo identifica la marca sin tener que leer— y el
          nombre detras porque es el que dice **quien** firma. Con el nombre
          primero y el icono detras se leia como un enlace mas de los que hay en
          la fila.

          Los dos iconos van dibujados y no con el generico de enlace exterior:
          en un pie lleno de cosas, una flecha no dice a donde lleva y hay que
          pasar el raton para enterarse.

          El ano se pide a `Date` al pintar y no esta escrito a mano: en una app
          que no se actualiza cada mes, un ano guardado se queda viejo y no hay
          quien lo arregle.
        */}
        <span className="shrink-0 whitespace-nowrap">
          © {new Date().getFullYear()}
        </span>

        <ExternalLink
          url={PROYECTO_URL}
          title={`${t('footer.code')}: ${FIRMA_CODIGO}`}
          className="min-w-0 truncate"
        >
          <Icon name="github" size={13} className="shrink-0" />
          {FIRMA_CODIGO}
        </ExternalLink>

        <span className="shrink-0 text-t5" aria-hidden="true">
          ·
        </span>

        <ExternalLink
          url={PERFIL_URL}
          title={`${t('footer.author')}: ${FIRMA_PERFIL}`}
          className="min-w-0 truncate"
        >
          <Icon name="linkedin" size={13} className="shrink-0" />
          {FIRMA_PERFIL}
        </ExternalLink>
      </span>

      <span className="flex min-w-0 items-center justify-end gap-3">
        {/*
          Deshacer vive en el pie y no solo como atajo: es la unica accion de
          las que no tienen boton en la barra de seleccion, y sin algo visible no
          se sabe que se puede deshacer. El `Ctrl+Z` del dialogo de atajos es la
          via rapida; esta, la que se ve.

          El texto va en imperativo —«Deshacer: …»— y no en pasado. Es un boton:
          si dijera «Deshecho» antes de pulsarlo, diria que ya se ha deshecho.
        */}
        {undo !== null ? (
          <button
            type="button"
            onClick={onUndo}
            title={t('shortcuts.undo')}
            className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-hover hover:text-t2"
          >
            <Icon name="undo" size={12} className="shrink-0" />
            <span className="max-w-40 truncate">{t('app.undoAvailable', [undo.label])}</span>
          </button>
        ) : null}

        <span
          title={t(STORAGE_MODE_NOTICE[modo])}
          className={[
            'flex shrink-0 items-center gap-1.5',
            modo === StorageMode.Memory ? 'text-warn' : 'text-t4',
          ].join(' ')}
        >
          <Icon name="package" size={12} className="shrink-0" />
          {t(STORAGE_MODE_LABEL[modo])}
        </span>

        <button
          type="button"
          onClick={onOpenShortcuts}
          title={t('shortcuts.thisDialog')}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-hover hover:text-t2"
        >
          <Icon name="help" size={12} />
          {t('toolbar.shortcuts')}
        </button>

        <span className="shrink-0 whitespace-nowrap">
          <kbd className="rounded border border-white/10 px-1 py-0.5">{SEARCH_SHORTCUT}</kbd>{' '}
          {t('footer.shortcutSearch')} ·{' '}
          <kbd className="rounded border border-white/10 px-1 py-0.5">N</kbd>{' '}
          {t('footer.shortcutNew')}
        </span>
      </span>
    </footer>
  );
}
