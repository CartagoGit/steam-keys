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
  'search.shortcut': '/',

  // ------------------------------------------------------------ toolbar ---
  'toolbar.filters': 'Filtros',
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
  'filter.onlyGiftable': 'Solo disponibles',
  'filter.onlyAddOns': 'Solo DLC',

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
  'filter.platform.hint': 'Filtra por la tienda donde se canjea la clave',
  'filter.status.hint': 'Filtra por lo que le ha pasado a cada clave',

  // ---------------------------------------------------------- selection ---
  'select.one': '1 seleccionada',
  'select.many': '{0} seleccionadas',
  'select.all': 'Seleccionar todo',
  'select.none': 'Deseleccionar',
  'select.availableOnly': 'Solo disponibles',
  'select.export': 'Exportar para regalar',
  'select.markGifted': 'Marcar regaladas',
  'select.markExpired': 'Marcar caducadas',
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
  'select.markAllGifted': 'Marcar regaladas',
  'select.exportHint': 'Guardar las claves seleccionadas en un TXT para regalar',
  'select.giftedHint': 'Marca las seleccionadas como ya regaladas y dice a quien',
  'select.expiredHint': 'Marca las seleccionadas como caducadas',
  'select.tagsHint': 'Cambia las etiquetas de las seleccionadas',
  'select.blockedCount': 'Marca «Solo las disponibles» para dejar fuera esas {0}',
  'select.blockedOne': 'Marca «Solo las disponibles» para dejar fuera esa 1',
  'select.blockedNone': 'Marca «Solo las disponibles» para poder actuar sobre la seleccion',
  'select.blockedExpired': 'Ya estaban todas caducadas',

  // ------------------------------------------- cambiar estado de golpe ---
  'bulk.title': 'Cambiar el estado',
  'bulk.subtitle': 'Se aplicara a {0} claves seleccionadas',
  'bulk.hint':
    'Se cambia solo a las claves que permitan ese estado. Las demas se quedan como estan.',
  'bulk.apply': 'Cambiar el estado',
  'bulk.pending': '{0} claves pasan a {1}',
  'bulk.unchanged': '{0} ya estaban en {1}',
  'bulk.skipped': '{0} no pueden pasar a {1}: {2}',
  'bulk.done': 'Estado cambiado en {0} claves.',
  'bulk.none': 'Ninguna de las seleccionadas puede pasar a ese estado.',

  // ----------------------------------------------------------- tooltips ---
  'why.export':
    'Solo se pueden regalar claves disponibles. Activa «Solo disponibles» para dejar fuera el resto.',
  'why.gifted':
    'Una clave ya regalada no se puede volver a regalar. Activa «Solo disponibles» para dejar fuera el resto.',
  'why.expired':
    'Selecciona al menos una clave que no este ya regalada ni canjeada.',
  'why.tags': 'Selecciona primero alguna clave.',
  'why.noSelection': 'No hay nada seleccionado.',

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
  'tags.subtitle': 'Se cambiaran {0} claves',
  'tags.new': 'Etiqueta nueva',
  'tags.add': 'Anadir',
  'tags.empty': 'Todavia no hay etiquetas en la coleccion.',
  'tags.apply': 'Aplicar a la seleccion',
  'tags.hint':
    'Las claves que no tengan la etiqueta la reciben. Las que ya la tienen la conservan.',
  'tags.addHint': 'Anadir la etiqueta a la seleccion',
  'tags.applyHint': 'Aplicar estas etiquetas a todas las claves seleccionadas',

  // ---------------------------------------------------------- key editor ---
  'editor.new': 'Anadir clave',
  'editor.edit': 'Editar clave',
  'editor.title': 'Juego',
  'editor.titleHint': 'El nombre del juego tal como aparece en Steam.',
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
  'editor.needKey': 'La clave no puede quedar vacia.',
  'editor.needTitle': 'El juego no puede quedar vacio.',

  // --------------------------------------------------------------- gift ---
  'gift.title': 'Marcar como regaladas',
  'gift.hint': 'A quien se le ha dado cada clave. Sin nombre no se cambia el estado.',
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
  'import.confirm': 'Importar',
  'import.cancel': 'Cancelar',

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
  'settings.tab.data': 'Datos',
  'settings.theme': 'Tema',
  'settings.language': 'Idioma',
  'settings.apiKey': 'Clave de la API de Steam',
  'settings.apiKey.hint':
    'Gratuita, y se guarda solo en este ordenador: no se envia a ningun sitio.',
  'settings.apiKey.link': 'Pedir una clave nueva',
  'settings.apiKey.placeholder': 'Pega aqui tu clave',
  'settings.steamId': 'ID o nombre de perfil de Steam',
  'settings.steamId.hint':
    'Vale cualquiera de los dos. El numero son 17 cifras y empieza por 7656119. El nombre es lo que va justo detras de /id/ en la direccion de tu perfil: si tu perfil es steamcommunity.com/id/mi-juego, tu nombre es mi-juego.',
  'settings.steamId.placeholder': '76561198023249625 o tu nombre',
  'settings.steamId.label': 'ID o nombre de perfil',
  'settings.steam.link': 'Conectar',
  'settings.steam.unlink': 'Desconectar',
  'settings.steam.linked': 'Conectada como {0}',
  'settings.steam.notLinked': 'Sin conectar',
  'settings.steam.syncedAt': 'Ultima sincronizacion {0}',
  'settings.steam.never': 'nunca',
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
  'settings.saved': 'Ajustes guardados.',
  'settings.keySaved': 'Clave guardada.',
  'settings.keyForgotten': 'Clave borrada.',
  'settings.steam.error.missingKey': 'Antes hay que poner la clave de la API.',
  'settings.steam.error.badId':
    'El ID de Steam son 17 cifras empezando por 7656119.',
  'settings.steam.error.private':
    'La biblioteca vino vacia. Comprueba que tu perfil sea publico.',
  'settings.steam.error.http': 'Steam no ha contestado. Intentalo en un momento.',
  'settings.steam.error.link': 'No se ha podido conectar la cuenta.',

  // ------------------------------------------------------------- library ---
  'view.label': 'Coleccion',
  'view.keys': 'Claves',
  'view.games': 'Mis juegos',
  'library.empty': 'Conecta tu cuenta de Steam para ver tu biblioteca.',
  'library.name': 'Juego',
  'library.playtimeShort': 'Jugado',
  'library.playtime': '{0} h jugados',
  'library.notPlayed': 'Sin jugar',
  'library.installed': 'Instalado',
  'library.owned': 'En propiedad',

  // -------------------------------------------------------- owned games ---
  'owned.why': 'Ya tienes este juego',
  'owned.owned': 'En propiedad',
  'owned.installed': 'Instalado',
  'owned.played': '{0} h jugados',
  'owned.never': 'Sin jugar',
  'owned.dlc': 'DLC',
  'owned.verified': 'Verificado',
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
  'review.label': 'Resenas',
  'review.recent': 'Ultimos 30 dias',
  'review.allTime': 'Historico',
  'review.veryPositive': 'Muy positivas',
  'review.positive': 'Positivas',
  'review.mixed': 'Mixtas',
  'review.negative': 'Negativas',
  'review.veryNegative': 'Muy negativas',
  'review.unknown': 'Sin resenas',
  'review.metacritic': 'Metacritic {0}',
  'review.noData': 'Todavia sin datos',

  // -------------------------------------------------------------- datos ---
  'data.title': 'Datos',
  'data.subtitle': 'Copia de seguridad, restauracion y borrado',
  'data.export': 'Exportar copia',
  'data.import': 'Restaurar copia',
  'data.delete': 'Borrar todo',
  'data.deleteConfirm': 'Esto no se puede deshacer. ¿Seguro?',
  'data.close': 'Cerrar datos',
  'data.size': 'Tamano',
  'data.path': 'Ruta',
  'data.copy': 'Copiar ruta',
  'data.copied': 'Ruta copiada.',

  // ------------------------------------------------------ estado vacio ---
  'empty.search.title': 'Ningun resultado',
  'empty.search.body': 'Prueba a cambiar la busqueda o quitar algun filtro.',
  'empty.search.action': 'Limpiar filtros',
  'empty.none.title': 'Todavia no hay claves',
  'empty.none.body': 'Importa tu TXT o anade una clave a mano.',
  'empty.none.import': 'Importar TXT',
  'empty.none.add': 'Anadir clave',

  // --------------------------------------------------------------- pie ---
  'footer.count': '{0} de {1} claves',
  'footer.giftable': '· {0} regalables',
  'footer.games': '{0} juegos en Steam',
  'footer.shortcutSearch': 'buscar',
  'footer.shortcutNew': 'nueva',
  'footer.showing': 'Mostrando {0} de {1}. Afina la busqueda para ver el resto.',
});