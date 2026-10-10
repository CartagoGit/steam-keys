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

  // -------------------------------------------------------------- header ---
  'app.title': 'Steam Keys',
  'app.subtitle': '{available} disponibles de {total}',
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

  // ---------------------------------------------------------- selection ---
  'select.one': '1 seleccionada',
  'select.many': '{count} seleccionadas',
  'select.all': 'Seleccionar todo',
  'select.none': 'Deseleccionar',
  'select.availableOnly': 'Solo disponibles',
  'select.export': 'Exportar para regalar',
  'select.markGifted': 'Marcar regaladas',
  'select.markExpired': 'Marcar caducadas',
  'select.tags': 'Etiquetas',

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

  // -------------------------------------------------------- empty state ---
  'empty.search.title': 'Ningun resultado',
  'empty.search.body': 'Prueba a cambiar la busqueda o quitar algun filtro.',
  'empty.search.action': 'Limpiar filtros',
  'empty.none.title': 'Todavia no hay claves',
  'empty.none.body': 'Importa tu TXT o anade una clave a mano.',
  'empty.none.import': 'Importar TXT',
  'empty.none.add': 'Anadir clave',

  // ------------------------------------------------------------- footer ---
  'footer.count': '{visible} de {total} claves',
  'footer.giftable': '· {count} regalables',

  // --------------------------------------------------------- tags modal ---
  'tags.title': 'Etiquetas',
  'tags.subtitle': 'Se cambiaran {count} claves',
  'tags.new': 'Etiqueta nueva',
  'tags.add': 'Anadir',
  'tags.empty': 'Todavia no hay etiquetas en la coleccion.',
  'tags.apply': 'Aplicar a la seleccion',
  'tags.hint':
    'Las claves que no tengan la etiqueta la reciben. Las que ya la tienen la conservan.',

  // ------------------------------------------------------------ settings ---
  'settings.title': 'Ajustes',
  'settings.tab.appearance': 'Apariencia',
  'settings.tab.account': 'Cuenta de Steam',
  'settings.tab.data': 'Datos',
  'settings.theme': 'Tema',
  'settings.language': 'Idioma',
  'settings.apiKey': 'Clave de la API de Steam',
  'settings.apiKey.hint':
    'Gratuita, en steamcommunity.com/dev/apikey. Se guarda solo en este ordenador.',
  'settings.apiKey.placeholder': 'Pega aqui tu clave',
  'settings.steamId': 'ID de Steam',
  'settings.steamId.hint': 'Tu numero de 17 cifras, empieza por 7656119.',
  'settings.steamId.placeholder': '7656119…',
  'settings.steam.link': 'Conectar',
  'settings.steam.unlink': 'Desconectar',
  'settings.steam.linked': 'Conectada como {id}',
  'settings.steam.notLinked': 'Sin conectar',
  'settings.steam.syncedAt': 'Ultima sincronizacion {when}',
  'settings.steam.never': 'nunca',
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
  'view.keys': 'Claves',
  'view.games': 'Mis juegos',
  'library.empty': 'Conecta tu cuenta de Steam para ver tu biblioteca.',
  'library.playtime': '{hours} h jugados',
  'library.notPlayed': 'Sin jugar',
  'library.installed': 'Instalado',
  'library.owned': 'En propiedad',

  // -------------------------------------------------------- owned games ---
  'owned.why': 'Ya tienes este juego',
  'owned.owned': 'En propiedad',
  'owned.installed': 'Instalado',
  'owned.played': '{hours} h jugados',
  'owned.never': 'Sin jugar',
  'owned.dlc': 'DLC',
  'owned.verified': 'Verificado',
  'owned.unverified': 'Sin emparejar',

  // -------------------------------------------------------------- toasts ---
  'toast.saved': 'Key actualizada.',
  'toast.created': 'Key anadida.',
  'toast.deleted': 'Key eliminada.',
  'toast.exported': 'Exportadas {count} claves.',
  'toast.imported': 'Importadas {count} claves.',
  'toast.gifted': '{count} claves regaladas a {who}.',
  'toast.expired': '{count} claves marcadas como caducadas.',
  'toast.tagsApplied': 'Etiquetas actualizadas en {count} claves.',
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
  'review.metacritic': 'Metacritic {score}',
  'review.noData': 'Todavia sin datos',
});