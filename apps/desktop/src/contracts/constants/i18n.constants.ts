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
  'app.subtitle': '{available} available of {total}',
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

  // ---------------------------------------------------------- selection ---
  'select.one': '1 selected',
  'select.many': '{count} selected',
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
  'footer.count': '{visible} of {total} keys',
  'footer.giftable': '· {count} giftable',

  // -------------------------------------------------------- tags modal ---
  'tags.title': 'Tags',
  'tags.subtitle': '{count} key(s) will be changed',
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
    'Free, from steamcommunity.com/dev/apikey. Stored only on this computer.',
  'settings.apiKey.placeholder': 'Paste your key here',
  'settings.steamId': 'Steam ID',
  'settings.steamId.hint': 'Your 17-digit number, starting with 7656119.',
  'settings.steamId.placeholder': '7656119…',
  'settings.steam.link': 'Connect',
  'settings.steam.unlink': 'Disconnect',
  'settings.steam.linked': 'Connected as {id}',
  'settings.steam.notLinked': 'Not connected',
  'settings.steam.syncedAt': 'Last synced {when}',
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
  'view.keys': 'Keys',
  'view.games': 'My games',
  'library.empty': 'Connect your Steam account to see your library.',
  'library.playtime': '{hours} h played',
  'library.notPlayed': 'Never played',
  'library.installed': 'Installed',
  'library.owned': 'Owned',

  // ------------------------------------------------------- owned games ---
  'owned.why': 'You already own this game',
  'owned.owned': 'Owned',
  'owned.installed': 'Installed',
  'owned.played': '{hours} h played',
  'owned.never': 'Never played',
  'owned.dlc': 'DLC',
  'owned.verified': 'Verified',
  'owned.unverified': 'Not matched yet',

  // ------------------------------------------------------------ toasts ---
  'toast.saved': 'Key saved.',
  'toast.created': 'Key added.',
  'toast.deleted': 'Key removed.',
  'toast.exported': 'Exported {count} keys.',
  'toast.imported': 'Imported {count} keys.',
  'toast.gifted': '{count} key(s) gifted to {who}.',
  'toast.expired': '{count} key(s) marked as expired.',
  'toast.tagsApplied': 'Tags updated on {count} key(s).',
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
  'review.metacritic': 'Metacritic {score}',
  'review.noData': 'No data yet',
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