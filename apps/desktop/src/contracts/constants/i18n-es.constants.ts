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
  'action.add': 'Anadir',
  'action.clear': 'Limpiar',
  'action.forget': 'Olvidar',
  'action.edit': 'Editar',
  'action.delete': 'Eliminar',
  'action.copy': 'Copiar',
  'action.back': 'Volver',

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
  'filter.scope.label': 'Estado',
  'filter.scope.all': 'Todos',
  'filter.scope.available': 'Solo disponibles',

  // ---------------------------------------------------------------- tipo ---
  'filter.kind.label': 'Tipo',
  'filter.kind.all': 'Todos',
  'filter.kind.games': 'Solo juegos',
  'filter.kind.dlc': 'Solo DLC',

  'filter.status.locked':
    'Con «Solo disponibles» ya se ven solo las que no estan regaladas ni canjeadas: no se puede filtrar por estado a la vez.',
  'filter.reset': 'Quitar busqueda y filtros',

  // ---------------------------------------------------------- selection ---
  'select.one': '1 seleccionada',
  'select.many': '{0} seleccionadas',
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
  'select.exportHint': 'Guardar las claves seleccionadas en un TXT para regalar',
  'select.giftedHint': 'Marca las seleccionadas como ya regaladas y dice a quien',
  'select.tagsHint': 'Cambia las etiquetas de las seleccionadas',

  // ------------------------------------------- cambiar estado de golpe ---
  'bulk.title': 'Cambiar el estado',
  'bulk.subtitle': 'Se aplicara a {0} claves seleccionadas',
  'bulk.hint':
    'Se cambia solo a las claves que permitan ese estado. Las demas se quedan como estan.',
  'bulk.apply': 'Cambiar el estado',
  'bulk.pending': '{0} claves pasan a {1}',
  'bulk.done': 'Estado cambiado en {0} claves.',
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
  'status.hint.unknown': 'No consta cuando caduca o si se puede comprobar.',

  // --------------------------------------------------------- tags modal ---
  'tags.title': 'Etiquetas',
  'tags.new': 'Etiqueta nueva',
  'tags.addHint': 'Anadir la etiqueta a la seleccion',
  'tags.applyHint': 'Aplicar estas etiquetas a todas las claves seleccionadas',

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
  'editor.tagsHint': 'Separadas por comas.',
  'editor.tagsPlaceholder': 'humble, dlc, promo',

  // --------------------------------------------------------------- gift ---
  'gift.title': 'Marcar como regaladas',
  'gift.placeholder': 'Nombre de quien lo recibe',

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
  'settings.steam.forgetHint': 'Borrar la clave de la API de la base de datos',
  'settings.steam.needKey': 'Hace falta la clave de la API',
  'settings.steam.needId': 'Pon tu ID de Steam o el nombre de tu perfil',
  'settings.theme.hint':
    'Se ve al momento. «System» sigue al sistema operativo y cambia solo si el sistema cambia.',
  'settings.language.hint': 'Cambia el idioma de los menus y los botones.',
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
  'toast.saved': 'Key actualizada.',
  'toast.created': 'Key anadida.',
  'toast.deleted': 'Key eliminada.',
  'toast.exported': 'Exportadas {0} claves.',
  'toast.imported': 'Importadas {0} claves.',
  'toast.gifted': '{0} claves regaladas a {1}.',
  'toast.expired': '{count} claves marcadas como caducadas.',
  'toast.tagsApplied': 'Etiquetas actualizadas en {0} claves.',
  'toast.noFile': 'No se guardo ningun fichero.',
  'toast.recipient': 'Hay que decir a quien se lo has regalado.',
  'toast.nothingSelected': 'No hay nada seleccionado.',

  // ------------------------------------------------------- review score ---

  // -------------------------------------------------------------- datos ---
  'data.close': 'Cerrar datos',

  // ------------------------------------------------------ estado vacio ---

  // --------------------------------------------------------------- pie ---
  'bulk.blocked.notOwned': 'Ya no la tienes: regalarla otra vez no es posible',
  'bulk.blocked.needRecipient': 'Falta decir a quien se la regalaste',
  'gift.count.one': '1 clave seleccionada',
  'gift.count.many': '{0} claves seleccionadas',
  'gift.action': 'Marcar regaladas',
  'gift.needRecipient': 'Escribe primero a quien se lo regalas',
  'import.none': 'Nada que importar',
  'import.apply': 'Importar {0} claves',
  'tags.count.one': 'Se cambiara 1 clave',
  'tags.count.many': 'Se cambiaran {0} claves',
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
  'storage.deleted': 'Copia eliminada.',
  'storage.error.delete': 'No se pudo eliminar.',
  'storage.error.restore': 'No se pudo restaurar.',
  'storage.unexpected': 'La base de datos no responde como se espera.',
  'storage.corrupted': 'SQLite ha reportado un problema de integridad.',
  'storage.corruptedTitle': 'La base de datos esta dañada',
  'storage.backupNow': 'Crear una copia ahora',
  'storage.desktopOnly': 'Solo disponible en la app de escritorio',
  'storage.copyNow': 'Copiar ahora',
  'storage.restoring': 'Restaurando…',
  'storage.restore': 'Restaurar',
  'storage.mode.desktop': 'App de escritorio',
  'storage.mode.devBridge': 'Desarrollo (BD real)',
  'storage.mode.memory': 'Vista previa en navegador',
  'storage.notice.desktop': 'Las claves estan en tu disco, en una base de datos SQLite, con copias de seguridad automaticas.',
  'storage.notice.devBridge': 'Estas viendo la base de datos real a traves del puente de desarrollo. Lo que edites aqui se guarda en ella.',
  'storage.notice.memory': 'Vista previa en navegador: los datos viven en localStorage y se pierden si limpias los datos del navegador.',
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
  'app.noFile': 'No se guardo ningun fichero.',
  'app.needRecipient': 'Hay que decir a quien se lo has regalado.',
  'app.exportOne': '1 clave guardada en {0}',
  'app.exportMany': '{0} claves guardadas en {1}',
  'app.giftedOne': '1 clave regalada a {0}.',
  'app.giftedMany': '{0} claves regaladas a {1}.',
  'app.expiredOne': '1 clave caducada.',
  'app.expiredMany': '{0} claves caducadas.',
  'app.tagsOne': 'Etiqueta actualizada en 1 clave.',
  'app.tagsMany': 'Etiquetas actualizadas en {0} claves.',
  'app.libraryOne': '1 juego en tu biblioteca.',
  'app.libraryMany': '{0} juegos en tu biblioteca.',
  'app.importedOne': 'Importada 1 clave',
  'app.importedMany': 'Importadas {0} claves',
  'app.importedDupes': ' ({0} ya estaban)',
  'app.exported': 'Exportadas {0} claves.',
  'app.synced': 'Biblioteca sincronizada: {0} juegos.',
  'storage.checking': 'Comprobando…',
  'storage.section.storage': 'Almacenamiento',
  'storage.section.backups': 'Copias de seguridad',
  'storage.data.keys': 'Claves guardadas',
  'storage.data.size': 'Tamano del fichero',
  'storage.data.where': 'Almacenamiento',
  'storage.data.whereHint': 'Donde se estan guardando las claves ahora mismo.',
  'storage.data.unknown': 'Pendientes de revisar',
  'storage.data.unknownHint': 'Claves cuya plataforma no se pudo determinar.',
  'storage.data.location': 'Ubicacion',
  'storage.backups.none': 'Todavia no hay copias. Se crean solas antes de cada importacion o restauracion, y tambien puedes pulsar «Copiar ahora».',
  'storage.backups.desktopOnly': 'Las copias de seguridad son una funcion de la app de escritorio. Aqui no hay ninguna.',
  'storage.backups.keep': 'Se guardan las 10 copias mas recientes en la carpeta «backups» junto a la base de datos, y se crean solas antes de cada importacion o restauracion.',
  'storage.refresh': 'Actualizar',
  'storage.restoreTitle': 'Restaurar {0}',
  'storage.restoreHint': 'Se creara una copia del estado actual antes de aplicar nada, asi que esto tambien se puede deshacer.',
  'storage.merge.title': 'Solo anadir lo que falte',
  'storage.merge.text': 'Recupera las claves que no tienes. No toca las que ya existen.',
  'storage.overwrite.title': 'Anadir y actualizar estados',
  'storage.overwrite.text': 'Ademas, devuelve cada clave a como estaba en la copia. Util si has cambiado estados a mano por error.',
  'storage.restoreSafe': 'Ninguna opcion borra claves: restaurar nunca reduce tu coleccion.',
  'row.delete': 'Eliminar clave',
  'app.linkFailed': 'No se ha podido conectar la cuenta.',
  'gift.hint': 'Marcar las claves seleccionadas como regaladas',
  'select.markExpired': 'Marcar como caducadas',
  'footer.giftable': '· {0} regalables',
  'footer.games': '{0} juegos en Steam',
  'footer.shortcutSearch': 'buscar',
  'footer.shortcutNew': 'nueva',
  'footer.showing': 'Mostrando {0} de {1}. Afina la busqueda para ver el resto.',
  'footer.count': '{0} de {1} claves',
  'platform.unknown': 'Sin determinar',
  'storage.portable.title': 'Modo portable',
  'storage.portable.text': 'Las claves estan en un .db al lado del programa, no en tu carpeta de usuario. Si mueves el ejecutable a otra carpeta, mueve tambien steam-keys.db y la carpeta backups, o te quedaras sin la coleccion.',
});