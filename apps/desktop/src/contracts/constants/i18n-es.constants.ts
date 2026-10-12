import type { TranslationTable } from './i18n.constants';

/**
 * Diccionario de origen, en espanol.
 *
 * La clave **es** el texto en espanol, sin tildes y en `snake_case`. Cuando
 * un idioma no tiene traduccion, `t()` devuelve la clave, que en la practica
 * significa que la app sigue leyendose en espanol en lugar de romperse.
 *
 * Los textos van sin tildes a proposito: es el mismo criterio que sigue el
 * resto de la interfaz, y mantenerlo en todo el sitio evita que la mitad de los
 * mensajes lleve tilde y la otra mitad no.
 */
export const ES: TranslationTable = Object.freeze({
  // ------------------------------------------------------------- generic ---
  'action.save': 'Guardar',
  'action.cancel': 'Cancelar',
  'action.close': 'Cerrar',
  'action.confirm': 'Confirmar',
  'action.clear': 'Limpiar',

  // --------------------------------------------------------- estado vacio ---
  'empty.title': 'Todavia no hay claves',
  'empty.hint': 'Importa tu TXT o anade una clave a mano.',
  'empty.import': 'Importar TXT',
  'empty.create': 'Anadir clave',
  'empty.noResults': 'Ningun resultado',
  'empty.noResultsHint':
    'Prueba a cambiar la busqueda o quitar algun filtro.',
  'empty.clearFilters': 'Limpiar filtros',

  // --------------------------------------------------- primer arranque ---
  'firstRun.title': 'Todavia no hay base de datos',
  'firstRun.body':
    'No se ha creado ninguna. Se creara en cuanto anadas o importes la primera clave, al lado del programa, en {0}.',
  'firstRun.moved.title': 'Has copiado el programa desde otro sitio',
  'firstRun.moved.body':
    'Las claves, los ajustes y la cuenta de Steam estan dentro de {0}. Si has copiado solo el ejecutable, copia tambien ese fichero de la carpeta de origen y dejalo al lado; si no, empezarias de cero.',
  'firstRun.bring': 'Traer la base de datos',
  'firstRun.create': 'Empezar de cero',
  'action.edit': 'Editar',
  'action.add': 'Anadir',
  'action.apply': 'Aplicar',
  'action.delete': 'Eliminar',
  'action.copy': 'Copiar',

  // -------------------------------------------------------------- header ---
  'app.title': 'Steam Keys',
  'app.subtitle': '{0} disponibles de {1}',
  'search.placeholder': 'Buscar por juego, clave, destinatario o nota…',

  // ------------------------------------------------------------ toolbar ---
  'toolbar.sort': 'Ordenar por',
  'toolbar.export': 'Exportar',
  'toolbar.import': 'Importar',
  'toolbar.data': 'Datos',
  'toolbar.settings': 'Ajustes',
  'toolbar.add': 'Anadir',
  'sort.recent': 'Mas recientes',
  'sort.alpha': 'A - Z',
  'sort.status': 'Por estado',
  'sort.platform': 'Por plataforma',
  'filter.platform': 'Plataforma',
  'filter.status': 'Estado',

  // ------------------------------------------------------------- ambito ---
  'filter.scope.label': 'Disponibles',
  'filter.scope.all': 'Todos',
  'filter.scope.available': 'Solo disponibles',

  // ---------------------------------------------------------------- tipo ---
  'filter.kind.label': 'Tipo',
  'filter.kind.all': 'Todos',
  'filter.kind.games': 'Solo juegos',
  'filter.kind.dlc': 'Solo DLC',

  'filter.menu.all': 'Todas',
  'filter.menu.none': 'Ninguna',
  'filter.menu.scope': 'Cuantas marcar',
  'filter.tags': 'Etiquetas',
  'filter.tags.footHint':
    'Sin marcar ninguna, se ve todo. Con varias marcadas, el filtro incluye las que llevan alguna, o solo las que las llevan todas si cierras el candado.',
  'filter.menu.footHint':
    'Sin marcar ninguna, se ve todo. Con varias marcadas, el filtro incluye las que llevan alguna.',
  'filter.menu.orAnd.off': 'Elementos que contengan alguna seleccionada.',
  'filter.menu.orAnd.on': 'Elementos que contengan todas las seleccionadas.',
  'filter.menu.lockOn': 'Filtro cerrado: exige todas',
  'filter.reset': 'Quitar busqueda y filtros',

  // ---------------------------------------------------------- selection ---
  'select.one': '{0} seleccionada',  'select.many': '{0} seleccionadas',
  'select.all': 'Seleccionar todo',
  'select.export': 'Exportar para regalar',
  'select.markGifted': 'Marcar regaladas',
  'select.tags': 'Etiquetas',
  'select.clear': 'Limpiar',
  'select.giftableOne': '{0} se puede regalar',
  'select.giftableMany': '{0} se pueden regalar',
  'select.giftableRest': '· {0} ya no',
  'select.giftableNone': 'Ninguna se puede regalar tal como esta',
  'select.untoggleAll': 'Quitar todo',
  'select.clearAll': 'Quitar la seleccion de toda la lista',
  'select.allHere': 'Seleccionar todo lo que hay ahora mismo en la lista',
  'select.groupGift': 'Regalar',
  'select.groupState': 'Cambiar su estado',
  'select.groupOrganize': 'Organizar',
  'select.exportHint':
    'Guardar las claves seleccionadas en un TXT para regalar',
  'select.giftedHint':
    'Marca las seleccionadas como ya regaladas y dice a quien',
  'select.tagsHint': 'Cambia las etiquetas de las seleccionadas',

  // ------------------------------------------- cambiar estado de golpe ---
  'bulk.title': 'Cambiar el estado',
  'bulk.subtitle': 'Se aplicara a {0} claves seleccionadas',
  'bulk.hint':
    'Se cambia solo a las claves que permitan ese estado. Las demas se quedan como estan.',
  'bulk.becomes': '{0} pasan a {1}',
  'bulk.alreadyThere': '{0} ya estaban en {1}',
  'bulk.cannotBecome': '{0} no pueden pasar a {1}',
  'bulk.apply': 'Cambiar el estado',
  'bulk.pending': '{0} claves pasan a {1}',
  'bulk.doneOne': 'Estado cambiado en {0} clave.',
  'bulk.doneMany': 'Estado cambiado en {0} claves.',
  'bulk.none': 'Ninguna de las seleccionadas puede pasar a ese estado.',

  // ----------------------------------------------------------- tooltips ---

  // ------------------------------------------------------------- status ---
  'status.available': 'Disponible',
  'status.gifted': 'Regalada',
  'status.redeemed': 'Canjeada',
  'status.expired': 'Caducada',
  'status.unknown': 'Por revisar',
  'status.hint.available': 'La tengo yo, todavia regalable.',
  'status.hint.gifted': 'Ya se la he dado a alguien.',
  'status.hint.redeemed': 'Activada por mi.',
  'status.hint.expired': 'La fecha limite de activacion ya paso.',
  'status.hint.unknown':
    'No consta cuando caduca o si se puede comprobar.',

  // --------------------------------------------------------- tags modal ---
  'tags.usesOne': '{0} clave',
  'tags.usesMany': '{0} claves',
  'tags.removeHint': 'Quitar esta etiqueta de la coleccion',
  'tags.removeTitle': 'Quitar la etiqueta',
  'tags.removeBody':
    'Se quitara «{0}» de la coleccion y de las {1} que la llevan. No se puede deshacer.',
  'tags.removeLabel': 'Quitar la etiqueta {0}',
  'tags.removedOne': 'Se quito de {0} clave.',
  'tags.removedMany': 'Se quito de {0} claves.',
  'tags.title': 'Etiquetas',
  'tags.new': 'Etiqueta nueva',
  'tags.addHint': 'Anadir la etiqueta a la seleccion',
  'tags.empty': 'Todavia no hay etiquetas en la coleccion.',
  'tags.merging':
    'Las claves que no tengan la etiqueta la reciben; las que ya la tienen la conservan.',
  'tags.applyHint':
    'Aplicar estas etiquetas a todas las claves seleccionadas',

  // ---------------------------------------------------------- key editor ---
  'editor.title': 'Juego',
  'editor.titlePlaceholder': 'Celeste, Hollow Knight, Half-Life 2…',
  'editor.key': 'Clave',
  'editor.keyHint': 'Se guarda tal cual la introduces.',
  'editor.keyPlaceholder': 'XXXXX-XXXXX-XXXXX',
  'editor.platform': 'Plataforma',
  'editor.status': 'Estado',
  'editor.recipient': 'Regalada a',
  'editor.recipientHint': 'Solo si ya la has dado a alguien.',
  'editor.recipientPlaceholder': 'Nombre de quien lo recibe',
  'editor.parent': 'Juego padre',
  'editor.parentHint': 'Rellena si es un DLC.',
  'editor.parentPlaceholder': 'Half-Life 2',
  'editor.note': 'Nota',
  'editor.noteHint': 'Promo de origen, fecha, instrucciones…',
  'editor.notePlaceholder': 'Junio 2018 Humble Monthly',
  'editor.tags': 'Etiquetas',
  'editor.tagsHint': 'Elige de la lista o escribe una nueva. Renombrar y quitar de la coleccion, en Ajustes.',
  'editor.tagsPlaceholder': 'humble, dlc, promo',

  // --------------------------------------------------------------- gift ---
  'gift.title': 'Marcar como regaladas',
  'gift.placeholder': 'Nombre de quien lo recibe',
  'gift.recipient': '¿A quien se lo has regalado?',
  'gift.recipientHint': 'Se guarda con cada clave, para saber a quien se la diste.',
  'gift.more.one': 'y {0} juego mas',
  'gift.more.many': 'y {0} juegos mas',

  // ------------------------------------------------------------ import ---
  'import.title': 'A importar',
  'import.titleHint': 'Claves nuevas que se anaden a la base de datos',
  'import.duplicates': 'Ya tenias',
  'import.duplicatesHint':
    'Duplicadas dentro del propio TXT o ya en la base de datos',
  'import.available': 'Disponibles',
  'import.availableHint': 'Marcadas como regalables',
  'import.gifted': 'Ya regaladas',
  'import.giftedHint': 'El TXT las marcaba con un guion inicial',

  // -------------------------------------------------------------- fila ---
  'row.dlc': 'Contenido adicional de otro juego',
  'row.owned': 'Ya tienes este juego en tu cuenta de Steam',
  'row.siblings': '{0} claves de este juego en la coleccion',
  'row.showKey': 'Mostrar clave',
  'row.hideKey': 'Ocultar clave',
  'row.copyKey': 'Copiar clave',
  'row.status': 'Estado: {0}. {1} Pulsa para cambiarlo.',
  'row.forRecipient': 'para {0}',

  // ------------------------------------------------------------ settings ---
  'settings.title': 'Ajustes',
  'settings.tabs': 'Seccion de ajustes',
  'settings.tab.appearance': 'Apariencia',
  'settings.tab.account': 'Cuenta de Steam',
  'settings.theme': 'Tema',
  'settings.language': 'Idioma',
  'settings.apiKey': 'Clave de la API de Steam',
  'settings.apiKey.hint':
    'Gratuita, y se guarda solo en este ordenador: no se envia a ningun sitio.',
  'settings.apiKey.link': 'Pedir una clave nueva',
  'settings.apiKey.placeholder': 'Pega aqui tu clave',
  'settings.apiKey.show': 'Ver la clave',
  'settings.apiKey.hide': 'Ocultar la clave',
  'settings.steamId.hint':
    'Vale cualquiera de los dos. El numero son 17 cifras y empieza por 7656119. El nombre es lo que va justo detras de /id/ en la direccion de tu perfil: si tu perfil es steamcommunity.com/id/mi-juego, tu nombre es mi-juego.',
  'settings.steamId.placeholder': '76561198023249625 o tu nombre',
  'settings.steamId.label': 'ID o nombre de perfil',
  'settings.steam.link': 'Conectar',
  'settings.steam.linked': 'Conectada como {0}',
  'settings.steam.notLinked': 'Sin conectar',
  'settings.steam.syncedAt': 'Ultima sincronizacion {0}',
  'settings.steam.linkedOk': 'Conexion realizada y guardada',
  'settings.steam.games': '{0} juegos',
  'settings.steam.forget': 'Olvidar la clave',
  'settings.steam.forgetHint':
    'Borrar la clave de la API de la base de datos',
  'settings.steam.needKey': 'Hace falta la clave de la API',
  'settings.steam.needId': 'Pon tu ID de Steam o el nombre de tu perfil',
  'settings.theme.hint':
    'Se ve al momento. «System» sigue al sistema operativo y cambia solo si el sistema cambia.',
  'settings.language.hint':
    'Cambia el idioma de los menus y los botones.',
  'settings.steam.visibility':
    'Tu perfil de Steam tiene que ser publico para que la app vea tu biblioteca.',

  // ------------------------------------------------------------- library ---
  'view.label': 'Coleccion',
  'view.keys': 'Claves',
  'view.games': 'Mis juegos',
  'library.empty': 'Conecta tu cuenta de Steam para ver tu biblioteca.',
  'library.name': 'Juego',
  'library.playtimeShort': 'Jugado',
  'library.playtime': '{0} h jugados',
  'library.notPlayed': 'Sin jugar',
  'library.owned': 'En propiedad',

  // -------------------------------------------------------- owned games ---
  'owned.owned': 'En propiedad',
  'owned.dlc': 'DLC',
  'owned.unverified': 'Sin emparejar',

  // -------------------------------------------------------------- toasts ---

  // ------------------------------------------------------- review score ---

  // -------------------------------------------------------------- datos ---
  'data.close': 'Cerrar datos',
  'data.title': 'Datos y copias de seguridad',
  'data.subtitle':
    'Onde vive tu coleccion y como recuperarla si algo sale mal.',

  // ------------------------------------------------------ copia y restauro ---
  'storage.created': 'Copia creada: {0}',
  'storage.restored':
    'Restauradas {0} claves: {1} nuevas, {2} actualizadas, {3} sin cambios.',

  // ------------------------------------------------------------- ficheros ---
  'file.pick.title': 'Selecciona el TXT de keys',
  'file.save.title': 'Guardar listado de keys',
  'file.filter.text': 'Texto',

  // ------------------------------------------------------ estado vacio ---

  // --------------------------------------------------------------- pie ---
  'row.select': 'Seleccionar {0}',
  'row.onSteam': 'En Steam',
  'bulk.blocked.notOwned':
    'Ya no la tienes: regalarla otra vez no es posible',
  'bulk.blocked.needRecipient': 'Falta decir a quien se la regalaste',
  'selection.blockedOne':
    'Cambia el filtro a «Solo disponibles» para dejar fuera esa 1',
  'selection.blockedMany':
    'Cambia el filtro a «Solo disponibles» para dejar fuera esas {0}',
  'selection.blockedNone':
    'Cambia el filtro a «Solo disponibles» para poder actuar sobre la seleccion',
  'selection.blockedExpired': 'Ya estaban todas caducadas',

  // ------------------------------------------------------ exportacion ---
  'export.title': 'exportacion',
  'export.generated': 'Generado el {0}',
  'export.total': 'Total: {0} claves',
  'gift.count.one': '{0} clave seleccionada',  'gift.count.many': '{0} claves seleccionadas',
  'gift.action': 'Marcar regaladas',
  'gift.needRecipient': 'Escribe primero a quien se lo regalas',
  'import.header': 'Importar desde TXT',
  'import.noneNew':
    'No hay ninguna clave nueva en este fichero. Puede que ya las tuvieras todas importadas.',
  'import.issues': '{0} linea(s) sin interpretar',
  'import.issuesHint':
    'Son lineas que el parser no ha sabido convertir en una clave: duplicados, sufijos pegados o claves de plataforma desconocida. Se ignoran; no bloquean la importacion.',
  'import.backupNotice':
    'Antes de escribir se crea una copia de seguridad automatica de tu base de datos.',
  'import.none': 'Nada que importar',
  'import.apply': 'Importar {0} claves',
  'tags.count.one': 'Se cambiara {0} clave',  'tags.count.many': 'Se cambiaran {0} claves',
  'editor.needBoth': 'El nombre del juego y la clave son obligatorios.',
  'editor.saveError': 'No se pudo guardar.',
  'editor.editTitle': 'Editar clave',
  'editor.newTitle': 'Nueva clave',
  'editor.editHint': 'Los cambios se guardan en tu base de datos local.',
  'editor.newHint': 'Anade una clave a tu coleccion.',
  'editor.save': 'Guardar cambios',
  'editor.add': 'Anadir clave',
  'storage.error.read': 'No se pudo leer el estado.',
  'storage.error.backup': 'No se pudo crear la copia.',
  'storage.deleteBackup': 'Eliminar esta copia',
  'storage.deleteBackup.body':
    'La copia «{0}» se borrara de forma permanente. No habra forma de recuperarla.',
  'storage.deleted': 'Copia eliminada.',
  'storage.error.delete': 'No se pudo eliminar.',
  'storage.error.restore': 'No se pudo restaurar.',
  'storage.unexpected': 'La base de datos no responde como se espera.',
  'storage.corrupted': 'SQLite ha reportado un problema de integridad.',
  'storage.corruptedTitle': 'La base de datos esta dañada',
  'storage.backupNow': 'Crear una copia ahora',
  'storage.desktopOnly': 'Sin base de datos',
  'storage.copyNow': 'Copiar ahora',
  'storage.restoring': 'Restaurando…',
  'storage.restore': 'Restaurar',
  'storage.mode.desktop': 'App de escritorio',
  'storage.mode.devBridge': 'Desarrollo (BD aparte)',
  'storage.mode.memory': 'Vista previa en navegador',
  'storage.notice.desktop':
    'Las claves estan en tu disco, en una base de datos SQLite, con copias de seguridad automaticas.',
  'storage.notice.devBridge':
    'Estas viendo una base de datos de desarrollo aparte de la de la app, en .dev/. Lo que edites aqui no toca tus claves; es el sitio donde se prueba la interfaz.',
  'storage.notice.memory':
    'Vista previa en navegador: los datos viven en localStorage y se pierden si limpias los datos del navegador.',
  'app.loadFailed': 'No se pudo leer la coleccion.',
  'app.nothingSelected': 'No hay nada seleccionado.',
  'app.saveFailed': 'No se pudieron guardar.',
  'app.needApiKey': 'Antes hay que poner la clave de la API.',
  'app.keyForgotten': 'Clave borrada.',
  'app.readFileFailed': 'No se pudo leer el fichero.',
  'app.importFailed': 'La importacion fallo.',
  'app.exportFailed': 'La exportacion fallo.',
  'app.syncFailed': 'La sincronizacion fallo.',
  'app.markFailed': 'No se pudieron marcar.',
  'app.tagsFailed': 'No se pudieron cambiar las etiquetas.',
  'app.fileFailed': 'No se pudo guardar el fichero.',
  'app.saved': 'Clave actualizada.',
  'app.created': 'Clave anadida.',
  'app.deleted': 'Clave eliminada.',
  'app.deleteFailed': 'No se pudo eliminar la clave.',
  'app.loadingCollection': 'Cargando la coleccion…',
  'app.noFile': 'No se guardo ningun fichero.',
  'app.needRecipient': 'Hay que decir a quien se lo has regalado.',
  'app.exportOne': '{0} clave guardada en {1}',  'app.exportMany': '{0} claves guardadas en {1}',
  'app.giftedOne': '{0} clave regalada a {1}.',  'app.giftedMany': '{0} claves regaladas a {1}.',
  'app.expiredOne': '{0} clave caducada.',  'app.expiredMany': '{0} claves caducadas.',
  'app.tagsOne': 'Etiqueta actualizada en {0} clave.',  'app.tagsMany': 'Etiquetas actualizadas en {0} claves.',
  'app.libraryOne': '{0} juego en tu biblioteca.',  'app.libraryMany': '{0} juegos en tu biblioteca.',
  'app.libraryPartial': '{0} Lejos del total: hay mas juegos de los que se han leido.',
  'app.syncedPartial': 'Biblioteca sincronizada a medias: {0} juegos leidos, puede haber mas.',
  'app.importedOne': 'Importada {0} clave',  'app.importedMany': 'Importadas {0} claves',
  'app.importedDupes': ' ({0} ya estaban)',
  'app.exported': 'Exportadas {0} claves.',
  'app.synced': 'Biblioteca sincronizada: {0} juegos.',
  'library.refresh': 'Actualizar biblioteca',
  'library.partial': 'lectura a medias',
  'library.partialHint':
    'La lectura se paro por el limite de paginas de Steam. El numero es el de los juegos leidos, no el total de la cuenta.',
  'storage.checking': 'Comprobando…',
  'storage.section.storage': 'Almacenamiento',
  'storage.section.backups': 'Copias de seguridad',
  'storage.data.keys': 'Claves guardadas',
  'storage.data.size': 'Tamano del fichero',
  'storage.data.where': 'Almacenamiento',
  'storage.data.whereHint':
    'Donde se estan guardando las claves ahora mismo.',
  'storage.data.unknown': 'Pendientes de revisar',
  'storage.data.unknownHint':
    'Claves cuya plataforma no se pudo determinar.',
  'storage.data.location': 'Ubicacion',
  'storage.backups.none':
    'Todavia no hay copias. Se crean solas antes de cada importacion o restauracion, y tambien puedes pulsar «Copiar ahora».',
  'storage.backups.desktopOnly':
    'Aqui los datos viven en el navegador, no en una base de datos, asi que no hay sitio donde guardar copias.',
  'storage.backups.keysOne': '{0} clave',
  'storage.backups.keysMany': '{0} claves',
  'storage.backups.keep':
    'Se guardan las 10 copias mas recientes dentro de la propia base de datos, y se crean solas antes de cada importacion o restauracion.',
  'storage.refresh': 'Actualizar',
  'storage.reason.manual': 'Manual',
  'storage.reason.beforeImport': 'Antes de importar',
  'storage.reason.beforeRestore': 'Antes de restaurar',
  'storage.reason.onMigrate': 'Al migrar',
  'storage.reason.fromFiles': 'Traida de archivos',
  'storage.restoreTitle': 'Restaurar {0}',
  'storage.restoreHint':
    'Se creara una copia del estado actual antes de aplicar nada, asi que esto tambien se puede deshacer.',
  'storage.merge.title': 'Solo anadir lo que falte',
  'storage.merge.text':
    'Recupera las claves que no tienes. No toca las que ya existen.',
  'storage.overwrite.title': 'Anadir y actualizar estados',
  'storage.overwrite.text':
    'Ademas, devuelve cada clave a como estaba en la copia. Util si has cambiado estados a mano por error.',
  'storage.restoreSafe':
    'Ninguna opcion borra claves: restaurar nunca reduce tu coleccion.',
  'row.delete': 'Eliminar clave',
  'row.delete.body': 'Se eliminara «{0}» de tu coleccion. Esto no se puede deshacer.',
  'app.linkFailed': 'No se ha podido conectar la cuenta.',
  'app.linkCancelled': 'Conexion con Steam cancelada.',
  'gift.hint': 'Marcar las claves seleccionadas como regaladas',

  /**
   * Errores de Steam.
   *
   * `SteamError.message` es la propia clave —`steam.<codigo>`— y los datos
   * variables van aparte, en `args`. Asi, si alguien lo pinta sin traducir, en
   * pantalla sale `steam.perfilPrivado` y se nota a la primera: es un fallo
   * ruidoso en lugar de castellano callado en cuatro de los cinco idiomas.
   */
  'steam.limite': 'Vas muy rapido. Espera un momento.',
  'steam.sinClave': 'Falta la clave de la API.',
  'steam.idInvalido': 'Eso no parece un ID de Steam ni un nombre de perfil.',
  'steam.perfilPrivado':
    'La biblioteca vino vacia. Comprueba que tu perfil de Steam sea publico, o que la clave sea de esa cuenta.',
  'steam.perfilNoExiste': 'No hay ningun perfil con el nombre «{0}».',
  'steam.perfilRenombrado': 'Ese perfil ahora se llama «{0}».',
  'steam.perfilIdNoLeido': 'No se pudo leer el ID del perfil «{0}».',
  'steam.perfilNoResponde': 'No se pudo consultar Steam.',
  'steam.estadoHttp': 'Steam respondio con el estado {0}.',
  'steam.vacio': 'La biblioteca de Steam vino vacia.',
  'steam.http': 'Steam no ha contestado.',
  'steam.cancelado': 'Sincronizacion cancelada.',
  'select.markExpired': 'Marcar como caducadas',
  'expire.confirm': 'Marcar caducadas',
  'expire.bodyOne':
    '«{0}» quedara como caducada y saldra de la lista de disponibles. Puedes cambiarlo luego con el toggle de estado.',
  'expire.bodyMany':
    'Las {0} claves seleccionadas quedaran como caducadas y saldran de la lista de disponibles. Puedes cambiarlas luego con el toggle de estado.',
  'footer.giftable': '· {0} regalables',
  'footer.games': '{0} juegos en Steam',
  'footer.shortcutSearch': 'buscar',
  'footer.shortcutNew': 'nueva',
  'footer.showing':
    'Mostrando {0} de {1}. Afina la busqueda para ver el resto.',
  'footer.countOne': '{0} clave',
  'footer.countMany': '{0} de {1} claves',
  'platform.unknown': 'Sin determinar',
  'storage.portable.title': 'Modo portable',
  'storage.restoreCounting': 'Calculando lo que va a cambiar…',
  'storage.restoreWillAdd': 'Entran {0} nuevas',
  'storage.restoreWillUpdate': 'Se actualizan {0}',
  'storage.portable.text':
    'Las claves y las copias estan en un solo fichero, steam-keys.db, al lado del programa y no en tu carpeta de usuario. Si mueves el ejecutable a otra carpeta, mueve tambien ese fichero, o te quedaras sin la coleccion.',
  'loading.more': '+{0}',
  'loading.cancel': 'Cancelar',
  'loading.cancelNoAbort': 'Dejar de esperar',
  'loading.saving': 'Guardando',
  'loading.deleting': 'Eliminando',
  'loading.importing': 'Importando',
  'loading.exporting': 'Exportando',
  'loading.syncing': 'Sincronizando con Steam',

  'loading.gifting': 'Marcando como regaladas',
  'loading.expiring': 'Marcando como caducadas',
  'loading.status': 'Cambiando el estado',
  'loading.tags': 'Guardando las etiquetas',
  'shortcuts.title': 'Atajos de teclado',
  'shortcuts.groupGeneral': 'General',
  'shortcuts.groupSelection': 'Seleccion',
  'shortcuts.groupActions': 'Acciones',
  'shortcuts.search': 'Ir a la busqueda',
  'shortcuts.new': 'Anadir una clave',
  'shortcuts.thisDialog': 'Ver estos atajos',
  'shortcuts.close': 'Cerrar lo que este abierto',
  'shortcuts.selectAll': 'Marcar todas las visibles',
  'shortcuts.clearSelection': 'Quitar la seleccion',
  'shortcuts.undo': 'Deshacer la ultima accion',
  'shortcuts.hint': 'Dentro de un campo de texto siguen valiendo Escape, Ctrl+A y Ctrl+Z.',
  'app.duplicateKey': 'Ya tienes esa clave, en «{0}».',
  'app.undoNothingHappened':
    'No se ha podido deshacer: las claves ya no estan en la coleccion.',
  'app.undoDone': 'Deshecho: {0}',
  'app.undoAvailable': 'Deshacer: {0}',
  'app.nothingToUndo': 'No hay nada que deshacer.',
  'app.undoHint': 'Se puede deshacer con Ctrl+Z.',
  'app.saveTimedOut': 'El guardado esta tardando demasiado. Intentalo otra vez.',
  'app.exportFiltered': 'Exportando las {0} claves que estas viendo.',
  'app.exportFilteredNone': 'No hay claves visibles que exportar.',
  'toolbar.shortcuts': 'Atajos',
  'editor.restorePreviewTitle': 'Que va a cambiar',
  'editor.restorePreviewNone': 'No hay nada que restaurar.',

 'settings.tab.keys': 'Claves',
  'settings.keys.tags': 'Etiquetas',
  'settings.keys.file': 'El fichero',
  'settings.keys.file.hint': 'Exportar la coleccion al TXT de siempre, importar uno, o ver donde esta el fichero y cuanto ocupa.',
  'settings.keys.tags.hint': 'Como se llaman las etiquetas de la coleccion. Renombrar una cambia el nombre en todas las claves que la llevan.',
  'settings.keys.tags.manage': 'Gestionar etiquetas',
  'settings.keys.tags.total': 'en el catalogo',
  'settings.keys.tags.inUseOne': '{0} en uso',
  'settings.keys.tags.inUseMany': '{0} en uso',
  'settings.keys.tags.idle': '{0} sin usar',
  'settings.keys.tags.more': 'y {0} mas',
  'tags.addOne': 'Anadir etiqueta',
  'tags.removeOne': 'Quitar la etiqueta {0} de esta clave',
  'tags.manage.title': 'Etiquetas',
  'tags.manage.hint': 'Las etiquetas son de la coleccion entera: renombrar una cambia el nombre en todas las claves que la llevan.',
  'tags.manage.newPlaceholder': 'Nombre de la etiqueta nueva',
  'tags.manage.add': 'Anadir',
  'tags.manage.rename': 'Renombrar',
  'tags.manage.renameLabel': 'Nombre de la etiqueta',
  'tags.manage.mergeTitle': 'Unir las dos etiquetas',
  'tags.manage.mergeBody': '«{1}» ya existe. Se renombrara «{0}» a «{1}», las claves que ya tienen «{1}» no cambiaran y «{0}» dejara de existir.',
  'tags.manage.merge': 'Unir',
  'tags.renamedOne': '«{0}» se ha renombrado y {1} clave la lleva ahora.',
  'tags.renamedMany': '«{0}» se ha renombrado y {1} claves la llevan ahora.',
});
