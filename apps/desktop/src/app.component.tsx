import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pluralKey, setCurrentLocale, translate } from '@/helpers/i18n.helper';
import { normalizeForMatch } from '@/helpers/match-title.helper';
import { normalizeKey } from '@/helpers/normalize-text.helper';
import { buildOwnershipIndex, ownershipCandidates } from '@/helpers/match-owned.helper';
import { LocaleContext, useT, type ITranslator } from './context/locale.context';

import { AppFooter } from './components/app-footer.component';
import { BulkStatusDialog } from './components/bulk-status-dialog.component';
import { ConfirmDialog, ToastStack, type IToast, type ToastTone } from './components/feedback.component';
import { GiftDialog } from './components/gift-dialog.component';
import { Icon } from './components/icon.component';
import { ImportPreview } from './components/import-preview.component';
import { KeyEditor } from './components/key-editor.component';
import { KeyRow } from './components/key-row.component';
import { LoadingIndicator } from './components/loading-indicator.component';
import { SelectionBar } from './components/selection-bar.component';
import { SettingsDialog, type SettingsTab } from './components/settings-dialog.component';
import { ShortcutsDialog } from './components/shortcuts-dialog.component';
import { StoragePanel } from './components/storage-panel.component';
import { SteamGamesTable } from './components/steam-games-table.component';
import { SteamNotConnected } from './components/view-switch.component';
import { TagsDialog } from './components/tags-dialog.component';
import { Toolbar } from './components/toolbar.component';
import { Button } from './components/ui.component';

import { AppTheme, AppView, DEFAULT_VIEW, KEY_STATUS_VALUES, KeyPlatform, KeyScope, KeySort, KeyStatus, PAGE_SIZE, mergeTags, removeTags, type AppLocale, type IAppSettings, type IGameKey, type IGameKeyDraft, type IImportSummary, type IKeyFilter, type ISteamOwnedGame, type SteamAccountStatus, type TranslationArgs, type Translator } from '@/contracts';
import { computeStats, emptyFilter, filterKeys, sortKeys } from '@/helpers/filter-keys.helper';
import { analyzeSelection, claveGrupo, groupByTitle, isGiftable, podarSeleccion, type SelectAction } from '@/helpers/selection.helper';
import { useKeepMounted } from '@/helpers/use-exit-animation.helper';
import { useShortcuts } from '@/helpers/use-shortcuts.helper';
import { useLoading, type TConTiempo } from '@/helpers/use-loading.helper';
import { useArranque } from '@/helpers/use-arranque.helper';
import { borradorDe, useUndo, type IUndoEntry } from '@/helpers/undo.helper';
import { gameKeyService, DuplicateKeyError } from '@/services/game-key.service';
import { settingsService, DEFAULT_SETTINGS } from '@/services/settings.service';
import { storageService } from '@/services/storage.service';
import { inspectStartup } from '@/services/startup.service';
import {
  legacyBackupsMigrated,
  migrateLegacyBackups,
} from '@/services/legacy-backups.service';
import { getDatabaseClient } from '@/repositories/repository.factory';
import { FirstRun } from '@/components/first-run.component';
import { steamService, SteamError, textoDeSteamError, resolveSteamId } from '@/services/steam.service';
import { bestCandidate, cuentaComoPropio } from '@/helpers/match-owned.helper';

/**
 * Ciclo de estados al pulsar sobre la pastilla de una fila.
 *
 * Es `KEY_STATUS_VALUES` y no una lista propia: estaba escrita aqui con los
 * mismos cinco valores, y al anadir un estado al enum el clic seguia dando la
 * vuelta por los antiguos.
 */
const STATUS_CYCLE = KEY_STATUS_VALUES;

/**
 * El nombre que se enseña de lo que se esta importando.
 *
 * Va en una constante y no a mano porque el servicio devuelve **solo el
 * contenido**: el nombre se inventa. El usuario elige `mis-claves.txt` y la
 * previsualizacion decia «steam-keys.txt», que es justo el bug que la
 * importacion en un solo paso pretendia arreglar —que se importara el fichero
 * que se habia visto—. Si el nombre es de mentira, el titulo tambien lo es.
 */
const IMPORT_FILE_NAME = 'steam-keys.txt';

/**
 * De donde saca el arranque lo que necesita.
 *
 * Van como constantes de modulo y no como `useMemo` porque no dependen de nada
 * del componente: son las funciones de los servicios, que no cambian nunca. Lo
 * que se les pasa al hook `useArranque` va por parametro para que el hook no
 * importe servicios —un hook en `helpers/` solo puede mirar `contracts`— y para
 * que la dependencia se vea en la llamada en vez de escondida en un import.
 */
const ARRANQUE = {
  inspeccionar: inspectStartup,
  migrarCopias: async (): Promise<void> => {
    const db = await getDatabaseClient();

    // El propio servicio marca «ya no hace falta hacerlo». Si ya esta marcado,
    // no se toca nada: es la senal de que esto ya corrio en un arranque
    // anterior y no hay que repetirlo.
    if (await legacyBackupsMigrated(db)) return;

    await migrateLegacyBackups(db);
  },
} as const;

/**
 * El filtro arranca con lo que se dejo la ultima vez.
 *
 * Sin esto, cada vez que se abre la app hay que volver a decidir si se quiere
 * ver todo o solo lo disponible, y casi siempre es lo mismo de ayer.
 */
function initialFilter(cargados: IAppSettings): IKeyFilter {
  const base = emptyFilter();

  return {
    ...base,
    // `lastScope` y `lastKind` ya vienen validados desde el servicio de ajustes:
    // si el valor guardado no existe, ahi se sustituye por el de defecto. Por eso
    // ya no hace falta castearlos ni comprobar nada mas aqui.
    scope: cargados.lastScope,
    kind: cargados.lastKind,
  };
}

export function App() {
  const [keys, setKeys] = useState<readonly IGameKey[]>([]);
  const [filter, setFilter] = useState<IKeyFilter>(emptyFilter);
  const [sort, setSort] = useState<KeySort>(KeySort.Alfabetico);
  const [editing, setEditing] = useState<IGameKey | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<IGameKey | null>(null);
  const [toasts, setToasts] = useState<readonly IToast[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);

  // ------------------------------------------------------- seleccion ---
  /**
   * Ids de las claves seleccionadas. Un `Set` porque la lista va camino de los
   * quinientas y recorrerlo entero en cada pulsacion se nota.
   */
  const [selection, setSelection] = useState<ReadonlySet<number>>(new Set());

  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [expireDialogOpen, setExpireDialogOpen] = useState(false);
  /** Dialogo para cambiar el estado de toda la seleccion a la vez. */
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  // ---------------------------------------------------------- ajustes ---
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Con que pestana se abren los ajustes. Cambia al pedirlo desde fuera. */
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('appearance');
  const [settings, setSettings] = useState<IAppSettings>(DEFAULT_SETTINGS);

  /**
   * `true` cuando los ajustes ya se han leido de la base de datos.
   *
   * Existe para una sola cosa: que el filtro **no se guarde hasta haber sido
   * leido**. Al montar, el estado vale `emptyFilter` (solo disponibles, que es
   * el valor por defecto), y si el efecto de guardado se disparase ahi
   * escribiria ese valor por encima del que si habia quedado de la sesion
   * anterior. El resultado era que el filtro no se recordaba nunca.
   */
  const [ajustesListos, setAjustesListos] = useState(false);

  /**
   * Si al arrancar hay base de datos o no.
   *
   * `null` mientras se comprueba, que es un estado distinto de los dos: no se
   * puede pintar el aviso de "no hay base de datos" antes de saber si la hay, o
   * un arranque lento enseño un aviso falso.
   *
   * Mientras vale `empty` **no se abre la base de datos**, y por tanto no se
   * llama a `migrate()` ni se escribe nada. Es lo que evita que aparezca un
   * `steam-keys.db` de cero bytes el simple hecho de arrancar el programa.
   */

  /**
   * Que tabla se ve: las claves o los juegos de Steam.
   *
   * No es un filtro sino otra coleccion, asi que no vive en `filter`. Se
   * guarda igualmente para que la app se abra donde se dejo.
   */
  const [vista, setVista] = useState<AppView>(DEFAULT_VIEW);

  /**
   * El idioma en pantalla, para que los componentes hijos traduzcan ya con el
   * idioma bueno desde el primer render y no un fotograma tarde.
   */
  const [idioma, cambiarIdioma] = useState<AppLocale>(DEFAULT_SETTINGS.locale);

  /**
   * Unico punto por el que cambia el idioma.
   *
   * Ademas de avisar a los componentes, deja el idioma fijado **globalmente**.
   * Lo necesitan los sitios que estan fuera del arbol de React y que aun asi
   * enseñan texto al usuario: sobre todo los titulos de las ventanas nativas de
   * ficheros. Si cada quien guardase el idioma por su cuenta habria tres
   * respuestas distintas a la pregunta de en que idioma estamos.
   */
  const setIdioma = useCallback((siguiente: AppLocale): void => {
    setCurrentLocale(siguiente);
    cambiarIdioma(siguiente);
  }, []);

  /**
   * Si al arrancar hay base de datos o no.
   *
   * `null` mientras se comprueba, que es un estado distinto de los dos: no se
   * puede pintar el aviso de «no hay base de datos» antes de saber si la hay, o
   * un arranque lento ensenaba un aviso falso.
   *
   * El orden —mirar el fichero, fijar el idioma, migrar las copias antiguas— lo
   * pone el hook, no las listas de dependencias.
   */
  const { arranque, setArranque } = useArranque(setIdioma, ARRANQUE);

  const t = useMemo<ITranslator>(
    () => ({
      locale: idioma,
      setLocale: setIdioma,
      // Se declara como propiedad y no como metodo abreviado porque el
      // interfaz `ITranslator` declara el traducir como una llamada, y asi el
      // tipo es exactamente el mismo que el que consumen los componentes.
      t: (clave: string, args?: TranslationArgs) => translate(idioma, clave, args),
    }),
    [idioma],
  );

  /**
   * Traducir desde aqui, sin `useT()`.
   *
   * Este componente es el que **provee** el contexto de idioma, asi que no
   * puede consumirlo: seria pedir un valor a si mismo. Como es quien tiene
   * `idioma` a mano, traduce directamente. Antes no traducia nada y por eso
   * toda la vista principal (avisos, pie de pagina, avisos de error) salia en
   * castellano con la app en cualquier otro idioma.
   */
  const traducir = useCallback<Translator>(
    (clave, args) => translate(idioma, clave, args),
    [idioma],
  );

  const [owned, setOwned] = useState<readonly ISteamOwnedGame[]>([]);

  /**
   * La ultima biblioteca se leyo a medias porque se topo con el limite de
   * paginas. Se guarda aparte y no dentro de la lista porque no es una
   * propiedad de los juegos: es una propiedad de **la lectura**, asi que se
   * pierde al abrir la app en lugar de quedarse pegada al ultimo estado.
   */
  const [bibliotecaIncompleta, setBibliotecaIncompleta] = useState(false);
  const [cuenta, setCuenta] = useState<SteamAccountStatus>({
    conectado: false,
    steamId: '',
    juegos: 0,
    sincronizadoAt: null,
    perfilPrivado: false,
  });

  const [stagedImport, setStagedImport] = useState<{
    fileName: string;
    contents: string;
    preview: IImportSummary;
  } | null>(null);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const nextToastId = useRef(1);

  // ---------------------------------------------------------- carga en curso ---
  /**
   * Lo que esta pasando ahora mismo, con forma de cancelarlo.
   *
   * `busy` (abajo) apaga botones; esto explica **que** esta pasando y deja
   * salir. Son cosas distintas: `busy` se limpia solo, y si algo se queda
   * esperando no hay forma de que la interfaz vuelva a ser usable.
   */
  const carga = useLoading();

  /**
   * Solo `empezar`, suelto.
   *
   * `useLoading()` devuelve un objeto **nuevo** cada vez que una tarea
   * arranca o termina, porque `tareas` es estado. Meter el objeto entero
   * en una lista de dependencias hacia que `conCarga` —y con ella todo lo
   * que la usa— cambiara de identidad cada vez que se encendia el
   * indicador, que es justo en el repintado que ya hay bastante.
   * `empezar` es un `useCallback` y no cambia nunca.
   */
  const empezar = carga.empezar;

  /**
   * Envoltorio de las acciones que pasan por la base de datos.
   *
   * Sustituye al `setBusy(true)` / `setBusy(false)` suelto. Hace tres cosas a
   * la vez que antes estaban repartidas y se olvidaban: apaga los botones,
   * enciende el indicador, y garantiza que el indicador se apague pase lo que
   * pase —incluido un error— porque va en el `finally`.
   *
   * `abortable` marca las que se pueden cortar de verdad. Cancelar una que no lo
   * es devuelve `{ ok: false }` sin haber escrito nada: la interfaz se
   * desbloquea, pero la operacion de debajo sigue, y quien llama decide si eso
   * merece un aviso.
   */
  const conCarga = useCallback(
    async <T,>(
      label: string,
      accion: (senal: AbortSignal) => Promise<T>,
      abortable = false,
    ): Promise<TConTiempo<T>> => {
      const tarea = empezar(traducir(label), abortable);

      setBusy(true);

      try {
        const valor = await accion(tarea.signal);

        return tarea.cancelado() ? { ok: false } : { ok: true, valor };
      } finally {
        tarea.fin();
        setBusy(false);
      }
    },
    [empezar, setBusy, traducir],
  );

  // ------------------------------------------------------ cierre animado ---
  // Los dialogos se desmontan en cuanto su condicion pasa a `false`, y ahi no
  // hay ni un fotograma en el que se vea la animacion de salida. Estos hooks
  // los mantienen montados el tiempo justo para que se vea desaparecer.
  const editorVivo = useKeepMounted(editorOpen);
  const storageVivo = useKeepMounted(storageOpen);
  const settingsVivo = useKeepMounted(settingsOpen);
  const giftVivo = useKeepMounted(giftDialogOpen);
  const expireVivo = useKeepMounted(expireDialogOpen);
  const bulkVivo = useKeepMounted(bulkStatusOpen);
  const tagsVivo = useKeepMounted(tagsOpen);
  const shortcutsVivo = useKeepMounted(shortcutsOpen);

  // ------------------------------------------------------------- avisos ---
  const notify = useCallback((message: string, tone: ToastTone = 'info'): void => {
    const id = nextToastId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: number): void => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  // --------------------------------------------------------- carga de datos ---

  const reload = useCallback(async (): Promise<void> => {
    try {
      setKeys(await gameKeyService.list());
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.loadFailed'),
        'error',
      );
    } finally {
      setLoading(false);
    }
    // `traducir` tambien: sin el, el error de carga se queda en el idioma
    // anterior si el usuario cambia de idioma con la lista ya cargada.
  }, [notify, traducir]);

  /**
   * Carga las claves **una vez**, cuando la base pasa a estar disponible.
   *
   * Va por ref y no por dependencia directa a proposito. `reload` depende de
   * `traducir`, que depende del idioma, asi que con `[reload, arranque]` cada
   * vez que se elegia otro idioma se releian cuatrocientas filas desde SQLite
   * sin `setLoading(true)` que lo justificara: con la base en un disco lento o
   * en red —el modo portable la deja al lado del ejecutable— se notaba.
   *
   * El ref mantiene la version **actual** de la funcion sin que su identidad
   * dispare nada. El error de carga si sale en el idioma bueno, que era lo que
   * se queria: lo unico que hace falta es que el mensaje se traduzca al
   * escribirse, no que la lista se recarge al cambiar de idioma.
   */
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    // Sin base de datos no se toca nada: ni claves, ni ajustes. Es lo que
    // mantiene el programa sin crear un fichero vacio al abrirlo.
    if (arranque?.database !== 'ready') return;

    void reloadRef.current();
  }, [arranque?.database]);

  // ---------------------------------------------------------------- deshacer ---
  /**
   * Devuelve las claves a como estaban antes de la ultima accion.
   *
   * Hay dos caminos porque hay dos cosas que recuperar. Un cambio de estado o de
   * etiquetas se deshace actualizando las filas que siguen existiendo; un
   * borrado se deshace creandolas de nuevo, porque la fila ya no esta y un
   * `update` sobre ella no escribiria nada —se quedaria todo en un «0 filas
   * afectadas» sin decir nada—.
   *
   * Se re-crean tal cual estaban, con su fecha de alta y su nota, y no «como
   * nuevas»: deshacer un borrado y encontrarse la clave ordenada al final de la
   * lista, con la fecha de hoy, no es la misma clave que se borro.
   */
  const deshacerEntrada = useCallback(
    async (entrada: IUndoEntry): Promise<void> => {
      const tarea = empezar(traducir('loading.saving'));
      setBusy(true);

      try {
        /** Cuantas filas se han tocado de verdad, en cualquiera de las dos vias. */
        let aplicadas = 0;

        if (entrada.borradas) {
          for (const foto of entrada.antes) {
            await gameKeyService.create({
              title: foto.title,
              keyValue: foto.keyValue,
              platform: foto.platform,
              status: foto.status,
              /**
               * `source` y `lastUsedAt` tambien se pasan. Sin ellos el alta
               * los ponia a `Manual` y `null` fijos, y deshacer un borrado
               * convertia una clave importada del TXT en manual y le
               * borraba la marca de cuando se canjeo —justo lo que el
               * comentario de `IUndoSnapshot` dice que por eso se guardan.
               */
              source: foto.source,
              giftedTo: foto.giftedTo,
              parentTitle: foto.parentTitle,
              note: foto.note,
              tags: foto.tags,
              addedOn: foto.addedOn,
              lastUsedAt: foto.lastUsedAt,
            });

            aplicadas += 1;
          }
        } else {
          // El `id` no viene en la foto, asi que se empareja por el valor de la
          // clave: es lo unico que la base garantiza unico y no cambia al
          // deshacer, porque lo que se restauraron son justo esos campos.
          //
          // Se empareja por la forma **normalizada**, que es la que usa el
          // indice unico: con el valor tal cual, una fila cuya forma
          // guardada no coincidia con la de la foto no encontraba su `id`,
          // hacia `continue` sin decir nada y aun asi salia el «Deshecho».
          const actuales = await gameKeyService.list();
          const porClave = new Map(
            actuales.map((clave) => [normalizeKey(clave.keyValue), clave.id]),
          );

          for (const foto of entrada.antes) {
            const id = porClave.get(normalizeKey(foto.keyValue));

            if (id === undefined) continue;

            await gameKeyService.update(id, borradorDe(foto));
            aplicadas += 1;
          }
        }

        await reload();

        /**
         * Solo se dice «Deshecho» si de verdad se ha deshecho algo.
         *
         * Una fila puede no aparecer si mientras tanto se borro, se importo
         * una clave igual o el cambio venia de otro sitio. Antes el aviso
         * salia igual, y el usuario leia que se habia deshecho cuando no se
         * habia deshecho nada: peor que un fallo, porque un fallo se ve.
         */
        if (aplicadas === 0) {
          notify(traducir('app.undoNothingHappened'), 'error');
          return;
        }

        notify(traducir('app.undoDone', [entrada.label]), 'success');
      } catch (cause) {
        notify(
          cause instanceof Error ? cause.message : traducir('app.saveFailed'),
          'error',
        );
      } finally {
        tarea.fin();
        setBusy(false);
      }
    },
    [empezar, notify, reload, setBusy, traducir],
  );

  const deshacer = useUndo(deshacerEntrada);

  const deshacerUltima = useCallback(async (): Promise<void> => {
    const habia = await deshacer.deshacer();

    if (!habia) notify(traducir('app.nothingToUndo'), 'info');
  }, [deshacer, notify, traducir]);

  /**
   * Carga los ajustes, una vez, cuando la base pasa a estar disponible.
   *
   * Solo ajustes. La sincronizacion de Steam vive en el efecto siguiente, y no
   * por estetica: si estuviera aqui, el efecto necesitaria `conCarga` —para que
   * el indicador dijera algo— y `conCarga` depende de `traducir`, que depende
   * del idioma. El efecto se volveria a disparar en cada cambio de idioma,
   * releeria los ajustes, pondria el idioma guardado, y esepondria otra vez a
   * disparar el efecto. Un bucle disfrazado de recarga.
   *
   * Separados, cada uno depende solo de lo que de verdad lo dispara.
   */
  useEffect(() => {
    if (arranque?.database !== 'ready') return;

    const cargar = async (): Promise<void> => {
      try {
        const cargados = await settingsService.load();
        setSettings(cargados);
        setIdioma(cargados.locale);
        applyTheme(cargados.theme);
        setFilter(initialFilter(cargados));
        setVista(cargados.lastView);
      } catch {
        // Sin ajustes: la app sigue con las claves, que es lo que importa.
      } finally {
        // Se marca aqui y no dentro del `try`: aunque la carga falle, a partir
        // de este punto ya se puede guardar. Dejarlo en el `try` haria que una
        // base de datos que falla al leer nunca llegara a recordar el filtro,
        // que es justo cuando mas lo necesita uno.
        setAjustesListos(true);
      }
    };

    void cargar();
  }, [arranque?.database, setIdioma]);

  /**
   * Trae la biblioteca de Steam si ya hay una cuenta conectada.
   *
   * Depende de las **credenciales**, no de los ajustes enteros: si no, una
   * escritura cualquiera —cambiar el ambito del filtro, por ejemplo— releeria
   * veinte paginas de la biblioteca sin que nadie lo haya pedido.
   */
  const conCargaRef = useRef(conCarga);
  conCargaRef.current = conCarga;

  /**
   * Lo mismo con la marca de la ultima sincronizacion: leerla del objeto
   * `settings` dentro del efecto la haria depender de el entero, y entonces
   * cualquier ajuste guardado —el tema, un filtro— releeria la biblioteca.
   */
  const steamSyncedAtRef = useRef(settings.steamSyncedAt);
  steamSyncedAtRef.current = settings.steamSyncedAt;

  useEffect(() => {
    const apiKey = settings.steamApiKey;
    const steamId = settings.steamId;

    if (arranque?.database !== 'ready' || !apiKey || !steamId) return;

    const sincronizar = async (): Promise<void> => {
      try {
        const r = await conCargaRef.current(
          'loading.syncing',
          async (senal) => steamService.getOwnedGames(apiKey, steamId, senal),
          true,
        );

        if (!r.ok) return;

        const { juegos, truncada } = r.valor;

        setOwned(juegos);
        setCuenta({
          conectado: true,
          steamId,
          juegos: juegos.length,
          sincronizadoAt: steamSyncedAtRef.current,
          perfilPrivado: false,
        });

        /**
         * Si se topo con el limite de paginas, la biblioteca esta a medias.
         *
         * En el arranque no se avisa con un toast: apareceria solo, sin que
         * nadie lo hubiera pedido, y se leeria como un fallo de algo que el
         * usuario acaba de abrir. Lo que se hace es decirlo en la barra de
         * estado, que es donde ya vive el numero de juegos, para que se vea
         * al mirarla y no la pueda pasar por alto.
         */
        setBibliotecaIncompleta(truncada);
      } catch {
        /**
         * Un fallo al sincronizar no rompe el arranque.
         *
         * Antes este `catch` era el de fuera —el que traga tambien el fallo de
         * leer los ajustes— y no decia nada: una clave caducada o Steam caido
         * dejaban la pestana de juegos vacia, sin aviso y sin reintento. Al
         * menos se marca la cuenta como conectada pero sin juegos, para que se
         * vea que el fallo es de la sincronizacion y no del arranque, y quien
         * pulse «Actualizar» lo reintenta.
         */
        setOwned([]);
        setBibliotecaIncompleta(false);
        setCuenta((actual) => ({ ...actual, conectado: true, juegos: 0 }));
      }
    };

    void sincronizar();
    // `conCarga` va por ref y no en la lista: depende de `traducir`, que
    // depende del idioma, y entonces cambiar de idioma releeria veinte
    // paginas de la biblioteca de Steam sin que nadie lo haya pedido.
  }, [arranque?.database, settings.steamApiKey, settings.steamId]);


  // --------------------------------------------------------------- filtros ---
  const patchFilter = useCallback((changes: Partial<IKeyFilter>): void => {
    setFilter((current) => ({ ...current, ...changes }));
  }, []);

  /**
   * Guarda el ambito, el tipo y la vista.
   *
   * Va en un efecto aparte y no dentro de `patchFilter` a proposito: si se
   * guardara ahi, cada pulsacion esperaria a la base de datos antes de repintar
   * la lista, que con cuatrocientas filas se nota. Aqui se guarda por detras y
   * la lista se actualiza al instante.
   *
   * La comprobacion de `ajustesListos` no es opcional: sin ella, el primer
   * volcado escribe los valores por defecto encima de los guardados.
   */
  useEffect(() => {
    if (!ajustesListos) return;

    void settingsService.setMany({
      lastScope: filter.scope,
      lastKind: filter.kind,
      lastView: vista,
    });
  }, [ajustesListos, filter.scope, filter.kind, vista]);

  const visible = useMemo(
    () => sortKeys(filterKeys(keys, filter), sort),
    [keys, filter, sort],
  );

  const stats = useMemo(() => computeStats(keys, visible.length), [keys, visible.length]);
  const page = useMemo(() => visible.slice(0, PAGE_SIZE), [visible]);

  /**
   * Deselecciona lo que el filtro deja fuera.
   *
   * Va en un efecto y no dentro de `patchFilter` porque en este punto ya se
   * conoce la lista **resultante**, que es la unica que importa: la poda
   * necesita saber que claves se ven de verdad, no cual sera el filtro nuevo.
   *
   * Solo mira `visible`, y por tanto solo cuando cambian las claves o el filtro,
   * no cuando se reordena la lista. Es lo que se quiere: cambiar el orden no
   * invalida nada, cambiar el filtro si.
   */
  useEffect(() => {
    setSelection((actual) => podarSeleccion(actual, visible));
  }, [visible]);

  /** Cuantas claves comparten cada titulo, para el contador de la fila. */
  const groups = useMemo(() => groupByTitle(keys), [keys]);

  /**
   * Las claves cuyo juego ya esta en la cuenta de Steam.
   *
   * Se calcula una sola vez y en bloque, y no por fila: el badge lo consulta
   * cuatrocientas veces en cada render, y cada consulta era una comparacion.
   *
   * Antes era solo igualdad de nombre normalizado, y eso falla en cuanto Steam
   * escribe el titulo de otra manera que el TXT de origen: «World War 3: Black
   * Gold» contra «World War III Black Gold», «Broken Sword 1: … - Director's
   * Cut» contra «Broken Sword: …». Son la misma clave sin coincidencia, y el
   * badge no aparecia justo en las que mas duele.
   *
   * El indice por palabra inicial evita comparar cada titulo contra toda la
   * biblioteca, y el umbral de `bestCandidate` evita lo contrario: que un
   * «Portal» se tome por el «Portal 2» que tienes.
   */
  const propios = useMemo(() => {
    if (owned.length === 0) return new Set<string>();

    const indice = buildOwnershipIndex(owned);
    const exactos = new Set(owned.map((juego) => normalizeForMatch(juego.name)));
    const encontrados = new Set<string>();

    for (const clave of keys) {
      // Solo las claves de Steam: una de Battle.net no la tiene una cuenta de
      // Steam ni por error.
      if (clave.platform !== KeyPlatform.Steam) continue;

      const normalizado = normalizeForMatch(clave.title);

      if (exactos.has(normalizado)) {
        encontrados.add(normalizado);
        continue;
      }

      const candidatos = ownershipCandidates(clave.title, indice);

      if (candidatos.length === 0) continue;

      const { confianza } = bestCandidate(clave.title, candidatos);

      if (cuentaComoPropio(confianza)) encontrados.add(normalizado);
    }

    return encontrados;
  }, [keys, owned]);

  const esPropio = useCallback(
    (title: string): boolean => propios.has(normalizeForMatch(title)),
    [propios],
  );

  // ----------------------------------------------------------- seleccion ---
  const selectedKeys = useMemo(
    () => keys.filter((key) => selection.has(key.id)),
    [keys, selection],
  );

  /**
   * Las seleccionadas que se pueden regalar.
   *
   * Se calculan solas, sin interruptor: si la vista esta en «Solo
   * disponibles» (que es lo unico que hay que decidir, y se decide en la barra
   * de filtros) lo que se ve ya son todas regalables, y la seleccion de esa
   * lista no puede contener ninguna que no lo sea. Con el filtro en «Todos» la
   * seleccion si puede mezclar estados, y entonces se descartan las que no.
   */
  const actionableKeys = useMemo(
    () => (filter.scope === KeyScope.Available ? selectedKeys : selectedKeys.filter(isAvailable)),
    [selectedKeys, filter.scope],
  );

  const facts = useMemo(
    () => analyzeSelection(selectedKeys, filter.scope === KeyScope.All),
    [selectedKeys, filter.scope],
  );

  const selectionIds = useMemo(
    () => selectedKeys.map((key) => key.id),
    [selectedKeys],
  );

  const toggleSelect = useCallback((entry: IGameKey): void => {
    setSelection((anterior) => {
      const siguiente = new Set(anterior);

      if (siguiente.has(entry.id)) siguiente.delete(entry.id);
      else siguiente.add(entry.id);

      return siguiente;
    });
  }, []);

  const clearSelection = useCallback((): void => {
    setSelection(new Set());
  }, []);

  const selectAll = useCallback((): void => {
    setSelection(new Set(visible.map((key) => key.id)));
  }, [visible]);

  /**
 * El texto que explica por que un boton esta apagado.
 *
 * El helper devuelve la **clave** del diccionario y sus argumentos, no el
 * texto: es una funcion pura y no sabe en que idioma esta la app. Aqui se
 * traduce.
 */
  const motivo = useCallback(
    (action: SelectAction): string | undefined => {
      if (selectedKeys.length === 0) return traducir('app.nothingSelected');

      const bloqueo = facts.blocked.find((item) => item.action === action);

      return bloqueo === undefined
        ? undefined
        : traducir(bloqueo.messageKey, bloqueo.messageArgs);
    },
    [facts.blocked, selectedKeys.length, traducir],
  );

  // ------------------------------------------------------------- atajos ---
  /**
   * Atajos de teclado.
   *
   * Se van al hook porque no dependen de nada del componente: miran que
   * dialogos hay abiertos y llaman a lo que se les pasa. Aqui eran cien lineas
   * de `useEffect` en medio del arranque y las acciones, y lo unico que había
   * que mantener al día era una lista de dependencias que se lenia sola.
   */
  useShortcuts({
    dialogs: {
      giftDialog: giftDialogOpen,
      bulkStatusDialog: bulkStatusOpen,
      expireDialog: expireDialogOpen,
      tagsDialog: tagsOpen,
      settingsDialog: settingsOpen,
      storageDialog: storageOpen,
      editorDialog: editorOpen,
      shortcutsDialog: shortcutsOpen,
      deleteDialog: deleting !== null,
      importDialog: stagedImport !== null,
    },
    onClose: {
      gift: () => setGiftDialogOpen(false),
      bulkStatus: () => setBulkStatusOpen(false),
      expire: () => setExpireDialogOpen(false),
      tags: () => setTagsOpen(false),
      settings: () => setSettingsOpen(false),
      storage: () => setStorageOpen(false),
      // Cerrar el editor suelta tambien la clave que se estaba editando: si no,
      // al reabrirlo con «n» se volveria a editar la anterior en vez de crear
      // una nueva.
      editor: () => {
        setEditorOpen(false);
        setEditing(null);
      },
      shortcuts: () => setShortcutsOpen(false),
      deleteDialog: () => setDeleting(null),
      importDialog: () => setStagedImport(null),
    },
    haySeleccion: selection.size > 0,
    onClearSelection: clearSelection,
    onSelectAll: selectAll,
    onOpenShortcuts: () => setShortcutsOpen(true),
    onOpenNewKey: () => {
      setEditing(null);
      setEditorOpen(true);
    },
    onUndo: () => void deshacerUltima(),
    searchRef,
  });

  // ------------------------------------------------------------ acciones ---
  const handleCreate = (): void => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleEdit = (entry: IGameKey): void => {
    setEditing(entry);
    setEditorOpen(true);
  };

  const handleSave = async (draft: IGameKeyDraft): Promise<void> => {
    // Una clave repetida salta aqui, no en la base. El editor la enseña como
    // error normal, sin cerrar, y el dialogo se queda abierto con lo escrito.
    try {
      /**
       * El aviso sale **despues**, no dentro de la accion.
       *
       * Estando dentro ya habia salido cuando el usuario pulsa la X del
       * indicador: se cerraba el editor con un «Clave anadida» en pantalla y la
       * escritura de debajo —que una escritura en la base no se puede parar—
       * siguiendo su curso. Ahora el editor se cierra solo si la operacion no
       * se ha cancelado, y el aviso va con ella.
       */
      const r = await conCarga('loading.saving', async () => {
        if (editing) {
          await gameKeyService.update(editing.id, draft);
          return { creada: null as IGameKey | null };
        }

        return {
          creada: await gameKeyService.create({
            title: draft.title,
            keyValue: draft.keyValue,
            platform: draft.platform,
            status: draft.status,
            giftedTo: draft.giftedTo,
            parentTitle: draft.parentTitle,
            note: draft.note,
            tags: draft.tags,
            addedOn: draft.addedOn,
          }),
        };
      });

      if (!r.ok) return;

      const creada = r.valor.creada;

      /**
       * Guardar tambien se deshace.
       *
       * Editar devuelve la clave a como estaba, con la foto de `editing` que es
       * el estado anterior. Crear se deshace borrando, y para eso hace falta la
       * clave **tal como ha quedado**: si el usuario le pone destinatario o
       * etiquetas antes de guardar, esa es la fila que hay que volver a quitar.
       */
      if (creada === null) {
        if (editing !== null) deshacer.registrar(editing.title, [editing]);
      } else {
        // `true` = se deshace borrando, porque la fila es nueva y no hay a que
        // devolverla a ningun sitio: solo hay que quitar lo que se creo.
        deshacer.registrar(creada.title, [creada], true);
      }

      notify(traducir(editing === null ? 'app.created' : 'app.saved'), 'success');

      setEditorOpen(false);
      setEditing(null);
      await reload();
    } catch (cause) {
      if (cause instanceof DuplicateKeyError) {
        // Aqui se traduce: el servicio no sabe en que idioma esta la app, y el
        // editor enseña el mensaje tal cual le llega.
        throw new Error(traducir('app.duplicateKey', [cause.juegoExistente]));
      }

      throw cause;
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) return;

    // La foto sale del objeto en memoria, no de la base, asi que se
    // puede apuntar **despues** de borrar. Apuntarlo antes era peor de lo
    // que parecia: si el `remove` fallaba la pila guardaba un borrado que
    // no habia ocurrido, y el primer Ctrl+Z devolvia una clave que nunca
    // se fue. Con la X de "¿Seguro?" al lado, un fallo de disco era
    // raro pero no imposible.
    try {
      const r = await conCarga('loading.deleting', async () => {
        await gameKeyService.remove(deleting.id);
      });

      // Cancelado: la operacion de debajo puede haber seguido, asi que
      // no se apunta nada que el usuario ya ha decidido deshacer.
      if (!r.ok) return;

      deshacer.registrar(deleting.title, [deleting], true);

      setDeleting(null);
      notify(traducir('app.deleted') + ' ' + traducir('app.undoHint'), 'success');
      await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.deleteFailed'),
        'error',
      );
    }
  };

  /**
   * Aplica un estado a varias claves de golpe.
   *
   * Se reciben los ids ya filtrados por el dialogo (que es quien decide que
   * transiciones tienen sentido), asi que aqui solo se escribe. Aun asi se
   * vuelve a comprobar el estado de cada una antes de escribir: entre que el
   * dialogo calcula el reparto y se pulsa el boton, la lista puede haber
   * cambiado, y escribir a ciegas dejaria claves en un estado que ya no
   * corresponde.
   */
  const handleApplyBulkStatus = async (
    ids: readonly number[],
    status: KeyStatus,
  ): Promise<number> => {
    /*
     * Los ids que llegan ya estan filtrados por el dialogo, que es quien sabe
     * que transiciones tienen sentido. Aun asi se vuelve a comprobar el estado
     * de cada una contra la lista **actual**, no contra la del render en el
     * que se creo el dialogo: entre abrirlo y pulsarlo la lista puede haber
     * cambiado, y escribir a ciegas dejaria claves en un estado que ya no
     * corresponde.
     */
    const porId = new Map(keys.map((key) => [key.id, key]));

    const aplicables = ids.filter((id) => {
      const entry = porId.get(id);

      if (!entry || entry.status === status) return false;

      // Cambiar a "regalada" exige decir a quien; sin destino no se escribe,
      // porque quedaria una clave regalada sin destinatario, que no significa
      // nada. El dialogo ya avisa de esto antes de aplicar.
      if (status === KeyStatus.Gifted && !entry.giftedTo?.trim()) return false;

      return true;
    });

    if (aplicables.length === 0) return 0;

    const afectadas = aplicables
      .map((id) => porId.get(id))
      .filter((clave): clave is IGameKey => clave !== undefined);

    try {
      // Una sola operacion en vez de una por clave: con cuatrocientas
      // filas marcadas son cuatrocientas escrituras, y cada una es una
      // ida y vuelta a la base de datos. Ademas, escribir de una en una
      // deja la coleccion a medias si algo falla a mitad.
      const r = await conCarga('loading.status', async () => {
        await gameKeyService.setStatusMany(aplicables, status);
      });

      if (!r.ok) return 0;

      // La foto sale de la lista en memoria, que ya estaba copiada antes
      // de escribir. Apuntar **despues** evita que un fallo deje en la
      // pila un cambio que no llego a ocurrir, que al primer Ctrl+Z
      // devolveria estados inventados.
      deshacer.registrar(
        traducir(pluralKey(afectadas.length, 'bulk.doneOne', 'bulk.doneMany'), [
          afectadas.length,
        ]),
        afectadas,
      );

      await reload();

      // El aviso va **ademas** del mensaje del dialogo, no en vez de el:
      // el dialogo se puede cerrar sin leer y el cambio ya esta hecho.
      notify(
        traducir(pluralKey(afectadas.length, 'bulk.doneOne', 'bulk.doneMany'), [
          afectadas.length,
        ]),
        'success',
      );

      return afectadas.length;
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.markFailed'),
        'error',
      );

      return 0;
    }
  };

  const handleCycleStatus = async (entry: IGameKey): Promise<void> => {
    const index = STATUS_CYCLE.indexOf(entry.status);
    const next = STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length] ?? KeyStatus.Available;

    // Un clic en la pastilla es el cambio mas frecuente de todos, y tan facil de
    // Pulsar por error como de hacer bien. Quedaba fuera del deshacer por no
    // tocar mas de una clave a la vez, y era justo el hueco que mas dolia.
    try {
      const r = await conCarga('loading.status', async () => {
        await gameKeyService.setStatus(entry.id, next);
      });

      // El estado anterior viaja en `entry`, que es una foto del render
      // anterior: se puede apuntar sin volver a leer la base, y solo si
      // la escritura ha funcionado de verdad.
      if (!r.ok) return;

      deshacer.registrar(entry.title, [entry]);

      await reload();
    } catch (cause) {
      // Sin esto, un fallo soltava un rechazo sin capturar desde un
      // manejador de evento — donde no hay nadie que lo recoja — y la
      // fila se quedaba mostrando el estado viejo sin explicar por que.
      notify(
        cause instanceof Error ? cause.message : traducir('app.markFailed'),
        'error',
      );
    }
  };

  /**
   * Guarda el TXT con las claves seleccionadas.
   *
   * El dialogo de guardado se abre **antes** de tocar los estados: si el
   * usuario cancela, las claves siguen disponibles y no se ha regalado nada.
   */
  const handleExportGift = async (): Promise<void> => {
    if (actionableKeys.length === 0) return;

    try {
      const r = await conCarga('loading.exporting', () =>
        gameKeyService.exportGiftSelection(actionableKeys),
      );

      // Cancelado: el dialogo de guardado se cerro o se pulso la X, y no ha
      // pasado nada que avisar.
      if (!r.ok) return;

      const resultado = r.valor;

      if (resultado === null) {
        notify(traducir('app.noFile'), 'info');
        return;
      }

      notify(
        traducir(
          pluralKey(resultado.total, 'app.exportOne', 'app.exportMany'),
          [resultado.total, resultado.path],
        ),
        'success',
      );
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.fileFailed'),
        'error',
      );
    }
  };

  const handleConfirmGift = async (destinatario: string): Promise<void> => {
    const limpio = destinatario.trim();

    // El boton ya esta apagado si va vacio; esto es la segunda red, por si
    // alguien llega aqui por el teclado o por una llamada directa.
    if (limpio.length === 0) {
      notify(traducir('app.needRecipient'), 'error');
      return;
    }

    if (actionableKeys.length === 0) return;

    const total = actionableKeys.length;

    try {
      const r = await conCarga('loading.gifting', async () => {
        await gameKeyService.giftMany(
          actionableKeys.map((key) => ({ id: key.id, giftedTo: limpio })),
        );
      });

      // Cancelado: lo de debajo puede haber seguido, asi que no se apunta nada
      // que el usuario ya ha decidido deshacer.
      if (!r.ok) return;

      // El destinatario va en el aviso, asi que el deshacer tambien lo nombra:
      // sin el, el aviso que sale tras deshacer no dice a quien se habia
      // regalado. Y va **despues** de escribir: si el `giftMany` falla, una
      // entrada en la pila devolveria las claves a regaladas cuando no se
      // regalaron.
      deshacer.registrar(
        traducir(pluralKey(total, 'app.giftedOne', 'app.giftedMany'), [total, limpio]),
        actionableKeys,
      );

      setSelection(new Set());
      setGiftDialogOpen(false);

      notify(
        traducir(pluralKey(total, 'app.giftedOne', 'app.giftedMany'), [total, limpio]),
        'success',
      );
      await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.markFailed'),
        'error',
      );
    }
  };

  const handleConfirmExpire = async (): Promise<void> => {
    if (!facts.canExpire) return;

    const affected = selectedKeys.filter((key) => key.status !== KeyStatus.Expired);

    if (affected.length === 0) return;

    const total = affected.length;

    try {
      const r = await conCarga('loading.expiring', async () => {
        await gameKeyService.setStatusMany(
          affected.map((key) => key.id),
          KeyStatus.Expired,
        );
      });

      if (!r.ok) return;

      // `affected` es una foto de la lista en memoria, de antes de escribir, asi
      // que se puede apuntar el deshacer sin releer la base — y solo cuando la
      // escritura ha funcionado.
      deshacer.registrar(
        traducir(pluralKey(total, 'app.expiredOne', 'app.expiredMany'), [total]),
        affected,
      );

      setSelection(new Set());
      setExpireDialogOpen(false);

      notify(
        traducir(pluralKey(total, 'app.expiredOne', 'app.expiredMany'), [total]),
        'success',
      );
      await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.markFailed'),
        'error',
      );
    }
  };

  /**
   * Aplica las etiquetas elegidas a la seleccion.
   *
   * Las etiquetas se **fusionan**, no se reemplazan: quien pulsa "etiquetas"
   * quiere añadir las que faltan, no borrar las que ya tenia la clave. El
   * boton de caducadas es el que cambia el estado.
   */
  const handleApplyTags = async (tags: readonly string[]): Promise<void> => {
    if (selectionIds.length === 0) return;

    const total = selectionIds.length;

    try {
      const r = await conCarga('loading.tags', async () => {
        for (const key of selectedKeys) {
          const juntadas = mergeTags(key.tags, tags);
          const sinLasNuevas = removeTags(juntadas, tags);
          const final = [...sinLasNuevas, ...tags.filter((tag) => !sinLasNuevas.includes(tag))];

          await gameKeyService.setTagsMany([key.id], final);
        }
      });

      if (!r.ok) return;

      // Aqui el caso era mas grave que en las otras acciones: las etiquetas se
      // escriben **una a una**, asi que un fallo a mitad deja la coleccion con
      // unas claves cambiadas y otras no. Apuntar el deshacer despues evita
      // prometer un estado que no llego a existir.
      deshacer.registrar(
        traducir(pluralKey(total, 'app.tagsOne', 'app.tagsMany'), [total]),
        selectedKeys,
      );

      setSelection(new Set());
      setTagsOpen(false);

      notify(
        traducir(pluralKey(total, 'app.tagsOne', 'app.tagsMany'), [total]),
        'success',
      );
      await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.tagsFailed'),
        'error',
      );
    }
  };

  // ----------------------------------------------------------- ajustes ---
  const handleSaveSettings = async (
    patch: Partial<IAppSettings>,
  ): Promise<string | null> => {
    try {
      await settingsService.setMany(patch);
      const cargados = await settingsService.load();
      setSettings(cargados);

      // El idioma se propaga al arbol entero para que los componentes traduzcan
      // ya, sin esperar al siguiente render del dialogo de ajustes.
      if (cargados.locale !== idioma) setIdioma(cargados.locale);

      applyTheme(cargados.theme);

      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : traducir('app.saveFailed');
    }
  };

  const handleLinkSteam = async (
    apiKey: string,
    steamId: string,
  ): Promise<string | null> => {
    if (apiKey.trim().length === 0) {
      return traducir('app.needApiKey');
    }

    try {
      /**
       * Por el indicador de carga y no con `setBusy` a mano.
       *
       * Era lo unico de la app que **no** pasaba por `conCarga`, y se
       * notaba: el boton se apagaba sin que el indicador dijera nada, de
       * modo que si Steam no contestaba la pantalla se quedaba muda con
       * los controles muertos y sin forma de salir. Ademas es la unica
       * llamada que se puede cortar de verdad, asi que sale con la X.
       */
      const r = await conCarga(
        'loading.syncing',
        async (senal) => {
          // Se resuelve lo que haya puesto: un numero de 17 cifras pasa
          // tal cual y un nombre de perfil se traduce contra el XML
          // publico de Steam, que no necesita clave.
          const id = await resolveSteamId(steamId, senal);

          const { juegos, truncada } = await steamService.getOwnedGames(
            apiKey.trim(),
            id,
            senal,
          );

          return { id, juegos, truncada };
        },
        true,
      );

      // Cancelado: no se guarda una clave a medio enlazar.
      if (!r.ok) return traducir('app.linkCancelled');

      const { id, juegos, truncada } = r.valor;
      const ahora = new Date().toISOString();

      await settingsService.setMany({
        steamApiKey: apiKey.trim(),
        steamId: id,
        steamLinked: true,
        steamSyncedAt: ahora,
      });

      setOwned(juegos);
      setSettings(await settingsService.load());
      setCuenta({
        conectado: true,
        steamId: id,
        juegos: juegos.length,
        sincronizadoAt: ahora,
        perfilPrivado: false,
      });
      setBibliotecaIncompleta(truncada);

      notify(
        truncada
          ? traducir('app.libraryPartial', [
              pluralKey(juegos.length, 'app.libraryOne', 'app.libraryMany'),
              juegos.length,
            ])
          : traducir(
              pluralKey(juegos.length, 'app.libraryOne', 'app.libraryMany'),
              [juegos.length],
            ),
        truncada ? 'info' : 'success',
      );

      return null;
    } catch (cause) {
      if (cause instanceof SteamError) {
        /**
         * Cancelar no es un fallo.
         *
         * Cuando el usuario pulsa la X, la accion **lanza** en vez de
         * devolver: por eso el `catch` de arriba no se encarga y hay que
         * distinguirlo aqui. Sin esta linea el dialogo pintaba «Sincronizacion
         * cancelada» en rojo, que es avisar de un error que el propio usuario
         * acaba de pedir.
         *
         * Y de paso no se pisa `perfilPrivado` con un `false`: si la cuenta
         * estaba marcada como privada por un intento anterior, un 429 la
         * borraba sin que nada lo dijera.
         */
        if (cause.codigo === 'cancelado') return null;

        setCuenta((actual) => ({ ...actual, perfilPrivado: cause.codigo === 'perfilPrivado' }));

        // El error lleva la **clave** de su traduccion, no el texto: quien lo
        // enseña es el componente, que es lo unico que sabe el idioma.
        return textoDeSteamError(cause, traducir);
      }

      return traducir('app.linkFailed');
    }
  };

  const handleForgetApiKey = async (): Promise<void> => {
    /**
     * Con `try/catch`, como todos los demas.
     *
     * El dialogo de ajustes llama a esto desde un `onClick` con un
     * `try/finally` **sin** `catch`: si `forgetApiKey()` fallaba —base
     * bloqueada, permisos— el rechazo no lo recogia nadie, saltaba a la
     * consola y el boton se rehabilitaba sin decir nada. El usuario pulsaba
     * «Olvidar clave», no pasaba nada visible y el campo seguia enseñando la
     * clave como si la cuenta siguiera conectada.
     */
    try {
      await settingsService.forgetApiKey();
      setSettings(await settingsService.load());
      setOwned([]);
      setBibliotecaIncompleta(false);
      setCuenta({
        conectado: false,
        steamId: '',
        juegos: 0,
        sincronizadoAt: null,
        perfilPrivado: false,
      });
      notify(traducir('app.keyForgotten'), 'info');
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.saveFailed'),
        'error',
      );
    }
  };

  // --------------------------------------------------------- importacion ---
  /**
   * Paso 1 de la importacion: leer el fichero y previsualizarlo.
   *
   * El dialogo nativo se abre **una sola vez** aqui. Antes se abria dos veces
   * (una para previsualizar y otra para confirmar), de modo que el usuario
   * podia acabar importando un fichero distinto del que habia visto.
   */
  const handleImport = async (): Promise<void> => {
    try {
      /**
       * La previsualizacion se abre **fuera** de la accion.
       *
       * Estando dentro, pulsar la X solo conseguia que `conCarga` devolviera
       * `{ ok: false }` a un sitio que no lo miraba, y el dialogo se abria
       * igualmente: el usuario creia haber cancelado la lectura del fichero y
       * se leaba entero. Es la otra forma del mismo bug, con estado en vez de
       * aviso.
       */
      const r = await conCarga('loading.importing', async () => {
        const contents = await storageService.stageTxt();

        if (contents === null) return null;

        return {
          contents,
          preview: await storageService.previewImport(contents),
        };
      });

      if (!r.ok || r.valor === null) return;

      setStagedImport({ fileName: IMPORT_FILE_NAME, ...r.valor });
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.readFileFailed'),
        'error',
      );
    }
  };

  /** Paso 2: confirmar e importar el contenido ya leido. */
  const handleConfirmImport = async (): Promise<void> => {
    if (!stagedImport) return;

    try {
      const r = await conCarga('loading.importing', async () => {
        const guardado = await storageService.commitImport(stagedImport.contents);

        notify(
          traducir(
            pluralKey(guardado.inserted, 'app.importedOne', 'app.importedMany'),
            [guardado.inserted],
          ) +
            (guardado.alreadyInDb > 0
              ? traducir('app.importedDupes', [guardado.alreadyInDb])
              : ''),
          'success',
        );

        setStagedImport(null);

        return guardado;
      });

      if (r.ok) await reload();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : traducir('app.importFailed'),
        'error',
      );
    }
  };

  /**
   * Exporta **lo que se esta viendo**, no la coleccion entera.
   *
   * Si hay filtros puestos y se exporta el TXT, lo que casi siempre se quiere
   * son esas claves y no las demas: se ha elegido «Solo disponibles», se ha
   * buscado un juego, se ha pulsado una plataforma. Exportar las cuatrocientas
   * obligaba a borrar a mano lo que no interesa.
   *
   * El aviso lo dice, con el numero, para que no salga por sorpresa un TXT mas
   * corto de lo que se esperaba.
   */
  const handleExport = async (): Promise<void> => {
    if (visible.length === 0) {
      notify(traducir('app.exportFilteredNone'), 'info');
      return;
    }

    try {
      const r = await conCarga('loading.exporting', () =>
        gameKeyService.exportToDialog(visible),
      );

      if (!r.ok) return;

      const result = r.valor;

      if (!result) return;

      const filtrado = visible.length < keys.length;

      notify(
        (filtrado
          ? traducir('app.exportFiltered', [result.total])
          : traducir('app.exported', [result.total])) +
          (result.path === '' ? '' : ` · ${result.path}`),
        'success',
      );
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : traducir('app.exportFailed'), 'error');
    }
  };

  // ---------------------------------------------------------------- vista ---
  /** Abrir ajustes en una pestana concreta, sin tener que buscarla a mano. */
  const openSettingsAt = useCallback((tab: SettingsTab): void => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  /** AppIds de la coleccion, para marcar en la tabla que ya hay clave. */
  const appIdsConClave = useMemo(() => {
    const ids = new Set<number>();

    for (const key of keys) {
      const appId = (key as { steamAppId?: number | null }).steamAppId;

      if (typeof appId === 'number' && Number.isFinite(appId)) {
        ids.add(appId);
      }
    }

    return ids;
  }, [keys]);

  const handleRefreshSteam = useCallback(async (): Promise<void> => {
    try {
      /**
       * Por `conCarga`, como todo lo demas.
       *
       * Era lo unico que se quedaba con el `empezar` + `setBusy` a mano, y le
       * pasaba exactamente lo que se le reprochaba a `handleLinkSteam` antes de
       * arreglarlo: si el `fetch` no volvia, la barra entera se quedaba
       * apagada y el indicador —que el usuario puede cerrar, pero no siempre
       * mira— era lo unico visible.
       *
       * `abortable` es `true` de verdad: son peticiones HTTP y la senal mata el
       * `fetch`, no solo deja de mirarlo.
       */
      const r = await conCarga(
        'loading.syncing',
        async (senal) =>
          steamService.getOwnedGames(
            settings.steamApiKey,
            settings.steamId,
            senal,
          ),
        true,
      );

      // Cancelado: no se anuncia nada ni se guarda fecha de una sincronizacion
      // que el usuario acabo de cancelar.
      if (!r.ok) return;

      const ahora = new Date().toISOString();

      /**
       * Se guarda **antes** de pintar el estado.
       *
       * Al reves —primero `setCuenta`, luego el `set`— la interfaz decia «sincronizado
       * a las HH:MM» aunque el guardado fallara, y ademas la marca de tiempo se
       * calculaba dos veces: la que se guardaba y la que se enseñaban nunca
       * eran la misma, asi que la pantalla mentia por unos segundos sobre lo
       * que hay en la base.
       */
      await settingsService.set('steamSyncedAt', ahora);

      setOwned(r.valor.juegos);
      setCuenta((current) => ({
        ...current,
        juegos: r.valor.juegos.length,
        sincronizadoAt: ahora,
      }));
      setBibliotecaIncompleta(r.valor.truncada);

      /**
       * Truncada se avisa con tono neutro y encima de "sincronizado", no
       * debajo y en verde. El numero es real —son los juegos que se han
       * leido— pero no es el total, asi que un "sincronizado con N juegos"
       * a secas seria mentir.
       */
      notify(
        r.valor.truncada
          ? traducir('app.syncedPartial', [r.valor.juegos.length])
          : traducir('app.synced', [r.valor.juegos.length]),
        r.valor.truncada ? 'info' : 'success',
      );
    } catch (cause) {
      if (cause instanceof SteamError && cause.codigo === 'cancelado') return;

      notify(
        cause instanceof SteamError
          ? textoDeSteamError(cause, traducir)
          : cause instanceof Error
            ? cause.message
            : traducir('app.syncFailed'),
        'error',
      );
    }
  }, [conCarga, notify, settings.steamApiKey, settings.steamId, traducir]);

  return (
    <LocaleContext.Provider value={t}>
    <div className="flex h-full flex-col bg-surface-0">
      {/*
       * Primer arranque. Va antes que la barra porque no hay coleccion todavia
       * y las dos cosas que se pueden hacer —traer la base de datos o empezar de
       * cero— son las unicas que existen: abrir la barra ofereceria filtros y
       * acciones sobre una lista vacia que todavia no esta ni en disco.
       */}
      {arranque === null ? null : arranque.database === 'empty' ? (
        <FirstRun
          databasePath={arranque.databasePath}
          onStartEmpty={() => setArranque({ ...arranque, database: 'ready' })}
        />
      ) : (
        <>
      <Toolbar
        filter={filter}
        stats={stats}
        sort={sort}
        busy={busy}
        searchRef={searchRef}
        view={vista}
        cuenta={cuenta}
        onFilterChange={patchFilter}
        onSortChange={setSort}
        onViewChange={setVista}
        onOpenSteamSettings={() => openSettingsAt('account')}
        onCreate={handleCreate}
        onImport={handleImport}
        onExport={handleExport}
        onOpenStorage={() => setStorageOpen(true)}
        onOpenSettings={() => openSettingsAt('appearance')}
      />

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {vista === AppView.Games ? (
          cuenta.conectado ? (
            <SteamGamesTable
              incompleta={bibliotecaIncompleta}
              juegos={owned}
              cuenta={cuenta}
              conClave={appIdsConClave}
              onRefresh={handleRefreshSteam}
              busy={busy}
            />
          ) : (
            <SteamNotConnected onOpen={() => openSettingsAt('account')} />
          )
        ) : loading ? (
          <div className="flex h-full items-center justify-center text-sm text-t4">
            {traducir('app.loadingCollection')}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            hasKeys={keys.length > 0}
            onCreate={handleCreate}
            onImport={handleImport}
            onClearFilters={() => setFilter(emptyFilter())}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {page.map((entry) => (
                <KeyRow
                  key={entry.id}
                  entry={entry}
                  onEdit={handleEdit}
                  onDelete={setDeleting}
                  onCycleStatus={handleCycleStatus}
                  selected={selection.has(entry.id)}
                  onToggleSelect={toggleSelect}
                  siblings={groups.get(claveGrupo(entry.title))?.total ?? 1}
                  ownedOnSteam={cuenta.conectado && esPropio(entry.title)}
                  tags={entry.tags}
                />
              ))}
            </div>

            {visible.length > page.length ? (
              <p className="mt-4 text-center text-xs text-t4">
                {traducir('footer.showing', [page.length, visible.length])}
              </p>
            ) : null}
          </>
        )}
      </main>

      <AppFooter
        vista={vista}
        visibleCount={visible.length}
        totalCount={keys.length}
        giftable={stats.available}
        cuenta={cuenta}
        undo={deshacer.entrada}
        onUndo={() => void deshacerUltima()}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      {stagedImport ? (
        <ImportPreview
          fileName={stagedImport.fileName}
          preview={stagedImport.preview}
          onConfirm={handleConfirmImport}
          onCancel={() => setStagedImport(null)}
        />
      ) : null}

      {storageVivo ? (
        <StoragePanel
          onClose={() => setStorageOpen(false)}
          onChanged={reload}
          notify={notify}
        />
      ) : null}

      {settingsVivo ? (
        <SettingsDialog
          open={settingsOpen}
          initialTab={settingsTab}
          settings={settings}
          cuenta={cuenta}
          onSave={handleSaveSettings}
          onLinkSteam={handleLinkSteam}
          onForgetApiKey={handleForgetApiKey}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {editorVivo ? (
        <KeyEditor
          entry={editing}
          onSave={handleSave}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={traducir('row.delete')}
          message={traducir('row.delete.body', [deleting.title])}
          confirmLabel={traducir('action.delete')}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}

      {/* ------------------------------------------------------- seleccion ---
          La barra solo aparece en la tabla de claves. En la de juegos no hay
          nada seleccionado ni seleccionable, asi que mostrarla seria un boton
          flotando sobre una tabla donde no hace nada. */}
      {vista === AppView.Keys && selectedKeys.length > 0 ? (
        <SelectionBar
          facts={facts}
          visibles={visible.length}
          onSelectAll={selectAll}
          onClear={clearSelection}
          onExport={handleExportGift}
          onMarkGifted={() => setGiftDialogOpen(true)}
          onBulkStatus={() => setBulkStatusOpen(true)}
          onTags={() => setTagsOpen(true)}
          motivo={motivo}
        />
      ) : null}

      {bulkVivo ? (
        <BulkStatusDialog
          open={bulkStatusOpen}
          entries={selectedKeys}
          onApply={handleApplyBulkStatus}
          onClose={() => setBulkStatusOpen(false)}
        />
      ) : null}

      {giftVivo ? (
        <GiftDialog
          open={giftDialogOpen}
          entries={actionableKeys}
          onConfirm={handleConfirmGift}
          onCancel={() => setGiftDialogOpen(false)}
        />
      ) : null}

      {expireVivo ? (
        <ConfirmDialog
          title={traducir('select.markExpired')}
          message={traducir(
            facts.expirable === 1 ? 'expire.bodyOne' : 'expire.bodyMany',
            [
              facts.expirable === 1
                ? (selectedKeys.find((key) => key.status !== KeyStatus.Expired)
                    ?.title ?? '')
                : facts.expirable,
            ],
          )}
          confirmLabel={traducir('expire.confirm')}
          onConfirm={handleConfirmExpire}
          onCancel={() => setExpireDialogOpen(false)}
        />
      ) : null}

      {tagsVivo ? (
        <TagsDialog
          open={tagsOpen}
          entries={selectedKeys}
          todas={keys}
          iniciales={etiquetasComunes(selectedKeys)}
          plataformas={[...new Set(selectedKeys.map((key) => key.platform))]}
          onConfirm={handleApplyTags}
          onCancel={() => setTagsOpen(false)}
        />
      ) : null}

      {shortcutsVivo ? (
        <ShortcutsDialog
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />
      ) : null}

      {/*
        El indicador va fuera del `LocaleContext.Provider` interior que cierra
        el resto: es fijo sobre la barra y no empuja el contenido, para que
        aparecer y desaparecer no mueva ni un pixel la lista.
      */}
      <LoadingIndicator tareas={carga.tareas} onCancel={carga.cancelar} />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
        </>
      )}
    </div>
    </LocaleContext.Provider>
  );
}

/** `true` si la clave se puede regalar todavia. */
function isAvailable(entry: IGameKey): boolean {
  return isGiftable(entry);
}

/** Las etiquetas que aparecen en todas las claves seleccionadas. */
function etiquetasComunes(entries: readonly IGameKey[]): readonly string[] {
  if (entries.length === 0) return [];

  const [primera, ...resto] = entries;

  if (!primera) return [];

  return primera.tags.filter((tag) =>
    resto.every((key) => key.tags.includes(tag)),
  );
}

/**
 * Aplica el tema al documento.
 *
 * Cuando el tema es `system` se traduce a `light` o `dark` segun lo que diga
 * el sistema operativo. No se puede dejar el atributo en `system` y confiar en
 * el CSS del todo, porque hay reglas de los componentes que dependen de
 * variables y hay que resolverlas aqui una sola vez y para todas.
 */
function applyTheme(tema: AppTheme): void {
  if (typeof document === 'undefined') return;

  if (tema !== AppTheme.System) {
    document.documentElement.dataset.theme = tema;
    return;
  }

  const claro =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-color-scheme: light)').matches;

  document.documentElement.dataset.theme = claro
    ? AppTheme.Light
    : AppTheme.Dark;
}

interface IEmptyStateProps {
  hasKeys: boolean;
  onCreate: () => void;
  onImport: () => void;
  onClearFilters: () => void;
}

function EmptyState({ hasKeys, onCreate, onImport, onClearFilters }: IEmptyStateProps) {
  // Los dos estados (no hay nada / no hay resultados) estaban escritos en
  // español en el marcado, asi que con la app en cualquier otro idioma salian
  // en castellano justo en las pantallas que se ven la primera vez. Se traducen
  // con `useT()`, que es el mismo traductor que consume el resto del arbol.
  const { t } = useT();

  if (hasKeys) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-hover text-t4">
          <Icon name="search" size={22} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-t2">{t('empty.noResults')}</h3>
          <p className="mt-1 text-xs text-t4">{t('empty.noResultsHint')}</p>
        </div>
        <Button variant="subtle" size="sm" onClick={onClearFilters}>
          {t('empty.clearFilters')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10 text-info ring-1 ring-info/20">
        <Icon name="key" size={22} />
      </div>
      <div>
        <h3 className="text-sm font-medium text-t2">{t('empty.title')}</h3>
        <p className="mt-1 text-xs text-t4">{t('empty.hint')}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" icon="upload" onClick={onImport}>
          {t('empty.import')}
        </Button>
        <Button variant="subtle" icon="plus" onClick={onCreate}>
          {t('empty.create')}
        </Button>
      </div>
    </div>
  );
}