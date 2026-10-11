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

/**
 * La funcion que traduce una clave.
 *
 * Vive aqui y no en `useT()` porque hay codigo que necesita traducir **fuera**
 * de un componente: el reparto del dialogo de estados, por ejemplo, se calcula
 * en una funcion pura que se prueba sin montar nada. Al tiparla con este
 * alias, tanto `t()` de un componente como la que se pasa a mano encajan sin
 * haber que repetir la firma.
 */
export type Translator = (clave: TranslationKey, args?: TranslationArgs) => string;

export const EN: TranslationTable = Object.freeze({
  // ------------------------------------------------------------- generic ---
  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.close': 'Close',
  'action.confirm': 'Confirm',
  'action.add': 'Add',
  'action.clear': 'Clear',
  'action.forget': 'Forget',

  // ------------------------------------------------------- empty state ---
  'empty.title': 'No keys yet',
  'empty.hint': 'Import your TXT file or add a key by hand.',
  'empty.import': 'Import TXT',
  'empty.create': 'Add key',
  'empty.noResults': 'No results',
  'empty.noResultsHint': 'Try a different search or clear one of the filters.',
  'empty.clearFilters': 'Clear filters',

  // ------------------------------------------------------- first run ---
  'firstRun.title': 'There is no database yet',
  'firstRun.body': 'None has been created. It will be created when you add or import your first key, next to the program, in {0}.',
  'firstRun.moved.title': 'You copied the program from somewhere else',
  'firstRun.moved.body': 'Your keys, your settings and your Steam account all live inside {0}. If you only copied the executable, copy that file from the original folder too and leave it next to it; otherwise you would start from scratch.',
  'firstRun.bring': 'Bring the database',
  'firstRun.create': 'Start from scratch',

  // -------------------------------------------------------------- header ---
  'app.title': 'Steam Keys',
  'app.subtitle': '{0} available of {1}',
  'search.placeholder': 'Search by game, key, recipient or note…',

  // ------------------------------------------------------------ toolbar ---
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

  // ---------------------------------------------------------- selection ---
  'select.one': '1 selected',
  'select.many': '{0} selected',
  'select.all': 'Select all',
  'select.export': 'Export as gift',
  'select.markGifted': 'Mark gifted',
  'select.tags': 'Tags',

  // ----------------------------------------------------------- tooltips ---

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

  // --------------------------------------------------------- footer ---
  'footer.count': '{0} of {1} keys',

  // -------------------------------------------------------- tags modal ---
  'tags.title': 'Tags',
  'tags.new': 'New tag',

  // ------------------------------------------------------ settings ---
  'settings.title': 'Settings',
  'settings.tab.appearance': 'Appearance',
  'settings.tab.account': 'Steam account',
  'settings.theme': 'Theme',
  'settings.language': 'Language',
  'settings.apiKey': 'Steam Web API key',
  'settings.apiKey.hint':
    'Free, and stored only on this computer: it is never sent anywhere.',
  'settings.apiKey.link': 'Get a new key',
  'settings.apiKey.placeholder': 'Paste your key here',
  'settings.apiKey.show': 'Show key',
  'settings.apiKey.hide': 'Hide key',
  'settings.steam.link': 'Connect',
  'settings.steam.linked': 'Connected as {0}',
  'settings.steam.notLinked': 'Not connected',
  'settings.steam.syncedAt': 'Last synced {0}',
  'settings.steam.visibility':
    'Your Steam profile must be public for the app to see your library.',

  // --------------------------------------------------------- library ---
  'view.label': 'Collection',
  'view.keys': 'Keys',
  'view.games': 'My games',
  'library.empty': 'Connect your Steam account to see your library.',
  'library.name': 'Game',
  'library.playtimeShort': 'Played',
  'library.playtime': '{0} h played',
  'library.notPlayed': 'Never played',
  'library.owned': 'Owned',

  // ------------------------------------------------------- owned games ---
  'owned.owned': 'Owned',
  'owned.dlc': 'DLC',
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
  'select.exportHint':
    'Save the selected keys to a TXT file to gift them',
  'select.giftedHint':
    'Mark the selected keys as already gifted and say who to',
  'select.tagsHint':
    'Change the tags of the selected keys',
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
  'editor.title':
    'Game',
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
  'gift.title':
    'Mark as gifted',
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
  'row.select': 'Select {0}',
  'row.onSteam': 'On Steam',
  'data.close':
    'Close data',
  'data.title': 'Data and backups',
  'data.subtitle': 'Where your collection lives and how to get it back if something goes wrong.',
  'storage.created': 'Backup created: {0}',
  'storage.restored': 'Restored {0} keys: {1} added, {2} updated, {3} unchanged.',
  'file.pick.title': 'Choose the TXT file with your keys',
  'file.save.title': 'Save the list of keys',
  'file.filter.text': 'Text',
  'bulk.blocked.notOwned': 'You do not have it any more: giving it away again is not possible',
  'bulk.blocked.needRecipient': 'You still have to say who you gave it to',
  'gift.count.one': '1 key selected',
  'gift.count.many': '{0} keys selected',
  'gift.action': 'Mark as gifted',
  'gift.needRecipient': 'Type who you are giving it to first',
  'import.none': 'Nothing to import',
  'import.apply': 'Import {0} keys',
  'tags.count.one': '1 key will change',
  'tags.count.many': '{0} keys will change',
  'editor.needBoth': 'The game name and the key are both required.',
  'editor.saveError': 'Could not save.',
  'editor.editTitle': 'Edit key',
  'editor.newTitle': 'New key',
  'editor.editHint': 'Changes are saved to your local database.',
  'editor.newHint': 'Add a key to your collection.',
  'editor.save': 'Save changes',
  'editor.add': 'Add key',
  'storage.error.read': 'Could not read the state.',
  'storage.error.backup': 'Could not create the copy.',
  'storage.deleted': 'Copy deleted.',
  'storage.error.delete': 'Could not delete it.',
  'storage.error.restore': 'Could not restore it.',
  'storage.unexpected': 'The database is not behaving as expected.',
  'storage.corrupted': 'SQLite has reported an integrity problem.',
  'storage.corruptedTitle': 'The database is damaged',
  'storage.backupNow': 'Create a copy now',
  'storage.desktopOnly': 'Available in the desktop app only',
  'storage.copyNow': 'Copy now',
  'storage.restoring': 'Restoring…',
  'storage.restore': 'Restore',
  'storage.mode.desktop': 'Desktop app',
  'storage.mode.devBridge': 'Development (separate database)',
  'storage.mode.memory': 'Preview in the browser',
  'storage.notice.desktop': 'Your keys are on your disk, in a SQLite database, with automatic backups.',
  'storage.notice.devBridge': 'You are looking at a development database, separate from the one the app uses, in .dev/. Whatever you edit here does not touch your real keys; this is where the interface gets tested.',
  'storage.notice.memory': 'Preview in the browser: the data lives in localStorage and is lost if you clear the browser data.',
  'app.loadFailed': 'Could not read the collection.',
  'app.nothingSelected': 'Nothing selected.',
  'app.saveFailed': 'Could not save.',
  'app.needApiKey': 'The API key is needed first.',
  'app.keyForgotten': 'Key removed.',
  'app.readFileFailed': 'Could not read the file.',
  'app.importFailed': 'The import failed.',
  'app.exportFailed': 'The export failed.',
  'app.syncFailed': 'The sync failed.',
  'app.markFailed': 'Could not mark them.',
  'app.tagsFailed': 'Could not change the tags.',
  'app.fileFailed': 'Could not save the file.',
  'app.saved': 'Key updated.',
  'app.created': 'Key added.',
  'app.deleted': 'Key deleted.',
  'app.noFile': 'No file was saved.',
  'app.needRecipient': 'You have to say who you gave it to.',
  'app.exportOne': '1 key saved in {0}',
  'app.exportMany': '{0} keys saved in {1}',
  'app.giftedOne': '1 key gifted to {0}.',
  'app.giftedMany': '{0} keys gifted to {1}.',
  'app.expiredOne': '1 key marked as expired.',
  'app.expiredMany': '{0} keys marked as expired.',
  'app.tagsOne': 'Tag updated on 1 key.',
  'app.tagsMany': 'Tags updated on {0} keys.',
  'app.libraryOne': '1 game in your library.',
  'app.libraryMany': '{0} games in your library.',
  'app.importedOne': '1 key imported',
  'app.importedMany': '{0} keys imported',
  'app.importedDupes': ' ({0} already there)',
  'app.exported': '{0} keys exported.',
  'app.synced': 'Library synced: {0} games.',
  'storage.checking': 'Checking…',
  'storage.section.storage': 'Storage',
  'storage.section.backups': 'Backups',
  'storage.data.keys': 'Keys stored',
  'storage.data.size': 'File size',
  'storage.data.where': 'Storage',
  'storage.data.whereHint': 'Where your keys are being stored right now.',
  'storage.data.unknown': 'To review',
  'storage.data.unknownHint': 'Keys whose platform could not be determined.',
  'storage.data.location': 'Location',
  'storage.backups.none': 'No backups yet. They are made automatically before each import or restore, and you can also press «Copy now».',
  'storage.backups.desktopOnly': 'Backups are a desktop app feature. There are none here.',
  'storage.backups.keys': '{0} keys',
  'storage.backups.keep': 'The 10 most recent copies are kept in the «backups» folder next to the database, and they are made automatically before each import or restore.',
  'storage.refresh': 'Refresh',
  'storage.restoreTitle': 'Restore {0}',
  'storage.restoreHint': 'A copy of the current state is made before anything is applied, so this can be undone too.',
  'storage.merge.title': 'Only add what is missing',
  'storage.merge.text': 'Recovers the keys you do not have. Leaves the existing ones alone.',
  'storage.overwrite.title': 'Add and update statuses',
  'storage.overwrite.text': 'It also puts every key back the way it was in the copy. Useful if you changed statuses by mistake.',
  'storage.restoreSafe': 'Neither option deletes keys: restoring never shrinks your collection.',
  'row.delete': 'Delete key',
  'app.linkFailed': 'Could not link the account.',
  'gift.hint': 'Mark the selected keys as already gifted',
  'select.markExpired': 'Mark as expired',
  'footer.giftable': '· {0} giftable',
  'footer.games': '{0} games on Steam',
  'footer.shortcutSearch': 'search',
  'footer.shortcutNew': 'new',
  'footer.showing': 'Showing {0} of {1}. Narrow the search to see the rest.',
  'platform.unknown': 'Undetermined',
  'storage.portable.title': 'Portable mode',
  'storage.portable.text': 'Your keys and your backups live in a single file, steam-keys.db, next to the program and not in your user folder. If you move the executable elsewhere, move that file with it, or you will be left without your collection.',
});

/**
 * Los demas idiomas viven en su propio fichero.
 *
 * Cada uno esta **completo**, y eso es una condicion, no una aspiracion: `t()`
 * cae en la clave cuando falta algo, asi que un diccionario a medio hacer se ve
 * en pantalla como un idioma que no hace nada, que es peor que no ofrecerlo.
 * El selector deja de ser una lista de opciones y pasa a ser una trampa.
 *
 * Por eso `APP_LOCALE_VALUES` solo lista los que estan completos, y por eso el
 * test de cobertura obliga a que cada idioma tenga todas las claves de `ES`.
 */
import { DE } from './i18n-de.constants';
import { FR } from './i18n-fr.constants';
import { PT } from './i18n-pt.constants';

/** Tabla de cada idioma, incluido el de origen. */
export const TRANSLATIONS: Readonly<Record<AppLocale, TranslationTable>> =
  Object.freeze({
    es: ES,
    en: EN,
    fr: FR,
    pt: PT,
    de: DE,
  });
