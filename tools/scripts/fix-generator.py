"""Reconstruye las tablas fr/pt/de de `build-i18n.py` desde una sola fuente.

Se ejecuta a mano cuando se anaden claves nuevas y hay que rellenar las
traducciones generadas:

    python3 tools/scripts/fix-generator.py

No forma parte del arranque: los `.ts` que genera `build-i18n.py` estan
versionados y la app no debe depender de Python para arrancar.

Por que existe y por que reconstruye en vez de anadir: parchear la tabla linea
a linea se equivoca en cuanto hay mas de una, porque el valor que se escribe
sale de una posicion y las posiciones se confunden entre idiomas —una clave
francesa con texto castellano pasa por el generador sin que nada se queje—.
Aqui las tres tablas se rehacen enteras desde una lista, cada idioma con su
columna, y se comprueba despues que cada clave sale exactamente tres veces.
"""

import ast
import pathlib

GENERADOR = pathlib.Path(__file__).resolve().parent / 'build-i18n.py'

# clave, es, en, fr, pt, de
FILAS = [
    ('footer.paraVarias', 'para {0} personas', 'for {0} people', 'pour {0} personnes', 'para {0} pessoas', 'fuer {0} Personen'),
    ('footer.paraUna', 'para 1 persona', 'for 1 person', 'pour 1 personne', 'para 1 pessoa', 'fuer 1 Person'),
    ('footer.repetidaMany', '{0} repetidas', '{0} duplicates', '{0} en double', '{0} repetidas', '{0} mehrfach'),
    ('footer.repetidaOne', '{0} repetida', '{0} duplicate', '{0} en double', '{0} repetida', '{0} mehrfach'),
    ('footer.tituloMany', '{0} juegos', '{0} games', '{0} jeux', '{0} jogos', '{0} Spiele'),
    ('footer.tituloOne', '{0} juego', '{0} game', '{0} jeu', '{0} jogo', '{0} Spiel'),
    ('footer.verTodo', 'Ver estas claves', 'Show these keys', 'Voir ces cles', 'Ver estas chaves', 'Diese Schlüssel zeigen'),
    ('footer.available', '{0} disponibles', ' · {0} available', ' · {0} disponibles', ' · {0} disponiveis', ' · {0} verfugbar'),
    ('footer.gifted', '{0} regaladas', ' · {0} gifted', ' · {0} offertes', ' · {0} oferecidas', ' · {0} verschenkt'),
    ('footer.redeemed', '{0} canjeadas', ' · {0} redeemed', ' · {0} activees', ' · {0} ativadas', ' · {0} eingeloest'),
    ('footer.expired', '{0} caducadas', ' · {0} expired', ' · {0} perimees', ' · {0} expiradas', ' · {0} abgelaufen'),
    ('footer.addOns', '{0} DLC', ' · {0} DLC', ' · {0} DLC', ' · {0} DLC', ' · {0} DLC'),
    ('loading.more', '+{0}', '+{0} autres',
     '+{0} autres', 'e mais {0}', 'und {0} weitere'),
    ('loading.cancel', 'Cancelar', 'Cancel', 'Annuler', 'Cancelar', 'Abbrechen'),
    ('loading.cancelNoAbort', 'Dejar de esperar', 'Stop waiting', 'Arreter l attente',
     'Parar de esperar', 'Warten abbrechen'),
    ('loading.saving', 'Guardando', 'Saving', 'Enregistrement', 'A gravar',
     'Wird gespeichert'),
    ('loading.deleting', 'Eliminando', 'Deleting', 'Suppression', 'A apagar',
     'Wird geloescht'),
    ('loading.importing', 'Importando', 'Importing', 'Importation', 'A importar',
     'Wird importiert'),
    ('loading.exporting', 'Exportando', 'Exporting', 'Exportation', 'A exportar',
     'Wird exportiert'),
    ('loading.syncing', 'Sincronizando con Steam', 'Syncing with Steam',
     'Synchronisation avec Steam', 'Sincronizando com a Steam',
     'Synchronisierung mit Steam'),
    ('loading.gifting', 'Marcando como regaladas', 'Marking as gifted',
     'Marquage comme offerts', 'Marcando como oferecidas', 'Wird als verschenkt markiert'),
    ('loading.expiring', 'Marcando como caducadas', 'Marking as expired',
     'Marquage comme expires', 'A marcar como caducadas', 'Wird als abgelaufen markiert'),
    ('loading.status', 'Cambiando el estado', 'Changing the status',
     'Changement du statut', 'A alterar o estado', 'Status wird geaendert'),
    ('loading.tags', 'Guardando las etiquetas', 'Saving the tags',
     'Enregistrement des etiquettes', 'Guardando as etiquetas', 'Tags werden gespeichert'),

    ('shortcuts.title', 'Atajos de teclado', 'Keyboard shortcuts', 'Raccourcis clavier',
     'Atalhos de teclado', 'Tastenkurzel'),
    ('shortcuts.groupGeneral', 'General', 'Anywhere', 'Partout',
     'Em qualquer sitio', 'Ueberall'),
    ('shortcuts.groupSelection', 'Seleccion', 'Selection', 'Selection', 'Selecao',
     'Auswahl'),
    ('shortcuts.groupActions', 'Acciones', 'Actions', 'Actions', 'Acoes', 'Aktionen'),
    ('shortcuts.search', 'Ir a la busqueda', 'Go to the search box',
     'Aller a la recherche', 'Ir para a busca', 'Zum Suchfeld springen'),
    ('shortcuts.new', 'Anadir una clave', 'Add a key', 'Ajouter une cle',
     'Adicionar uma chave', 'Einen Schlussel hinzufuegen'),
    ('shortcuts.thisDialog', 'Ver estos atajos', 'Show these shortcuts',
     'Afficher ces raccourcis', 'Mostrar estes atalhos', 'Diese Tastenkurzel anzeigen'),
    ('shortcuts.close', 'Cerrar lo que este abierto', 'Close whatever is open',
     'Fermer ce qui est ouvert', 'Fechar o que estiver aberto',
     'Schliessen was offen ist'),
    ('shortcuts.selectAll', 'Marcar todas las visibles', 'Select every visible key',
     'Selectionner toutes les cles visibles', 'Selecionar todas as visiveis',
     'Alle sichtbaren auswaehlen'),
    ('shortcuts.clearSelection', 'Quitar la seleccion', 'Clear the selection',
     'Retirer la selection', 'Limpar a selecao', 'Auswahl aufheben'),
    ('shortcuts.undo', 'Deshacer la ultima accion', 'Undo the last action',
     'Annuler la derniere action', 'Anular a ultima acao',
     'Letzte Aktion rueckgaengig machen'),
    ('shortcuts.hint',
     'Dentro de un campo de texto siguen valiendo Escape, Ctrl+A y Ctrl+Z.',
     'Inside a text field, Escape, Ctrl+A and Ctrl+Z still apply.',
     'Dans un champ de texte, Echap, Ctrl+A et Ctrl+Z comptent toujours.',
     'Dentro de um campo de texto, Escape, Ctrl+A e Ctrl+Z continuam a valer.',
     'In einem Textfeld gelten weiterhin Esc, Strg+A und Strg+Z.'),

    ('app.duplicateKey', 'Ya tienes esa clave, en «{0}».',
     'You already have that key, under «{0}».', 'Tu as deja cette cle dans «{0}».',
     'Ja tens essa chave em «{0}».', 'Diesen Schlussel hast du bereits unter «{0}».'),
    ('app.undoNothingHappened',
     'No se ha podido deshacer: las claves ya no estan en la coleccion.',
     'Could not undo: the keys are no longer in the collection.',
     'Impossible d annuler : les cles ne sont plus dans la collection.',
     'Nao foi possivel anular: as chaves ja nao estao na colecao.',
     'Konnte nicht rueckgaengig gemacht werden: die Schluessel sind nicht mehr in der Sammlung.'),
    ('app.undoDone', 'Deshecho: {0}', 'Undone: {0}', 'Annule : {0}', 'Anulado: {0}',
     'Rueckgaengig gemacht: {0}'),

    ('app.libraryPartial',
     '{0} Lejos del total: hay mas juegos de los que se han leido.',
     '{0} Short of the total: there are more games than were read.',
     '{0} En dessous du total : il y a plus de jeux que ce qui a ete lu.',
     '{0} Abaixo do total: ha mais jogos do que os lidos.',
     '{0} Unter dem Gesamtwert: es wurden mehr Spiele gelesen, als angezeigt wird.'),
    ('app.syncedPartial',
     'Biblioteca sincronizada a medias: {0} juegos leidos, puede haber mas.',
     'Library half-synced: {0} games read, there may be more.',
     'Bibliotheque synchronisee a moitie : {0} jeux lus, il peut y en avoir plus.',
     'Biblioteca sincronizada a meio: {0} jogos lidos, pode haver mais.',
     'Bibliothek halb synchronisiert: {0} Spiele gelesen, es kann mehr geben.'),
    ('bulk.becomes', '{0} pasan a {1}', '{0} move to {1}',
     '{0} passent a {1}', '{0} passam para {1}', '{0} wechseln zu {1}'),
    ('bulk.alreadyThere', '{0} ya estaban en {1}', '{0} are already {1}',
     '{0} etaient deja en {1}', '{0} ja estavam em {1}',
     '{0} waren bereits in {1}'),
    ('bulk.cannotBecome', '{0} no pueden pasar a {1}', '{0} cannot move to {1}',
     '{0} ne peuvent pas passer a {1}', '{0} nao podem passar para {1}',
     '{0} koennen nicht zu {1} wechseln'),
    ('storage.deleteBackup', 'Eliminar esta copia', 'Delete this backup',
     'Supprimer cette copie', 'Excluir esta copia', 'Diese Sicherung loeschen'),
    ('storage.deleteBackup.body',
     'La copia «{0}» se borrara de forma permanente. No habra forma de recuperarla.',
     'Backup «{0}» will be deleted for good. There will be no way to get it back.',
     'La copie « {0} » sera supprimee definitivement. Il n y aura pas de moyen de la recuperer.',
     'A copia «{0}» sera eliminada para sempre. Nao havera forma de a recuperar.',
     'Die Sicherung «{0}» wird endgueltig geloescht. Es gibt keine Moeglichkeit, sie wiederherzustellen.'),
    ('tags.usesOne', '{0} clave', '{0} key',
     '{0} cle', '{0} chave', '{0} Schluessel'),
    ('tags.usesMany', '{0} claves', '{0} keys',
     '{0} cles', '{0} chaves', '{0} Schluessel'),
    ('tags.removeHint', 'Quitar esta etiqueta de la coleccion', 'Remove this tag from the collection',
     'Retirer cette etiquette de la collection', 'Remover esta etiqueta da colecao', 'Diese Markierung aus der Sammlung entfernen'),
    ('tags.removeTitle', 'Quitar la etiqueta', 'Remove the tag',
     'Retirer l etiquette', 'Remover a etiqueta', 'Markierung entfernen'),
    ('tags.removeBody', 'Se quitara «{0}» de la coleccion y de las {1} que la llevan. No se puede deshacer.', '«{0}» will be removed from the collection and from the {1} that use it. This cannot be undone.',
     '« {0} » sera retiree de la collection et des {1} qui l utilisent. Action irreversible.', '«{0}» sera removida da colecao e das {1} que a usam. Nao pode ser desfeito.', '«{0}» wird aus der Sammlung und von den {1} entfernt, die es verwenden. Das laesst sich nicht rueckgaengig machen.'),
    ('settings.tab.keys', 'Claves', 'Keys',
     'Cles', 'Chaves', 'Schluessel'),
    ('settings.keys.tags', 'Etiquetas', 'Tags',
     'Etiquettes', 'Etiquetas da colecao', 'Markierungen'),
    ('settings.keys.tags.hint', 'Como se llaman las etiquetas de la coleccion. Renombrar una cambia el nombre en todas las claves que la llevan.', 'How the collection tags are named. Renaming one changes it in every key that uses it.',
     'Comment les etiquettes de la collection sont nommees. Renommer une change son nom dans toutes les cles qui l utilisent.', 'Como se chamam as etiquetas da colecao. Renomear uma muda o nome em todas as chaves que a usam.', 'Wie die Markierungen der Sammlung benannt sind. Umbenennen aendert den Namen in allen Schluesseln, die sie verwenden.'),
    ('settings.keys.tags.total', 'en el catalogo', 'in the catalogue',
     'dans le catalogue', 'no catalogo', 'im Katalog'),
    ('settings.keys.tags.inUseOne', '{0} en uso', '{0} in use',
     '{0} en usage', '{0} em uso', '{0} in Benutzung'),
    ('settings.keys.tags.inUseMany', '{0} en uso', '{0} in use',
     '{0} en usage', '{0} em uso', '{0} in Benutzung'),
    ('settings.keys.tags.idle', '{0} sin usar', '{0} unused',
     '{0} inutilisees', '{0} sem uso', '{0} unbenutzt'),
    ('settings.keys.tags.more', 'y {0} mas', 'and {0} more',
     'et {0} de plus', 'e mais {0}', 'und {0} weitere'),
    ('tags.addOne', 'Anadir etiqueta', 'Add tag',
     'Ajouter une etiquette', 'Adicionar etiqueta', 'Markierung hinzufuegen'),
    ('tags.removeOne', 'Quitar la etiqueta {0} de esta clave', 'Remove tag {0} from this key',
     'Retirer l etiquette {0} de cette cle', 'Remover a etiqueta {0} desta chave', 'Markierung {0} von diesem Schluessel entfernen'),
    ('tags.manage.title', 'Etiquetas', 'Tags',
     'Etiquettes', 'Rotulos', 'Markierungen'),
    ('tags.manage.hint', 'Las etiquetas son de la coleccion entera: renombrar una cambia el nombre en todas las claves que la llevan.', 'Tags belong to the whole collection: renaming one changes it in every key that uses it.',
     'Les etiquettes appartiennent a toute la collection : renommer une change son nom dans toutes les cles qui l utilisent.', 'As etiquetas pertencem a colecao inteira: renomear uma muda o nome em todas as chaves que a usam.', 'Markierungen gehoeren zur gesamten Sammlung: Umbenennen aendert den Namen in allen Schluesseln, die sie verwenden.'),
    ('tags.manage.newPlaceholder', 'Nombre de la etiqueta nueva', 'New tag name',
     'Nom de la nouvelle etiquette', 'Nome da nova etiqueta', 'Name der neuen Markierung'),
    ('tags.manage.add', 'Anadir', 'Add',
     'Ajouter', 'Adicionar', 'Hinzufuegen'),
    ('tags.manage.rename', 'Renombrar', 'Rename',
     'Renommer', 'Renomear', 'Umbenennen'),
    ('tags.manage.renameLabel', 'Nombre de la etiqueta', 'Tag name',
     'Nom de l etiquette', 'Nome da etiqueta', 'Name der Markierung'),
    ('tags.manage.mergeTitle', 'Unir las dos etiquetas', 'Merge the two tags',
     'Fusionner les deux etiquettes', 'Juntar as duas etiquetas', 'Die beiden Markierungen zusammenfuehren'),
    ('tags.manage.mergeBody', '«{1}» ya existe. Se renombrara «{0}» a «{1}», las claves que ya tienen «{1}» no cambiaran y «{0}» dejara de existir.', '«{1}» already exists. «{0}» will be renamed to «{1}»; keys that already have «{1}» will not change, and «{0}» will stop existing.',
     '« {1} » existe deja. « {0} » sera renommee en « {1} », les cles qui ont deja « {1} » ne changeront pas et « {0} » cessera d exister.', '«{1}» ja existe. «{0}» sera renomeada a «{1}»; as chaves que ja tem «{1}» nao mudarao e «{0}» deixara de existir.', '«{1}» gibt es schon. «{0}» wird zu «{1}» umbenannt; Schluessel mit «{1}» aendern sich nicht und «{0}» verschwindet.'),
    ('tags.manage.merge', 'Unir', 'Merge',
     'Fusionner', 'Juntar', 'Zusammenfuehren'),
    ('tags.renamedOne', '«{0}» se ha renombrado y {1} clave la lleva ahora.', '«{0}» has been renamed and 1 key now uses it.',
     '« {0} » a ete renommee et 1 cle la porte maintenant.', '«{0}» foi renomeada e 1 chave usa-a agora.', '«{0}» wurde umbenannt und 1 Schluessel verwendet es jetzt.'),
    ('tags.renamedMany', '«{0}» se ha renombrado y {1} claves la llevan ahora.', '«{0}» has been renamed and {1} keys now use it.',
     '« {0} » a ete renommee et {1} cles la portent maintenant.', '«{0}» foi renomeada e {1} chaves usam-na agora.', '«{0}» wurde umbenannt und {1} Schluessel verwenden es jetzt.'),
    ('tags.removeLabel', 'Quitar la etiqueta {0}', 'Remove the tag {0}',
     'Retirer l etiquette {0}', 'Remover a etiqueta {0}', 'Markierung {0} entfernen'),
    ('tags.removedOne', 'Se quito de {0} clave.', 'Removed from {0} key.',
     'Retiree de {0} cle.', 'Removida de {0} chave.', 'Von {0} Schluessel entfernt.'),
    ('tags.removedMany', 'Se quito de {0} claves.', 'Removed from {0} keys.',
     'Retiree de {0} cles.', 'Removida de {0} chaves.', 'Von {0} Schluesseln entfernt.'),
    ('library.refresh', 'Actualizar biblioteca', 'Refresh library',
     'Actualiser la bibliotheque', 'Atualizar a biblioteca',
     'Bibliothek aktualisieren'),
    ('library.partial', 'lectura a medias', 'half read', 'lecture a moitie',
     'leitura a meio', 'halb gelesen'),
    ('library.partialHint',
     'La lectura se paro por el limite de paginas de Steam. El numero es el de los juegos leidos, no el total de la cuenta.',
     "The read stopped at Steam's page limit. The number is the games that were read, not the total on the account.",
     "La lecture s est arretee a la limite de pages de Steam. Le nombre est celui des jeux lus, pas le total du compte.",
     'A leitura parou no limite de paginas da Steam. O numero e o dos jogos lidos, nao o total da conta.',
     'Das Lesen wurde beim Seitenlimit von Steam beendet. Die Zahl sind die gelesenen Spiele, nicht die Gesamtzahl des Kontos.'),
    ('app.undoAvailable', 'Deshacer: {0}', 'Undo: {0}', 'Annuler : {0}', 'Anular: {0}',
     'Rueckgaengig: {0}'),
    ('app.nothingToUndo', 'No hay nada que deshacer.', 'There is nothing to undo.',
     'Il ny a rien a annuler.', 'Nao ha nada para anular.',
     'Es gibt nichts rueckgaengig zu machen.'),
    ('app.undoHint', 'Se puede deshacer con Ctrl+Z.', 'You can undo with Ctrl+Z.',
     'Tu peux annuler avec Ctrl+Z.', 'Podes anular com Ctrl+Z.',
     'Du kannst mit Strg+Z rueckgaengig machen.'),
    ('app.saveTimedOut', 'El guardado esta tardando demasiado. Intentalo otra vez.',
     'Saving is taking too long. Try again.',
     'La sauvegarde prend trop de temps. Reessaie.',
     'A gravacao esta a demorar. Tenta outra vez.',
     'Das Speichern dauert zu lange. Versuche es erneut.'),
    ('app.exportFiltered', 'Exportando las {0} claves que estas viendo.',
     'Exporting the {0} keys you are seeing.', 'Export des {0} cles visibles.',
     'A exportar as {0} chaves que estas a ver.',
     'Es werden die {0} sichtbaren Schluessel exportiert.'),
    # Errores de Steam. El mensaje del `SteamError` ES la clave, asi que si
    # alguno se pinta sin traducir sale `steam.perfilPrivado` en pantalla: es un
    # fallo ruidoso en lugar de castellano callado en cuatro de los cinco
    # idiomas. Por eso estan todas, incluidas las que nunca se ven —`limite`
    # la consume `pedirConMargen` y no llega a enseearse—: dejarla fuera seria
    # que un dia se viera su clave desnuda.
    ('steam.limite', 'Vas muy rapido. Espera un momento.',
     'You are going too fast. Wait a moment.',
     'Tu vas trop vite. Attends un instant.',
     'Estaes demasiado rapido. Espera um instante.',
     'Du gehst zu schnell. Warte einen Moment.'),
    ('steam.sinClave', 'Falta la clave de la API.', 'The API key is missing.',
     'Il manque la cle de l API.',
     'Falta a chave da API.',
     'Der API-Schluessel fehlt.'),
    ('steam.idInvalido', 'Eso no parece un ID de Steam ni un nombre de perfil.',
     'That does not look like a Steam ID or a profile name.',
     'Ca ne ressemble ni a un ID Steam ni a un nom de profil.',
     'Isso nao parece um ID da Steam nem um nome de perfil.',
     'Das sieht weder nach einer Steam-ID noch nach einem Profilnamen aus.'),
    ('steam.perfilPrivado',
     'La biblioteca vino vacia. Comprueba que tu perfil de Steam sea publico, o que la clave sea de esa cuenta.',
     'The library came back empty. Check that your Steam profile is public, or that the key belongs to that account.',
     'La bibliotheque est videe. Verifiez que votre profil Steam est public, ou que la cle est bien celle de ce compte.',
     'A biblioteca veio vazia. Confirma que o teu perfil da Steam e publico, ou que a chave e dessa conta.',
     'Die Bibliothek war leer. Pruefe, ob Ihr Steam-Profil oeffentlich ist oder ob der Schluessel zu diesem Konto gehoert.'),
    ('steam.perfilNoExiste', 'No hay ningun perfil con el nombre «{0}».',
     'There is no profile named «{0}».',
     'Il n y a aucun profil du nom « {0} ».',
     'Nao ha nenhum perfil com o nome «{0}».',
     'Es gibt kein Profil namens «{0}».'),
    ('steam.perfilRenombrado', 'Ese perfil ahora se llama «{0}».',
     'That profile is now called «{0}».',
     'Ce profil s appelle desormais « {0} ».',
     'Esse perfil agora chama-se «{0}».',
     'Dieses Profil heisst jetzt «{0}».'),
    ('steam.perfilIdNoLeido', 'No se pudo leer el ID del perfil «{0}».',
     'Could not read the ID of the profile «{0}».',
     'Impossible de lire l ID du profil « {0} ».',
     'Nao foi possivel ler o ID do perfil «{0}».',
     'Die ID des Profils «{0}» konnte nicht gelesen werden.'),
    ('steam.perfilNoResponde', 'No se pudo consultar Steam.',
     'Could not reach Steam.',
     'Impossible de contacter Steam.',
     'Nao foi possivel contactar com a Steam.',
     'Steam konnte nicht erreicht werden.'),
    ('steam.estadoHttp', 'Steam respondio con el estado {0}.',
     'Steam replied with status {0}.',
     'Steam a repondu avec le code {0}.',
     'A Steam respondeu com o estado {0}.',
     'Steam antwortete mit Status {0}.'),
    ('steam.vacio', 'La biblioteca de Steam vino vacia.',
     'The Steam library came back empty.',
     'La bibliotheque Steam est videe.',
     'A biblioteca da Steam veio vazia.',
     'Die Steam-Bibliothek war leer.'),
    ('steam.http', 'Steam no ha contestado.', 'Steam did not reply.',
     'Steam n a pas repondu.', 'A Steam nao respondeu.',
     'Steam hat nicht geantwortet.'),
    ('steam.cancelado', 'Sincronizacion cancelada.', 'Sync cancelled.',
     'Synchronisation annulee.', 'Sincronizacao cancelada.',
     'Synchronisierung abgebrochen.'),

    # Los tres dialogos que tenian castellano escrito a mano en el JSX. La clave
    # del importador estaba a cinco lineas de existir en el mismo fichero, que
    # es lo que hace que esto pase: estaba translated el 80% del dialogo.
    ('action.add', 'Anadir', 'Add', 'Ajouter', 'Adicionar',
     'Hinzufuegen'),
    ('action.apply', 'Aplicar', 'Apply', 'Appliquer', 'Aplicar',
     'Anwenden'),

    ('import.header', 'Importar desde TXT', 'Import from TXT',
     'Importer depuis un TXT', 'Importar de um TXT',
     'Aus einer TXT-Datei importieren'),
    ('import.noneNew',
     'No hay ninguna clave nueva en este fichero. Puede que ya las tuvieras todas importadas.',
     'There are no new keys in this file. You may already have imported them all.',
     'Il n y a aucune nouvelle cle dans ce fichier. Vous les avez peut-etre deja toutes importees.',
     'Nao ha nenhuma chave nova neste ficheiro. Puede que ja as tenhas todas importadas.',
     'In dieser Datei ist kein neuer Schluessel. Vielleicht wurden sie alle schon importiert.'),
    ('import.issues', '{0} linea(s) sin interpretar',
     '{0} line(s) could not be read',
     '{0} ligne(s) nont pas pu etre lues',
     '{0} linha(s) nao puderam ser lidas',
     '{0} Zeile(n) konnten nicht gelesen werden'),
    ('import.issuesHint',
     'Son lineas que el parser no ha sabido convertir en una clave: duplicados, sufijos pegados o claves de plataforma desconocida. Se ignoran; no bloquean la importacion.',
     'These are lines the parser could not turn into a key: duplicates, stuck-on suffixes, or keys for an unknown platform. They are skipped; they do not block the import.',
     'Ce sont des lignes que le convertisseur n a pas su transformer en cle : doublons, suffixes collees ou cles de plateforme inconnue. Elles sont ignorees et ne bloquent pas l importation.',
     'Sao linhas que o analisador nao conseguiu transformar em chave: duplicados, sufixos colados ou chaves de plataforma desconhecida. Sao ignoradas e nao bloqueiam a importacao.',
     'Das sind Zeilen, die der Parser nicht in einen Schluessel umwandeln konnte: Duplikate, angehaengte Endungen oder Schluessel einer unbekannten Plattform. Sie werden uebersprungen und blockieren den Import nicht.'),
    ('import.backupNotice',
     'Antes de escribir se crea una copia de seguridad automatica de tu base de datos.',
     'A backup of your database is made before anything is written.',
     'Avant toute ecriture, une copie de sauvegarde de votre base de donnees est creee.',
     'Antes de escrever e criada uma copia de seguranca da tua base de dados.',
     'Vor dem Schreiben wird eine automatische Sicherung de deiner Datenbank erstellt.'),

    ('tags.empty', 'Todavia no hay etiquetas en la coleccion.',
     'There are no tags in the collection yet.',
     'Il n y a pas encore d etiquettes dans la collection.',
     'Ainda nao ha etiquetas na colecao.',
     'In der Sammlung gibt es noch keine Tags.'),
    ('tags.merging',
     'Las claves que no tengan la etiqueta la reciben; las que ya la tienen la conservan.',
     'Keys without the tag get it; the ones that already have it keep it.',
     'Les cles sans l etiquette la recoivent ; celles qui l ont deja la conservent.',
     'As chaves sem a etiqueta recebem-na; as que ja a tem conservam-na.',
     'Schluessel ohne das Tag bekommen es; die es schon haben, behalten es.'),

    ('gift.recipient', '¿A quien se lo has regalado?', 'Who did you give it to?',
     'A qui l avez-vous offert ?', 'A quem deste isso?',
     'Wem hast du es geschenkt?'),
    ('gift.recipientHint',
     'Se guarda con cada clave, para saber a quien se la diste.',
     'It is stored with every key, so you know who you gave it to.',
     'Il est enregistre avec chaque cle, pour savoir a qui vous l avez donne.',
     'Fica guardado com cada chave, para saberes a quem a deste.',
     'Es wird mit jedem Schluessel gespeichert, damit du weisst, wem du ihn gegeben hast.'),
    ('gift.more.one', 'y {0} juego mas', 'and {0} more game',
     'et {0} jeu de plus', 'e mais {0} jogo', 'und {0} weiteres Spiel'),
    ('gift.more.many', 'y {0} juegos mas', 'and {0} more games',
     'et {0} jeux de plus', 'e mais {0} jogos', 'und {0} weitere Spiele'),

    ('app.exportFilteredNone', 'No hay claves visibles que exportar.',
     'There are no visible keys to export.', 'Aucune cle visible a exporter.',
     'Nao ha chaves visiveis para exportar.',
     'Es gibt keine sichtbaren Schluessel zum Exportieren.'),

    ('app.deleteFailed', 'No se pudo eliminar la clave.',
     'Could not delete the key.', 'La suppression a echoue.',
     'Nao foi possivel apagar a chave.',
     'Der Schluessel konnte nicht geloescht werden.'),
    ('app.loadingCollection', 'Cargando la coleccion…',
     'Loading your collection…', 'Chargement de la collection…',
     'A carregar a colecao…', 'Die Sammlung wird geladen…'),
    ('app.linkCancelled', 'Conexion con Steam cancelada.',
     'Linking to Steam was cancelled.', 'Connexion a Steam annulee.',
     'Ligacao a Steam cancelada.',
     'Die Verbindung zu Steam wurde abgebrochen.'),
    ('expire.confirm', 'Marcar caducadas', 'Mark as expired',
     'Marquer comme expirees', 'Marcar como caducadas',
     'Als abgelaufen markieren'),
    ('expire.bodyOne',
     '«{0}» quedara como caducada y saldra de la lista de disponibles. Puedes cambiarlo luego con el toggle de estado.',
     '«{0}» will be marked as expired and will leave the available list. You can change it later with the status toggle.',
     '« {0} » sera marquee comme expiree et quittera la liste des disponibles. Vous pourrez la changer plus tard avec le bouton de statut.',
     '«{0}» vai ficar caducada e sair da lista de disponiveis. Pode mudar isso depois com o interruptor de estado.',
     '«{0}» wird als abgelaufen markiert und verlaesst die Liste der verfuegbaren. Das laesst sich spaeter ueber den Status-Schalter aendern.'),
    ('expire.bodyMany',
     'Las {0} claves seleccionadas quedaran como caducadas y saldran de la lista de disponibles. Puedes cambiarlas luego con el toggle de estado.',
     'The {0} selected keys will be marked as expired and will leave the available list. You can change them later with the status toggle.',
     'Les {0} cles selectionnees seront marquees comme expirees et quitteront la liste des disponibles. Vous pourrez les changer plus tard avec le bouton de statut.',
     'As {0} chaves selecionadas vao ficar caducadas e sair da lista de disponiveis. Pode mudar isso depois com o interruptor de estado.',
     'Die {0} ausgewaehlten Schluessel werden als abgelaufen markiert und verlassen die Liste der verfuegbaren. Das laesst sich spaeter ueber den Status-Schalter aendern.'),

    ('toolbar.shortcuts', 'Atajos', 'Shortcuts', 'Raccourcis', 'Atalhos',
     'Tastenkurzel'),

    ('editor.restorePreviewTitle', 'Que va a cambiar', 'What will change',
     'Ce qui va changer', 'O que vai mudar', 'Was sich aendert'),
    ('editor.restorePreviewNone', 'No hay nada que restaurar.',
     'There is nothing to restore.', 'Il ny a rien a restaurer.',
     'Nao ha nada para restaurar.', 'Es gibt nichts wiederherzustellen.'),

    ('storage.restoreCounting', 'Calculando lo que va a cambiar…',
     'Working out what will change…', 'Calcul de ce qui va changer…',
     'A calcular o que vai mudar…', 'Berechne, was sich andaern wird…'),
    ('storage.restoreWillAdd', 'Entran {0} nuevas', '{0} new keys will be added',
     '{0} nouvelles cles seront ajoutees', '{0} chaves novas entram',
     '{0} neue Schluessel kommen hinzu'),
    ('storage.restoreWillUpdate', 'Se actualizan {0}', '{0} will be updated',
     '{0} seront mises a jour', '{0} vao ser atualizadas',
     '{0} werden aktualisiert'),
]

# El borrado ya se deshace, y el texto decia que no. Se corrige en los cinco
# idiomas, incluido el castellano, que va en su propio fichero.
DELETE_BODY = [
    ("Se eliminara «{0}» de tu coleccion. Esto no se puede deshacer.",
     "Se eliminara «{0}» de tu coleccion. Puedes devolverla con Ctrl+Z."),
    ("«{0}» will be removed from your collection. This cannot be undone.",
     "«{0}» will be removed from your collection. You can bring it back with Ctrl+Z."),
    ("«{0}» sera supprime de ta collection. Tu ne peux pas l annuler.",
     "«{0}» sera supprime de ta collection. Tu peux le ramener avec Ctrl+Z."),
    ("«{0}» sera apagado da tua colecao. Nao podes anular.",
     "«{0}» sera apagado da tua colecao. Podes devolver com Ctrl+Z."),
    ("«{0}» wird aus deiner Sammlung geloescht. Das laesst sich nicht rueckgaengig machen.",
     "«{0}» wird aus deiner Sammlung geloescht. Mit Strg+Z bekommst du es zurueck."),
]

CLAVES = {fila[0] for fila in FILAS}

# Indice de la columna de cada idioma generado dentro de una fila.
COLUMNA = {'fr': 3, 'pt': 4, 'de': 5}


def linea(clave: str, valor: str) -> str:
    """Una entrada de la tabla. Sin apostrofos: el fichero los usaria como comilla."""
    if "'" in valor:
        raise SystemExit(f'la traduccion de {clave} lleva apostrofo: {valor}')

    return f" '{clave}': '{valor}',"


def main() -> None:
    texto = GENERADOR.read_text(encoding='utf-8')

    for idioma, columna in COLUMNA.items():
        apertura = f"TRADUCCIONES['{idioma}'] = {{\n"
        inicio = texto.index(apertura)

        # Las tablas cierran con un espacio y una llave: `\n }`.
        fin = texto.index('\n }', inicio)

        lineas = texto[inicio:fin].split('\n')
        cabecera = lineas[0]

        # Se quitan las claves nuevas por si ya estaban, y se vuelven a
        # escribir con SU columna. Es idempotente a proposito: repetir el
        # script no debe duplicar ni dejar valores cruzados.
        resto = [
            linea for linea in lineas[1:]
            if not any(linea.strip().startswith(f"'{clave}':") for clave in CLAVES)
        ]

        bloque = '\n'.join(linea(f[0], f[columna]) for f in FILAS)
        texto = texto[:inicio] + cabecera + '\n' + '\n'.join(resto) + '\n' + bloque + texto[fin:]

    for viejo, nuevo in DELETE_BODY:
        texto = texto.replace(viejo, nuevo)

    GENERADOR.write_text(texto, encoding='utf-8')
    ast.parse(texto)

    for clave in sorted(CLAVES):
        apariciones = texto.count(f"'{clave}':")
        if apariciones != len(COLUMNA):
            raise SystemExit(f'{clave}: {apariciones} apariciones, se esperaban {len(COLUMNA)}')

    print(f'{len(FILAS)} claves reconstruidas en {len(COLUMNA)} tablas')


if __name__ == '__main__':
    main()