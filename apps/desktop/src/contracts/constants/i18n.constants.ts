import type { AppLocale } from '../enums/app-locale.enum';
import { ES } from './i18n-es.constants';

/**
 * Mensajes de la interfaz, indexados por clave.
 *
 * La clave es el texto en español, sin tildes y en snake_case. Se escribe asi
 * porque el español es el idioma de origen: cuando falte una traduccion, `t()`
 * devuelve la clave y se lee en español, que siempre funciona, en vez de
 * devolver una cadena vacia.
 */
export type TranslationKey = string;

/** Un idioma completo o parcial. */
export type TranslationTable = Readonly<Record<TranslationKey, string>>;

/**
 * Como se inserta un valor dentro de un mensaje.
 *
 * `{0}`, `{1}`… se sustituyen por los argumentos en orden. Se evita el
 * interpolador con nombres (`{nombre}`) porque obliga a traducir tambien las
 * variables, y un traductor no deberia tener que saber como se llama nuestro
 * objeto `giftSelection`.
 */
export type TranslationArgs = readonly (string | number)[];

export const EN: TranslationTable = Object.freeze({
  // ------------------------------------------------------------- generic ---
  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.close': 'Close',
  'action.confirm': 'Confirm',
  'action.add': 'Add',
  'action.clear': 'Clear',
  'action.forget': 'Forget',

  // -------------------------------------------------------------- header ---
  'app.title': 'Steam Keys',
  'app.subtitle': '{0} available of {1}',
  'search.placeholder': 'Search by game, key, recipient or note…',
  'search.shortcut': '/',

  // ------------------------------------------------------------ toolbar ---
  'toolbar.filters': 'Filters',
  'toolbar.sort': 'Sort by',
  'toolbar.export': 'Export',
  'toolbar.import': 'Import',
  'toolbar.data': 'Data',
  'toolbar.settings': 'Settings',
  'toolbar.add': 'Add',
  'sort.recent': 'Most recent',
  'sort.alpha': 'A - Z',
  'sort.status': 'By status',
  'sort.platform': 'By platform',
  'filter.platform': 'Platform',
  'filter.status': 'Status',
  'filter.onlyGiftable': 'Available only',
  'filter.onlyAddOns': 'DLC only',

  // -------------------------------------------------------------- scope ---
  'filter.scope.label': 'Status',
  'filter.scope.all': 'All',
  'filter.scope.available': 'Available only',

  // --------------------------------------------------------------- kind ---
  'filter.kind.label': 'Type',
  'filter.kind.all': 'All',
  'filter.kind.games': 'Games only',
  'filter.kind.dlc': 'DLC only',

  'filter.status.locked':
    'With “Available only” you are already seeing the keys that are neither gifted nor redeemed, so filtering by status at the same time does nothing.',
  'filter.reset': 'Clear search and filters',
  'filter.platform.hint': 'Filters by the store the key is redeemed on',
  'filter.status.hint': 'Filters by what each key has been through',

  // ---------------------------------------------------------- selection ---
  'select.one': '1 selected',
  'select.many': '{0} selected',
  'select.all': 'Select all',
  'select.none': 'Clear',
  'select.availableOnly': 'Available only',
  'select.export': 'Export as gift',
  'select.markGifted': 'Mark gifted',
  'select.markExpired': 'Mark expired',
  'select.tags': 'Tags',

  // ----------------------------------------------------------- tooltips ---
  'why.export': 'Only available keys can be gifted. Turn on “Available only” to exclude the rest.',
  'why.gifted': 'A gifted key cannot be given away again. Turn on “Available only” to exclude the rest.',
  'why.expired': 'Select at least one key that is not already gifted or redeemed.',
  'why.tags': 'Select at least one key first.',
  'why.noSelection': 'Nothing selected.',

  // ---------------------------------------------------------- status ---
  'status.available': 'Available',
  'status.gifted': 'Gifted',
  'status.redeemed': 'Redeemed',
  'status.expired': 'Expired',
  'status.unknown': 'Needs review',
  'status.hint.available': 'Mine, still giftable.',
  'status.hint.gifted': 'Already given away.',
  'status.hint.redeemed': 'Redeemed by me.',
  'status.hint.expired': 'The activation deadline has passed.',
  'status.hint.unknown': 'Not sure when it expires.',

  // -------------------------------------------------------- empty state ---
  'empty.search.title': 'No results',
  'empty.search.body': 'Try a different search or remove a filter.',
  'empty.search.action': 'Clear filters',
  'empty.none.title': 'No keys yet',
  'empty.none.body': 'Import your TXT or add a key by hand.',
  'empty.none.import': 'Import TXT',
  'empty.none.add': 'Add a key',

  // --------------------------------------------------------- footer ---
  'footer.count': '{0} of {1} keys',
  'footer.giftable': '· {0} giftable',

  // -------------------------------------------------------- tags modal ---
  'tags.title': 'Tags',
  'tags.subtitle': '{0} key(s) will be changed',
  'tags.new': 'New tag',
  'tags.add': 'Add',
  'tags.empty': 'No tags in the collection yet.',
  'tags.apply': 'Apply to selected',
  'tags.hint': 'Keys that do not have a tag get it. Keys that have it keep it.',

  // ------------------------------------------------------ settings ---
  'settings.title': 'Settings',
  'settings.tab.appearance': 'Appearance',
  'settings.tab.account': 'Steam account',
  'settings.tab.data': 'Data',
  'settings.theme': 'Theme',
  'settings.language': 'Language',
  'settings.apiKey': 'Steam Web API key',
  'settings.apiKey.hint':
    'Free, and stored only on this computer: it is never sent anywhere.',
  'settings.apiKey.link': 'Get a new key',
  'settings.apiKey.placeholder': 'Paste your key here',
  'settings.steamId': 'Steam ID',
  'settings.steam.link': 'Connect',
  'settings.steam.unlink': 'Disconnect',
  'settings.steam.linked': 'Connected as {0}',
  'settings.steam.notLinked': 'Not connected',
  'settings.steam.syncedAt': 'Last synced {0}',
  'settings.steam.never': 'never',
  'settings.steam.visibility':
    'Your Steam profile must be public for the app to see your library.',
  'settings.saved': 'Settings saved.',
  'settings.keySaved': 'Key saved.',
  'settings.keyForgotten': 'Key removed.',
  'settings.steam.error.missingKey': 'Enter the API key first.',
  'settings.steam.error.badId': 'The Steam ID must be 17 digits starting with 7656119.',
  'settings.steam.error.private':
    'The library came back empty. Check that your profile is public.',
  'settings.steam.error.http': 'Steam did not answer. Try again in a moment.',
  'settings.steam.error.link': 'Could not connect the account.',

  // --------------------------------------------------------- library ---
  'view.label': 'Collection',
  'view.keys': 'Keys',
  'view.games': 'My games',
  'library.empty': 'Connect your Steam account to see your library.',
  'library.name': 'Game',
  'library.playtimeShort': 'Played',
  'library.playtime': '{0} h played',
  'library.notPlayed': 'Never played',
  'library.installed': 'Installed',
  'library.owned': 'Owned',

  // ------------------------------------------------------- owned games ---
  'owned.why': 'You already own this game',
  'owned.owned': 'Owned',
  'owned.installed': 'Installed',
  'owned.played': '{0} h played',
  'owned.never': 'Never played',
  'owned.dlc': 'DLC',
  'owned.verified': 'Verified',
  'owned.unverified': 'Not matched yet',

  // ------------------------------------------------------------ toasts ---
  'toast.saved': 'Key saved.',
  'toast.created': 'Key added.',
  'toast.deleted': 'Key removed.',
  'toast.exported': 'Exported {0} keys.',
  'toast.imported': 'Imported {0} keys.',
  'toast.gifted': '{0} key(s) gifted to {1}.',
  'toast.expired': '{count} key(s) marked as expired.',
  'toast.tagsApplied': 'Tags updated on {0} key(s).',
  'toast.noFile': 'No file was saved.',
  'toast.recipient': 'You have to say who it was gifted to.',
  'toast.nothingSelected': 'Nothing selected.',

  // ------------------------------------------------------ review score ---
  'review.label': 'Reviews',
  'review.recent': 'Last 30 days',
  'review.allTime': 'All time',
  'review.veryPositive': 'Very Positive',
  'review.positive': 'Positive',
  'review.mixed': 'Mixed',
  'review.negative': 'Negative',
  'review.veryNegative': 'Very Negative',
  'review.unknown': 'No reviews',
  'review.metacritic': 'Metacritic {0}',
  'review.noData': 'No data yet',


  'action.edit':
    'Edit',
  'action.delete':
    'Delete',
  'action.copy':
    'Copy',
  'action.back':
    'Back',
  'select.clear':
    'Clear',
  'select.giftableOne':
    '{0} can be gifted',
  'select.giftableMany':
    '{0} can be gifted',
  'select.giftableRest':
    '· {0} cannot',
  'select.giftableNone':
    'None of them can be gifted as they are',
  'select.untoggleAll':
    'Clear all',
  'select.clearAll':
    'Clear the selection across the list',
  'select.allHere':
    'Select everything currently in the list',
  'select.groupGift':
    'Gift',
  'select.groupState':
    'Change status',
  'select.groupOrganize':
    'Organise',
  'select.markAllGifted':
    'Mark as gifted',
  'select.exportHint':
    'Save the selected keys to a TXT file to gift them',
  'select.giftedHint':
    'Mark the selected keys as already gifted and say who to',
  'select.expiredHint':
    'Mark the selected keys as expired',
  'select.tagsHint':
    'Change the tags of the selected keys',
  'select.blockedCount':
    'Turn on "Only available" to leave those {0} out',
  'select.blockedOne':
    'Turn on "Only available" to leave that one out',
  'select.blockedNone':
    'Turn on "Only available" to act on the selection',
  'select.blockedExpired':
    'They were already all expired',
  'bulk.title':
    'Change status',
  'bulk.subtitle':
    'It will be applied to {0} selected keys',
  'bulk.hint':
    'Only the keys that allow that status will change. The rest stay as they are.',
  'bulk.apply':
    'Change status',
  'bulk.pending':
    '{0} keys become {1}',
  'bulk.unchanged':
    '{0} were already {1}',
  'bulk.skipped':
    '{0} cannot become {1}: {2}',
  'bulk.done':
    'Status changed on {0} keys.',
  'bulk.none':
    'None of the selected keys can move to that status.',
  'settings.steamId.hint':
    'Either one works. The number is 17 digits and starts with 7656119. The name is whatever comes right after /id/ in your profile URL: if your profile is steamcommunity.com/id/my-game, your name is my-game.',
  'settings.steamId.placeholder':
    '76561198023249625 or your name',
  'settings.steamId.label':
    'Steam ID or profile name',
  'settings.steam.linkedOk':
    'Connected and saved',
  'settings.steam.games':
    '{0} games',
  'settings.steam.forget':
    'Forget key',
  'settings.steam.forgetHint':
    'Delete the API key from the database',
  'settings.steam.needKey':
    'The API key is required',
  'settings.steam.needId':
    'Enter your Steam ID or your profile name',
  'settings.theme.hint':
    'It shows right away. "System" follows your operating system and changes on its own.',
  'settings.language.hint':
    'Changes the language of the menus and buttons.',
  'tags.addHint':
    'Add the tag to the selection',
  'tags.applyHint':
    'Apply these tags to all the selected keys',
  'editor.new':
    'Add key',
  'editor.edit':
    'Edit key',
  'editor.title':
    'Game',
  'editor.titleHint':
    'The game name as it appears on Steam.',
  'editor.titlePlaceholder':
    'Celeste, Hollow Knight, Half-Life 2…',
  'editor.key':
    'Key',
  'editor.keyHint':
    'It is saved exactly as you type it.',
  'editor.keyPlaceholder':
    'XXXXX-XXXXX-XXXXX',
  'editor.platform':
    'Platform',
  'editor.status':
    'Status',
  'editor.recipient':
    'Gifted to',
  'editor.recipientHint':
    'Only if you already gave it away.',
  'editor.recipientPlaceholder':
    'Name of whoever gets it',
  'editor.parent':
    'Parent game',
  'editor.parentHint':
    'Fill it in if it is a DLC.',
  'editor.parentPlaceholder':
    'Half-Life 2',
  'editor.note':
    'Note',
  'editor.noteHint':
    'Source promotion, date, instructions…',
  'editor.notePlaceholder':
    'June 2018 Humble Monthly',
  'editor.tags':
    'Tags',
  'editor.tagsHint':
    'Separated by commas.',
  'editor.tagsPlaceholder':
    'humble, dlc, promo',
  'editor.needKey':
    'The key cannot be empty.',
  'editor.needTitle':
    'The game cannot be empty.',
  'gift.title':
    'Mark as gifted',
  'gift.hint':
    'Who each key was given to. Without a name the status is not changed.',
  'gift.placeholder':
    'Name of whoever gets it',
  'import.title':
    'To import',
  'import.titleHint':
    'New keys that get added to the database',
  'import.duplicates':
    'You already had',
  'import.duplicatesHint':
    'Duplicated inside the TXT itself or already in the database',
  'import.available':
    'Available',
  'import.availableHint':
    'Marked as giftable',
  'import.gifted':
    'Already gifted',
  'import.giftedHint':
    'The TXT marked them with a leading dash',
  'import.confirm':
    'Import',
  'import.cancel':
    'Cancel',
  'row.dlc':
    'Add-on content from another game',
  'row.owned':
    'You already own this game on your Steam account',
  'row.siblings':
    '{0} keys of this game in the collection',
  'row.showKey':
    'Show key',
  'row.hideKey':
    'Hide key',
  'row.copyKey':
    'Copy key',
  'row.status':
    'Status: {0}. {1} Click to change it.',
  'row.forRecipient':
    'to {0}',
  'data.title':
    'Data',
  'data.subtitle':
    'Backup, restore and delete',
  'data.export':
    'Export backup',
  'data.import':
    'Restore backup',
  'data.delete':
    'Delete everything',
  'data.deleteConfirm':
    'This cannot be undone. Are you sure?',
  'data.close':
    'Close data',
  'data.size':
    'Size',
  'data.path':
    'Path',
  'data.copy':
    'Copy path',
  'data.copied':
    'Path copied.',
  'footer.games':
    '{0} games on Steam',
  'footer.shortcutSearch':
    'search',
  'footer.shortcutNew':
    'new',
  'footer.showing':
    'Showing {0} of {1}. Narrow the search to see the rest.',
});

/**
 * Traducciones que faltan en un idioma.
 *
 * No es un error: `t()` cae en la clave (español) cuando aqui no hay nada. Se
 * deja el diccionario explicito y vacio para que quede a la vista que queda por
 * hacer, en vez de dejar una constante ausente que parece un olvido.
 */
export const FR: TranslationTable = Object.freeze({});

export const PT: TranslationTable = Object.freeze({});

export const CA: TranslationTable = Object.freeze({});

/** Tabla de cada idioma, incluido el de origen. */
export const TRANSLATIONS: Readonly<Record<AppLocale, TranslationTable>> =
  Object.freeze({
    es: ES,
    en: EN,
    fr: FR,
    pt: PT,
    ca: CA,
  });
