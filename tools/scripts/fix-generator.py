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
    ('shortcuts.selectFail', 'Marcar las que fallan', 'Select the ones that fail',
     'Selectionner celles qui echouent', 'Selecionar as que falham',
     'Die fehlschlagenden auswaehlen'),
    ('shortcuts.undo', 'Deshacer la ultima accion', 'Undo the last action',
     'Annuler la derniere action', 'Anular a ultima acao',
     'Letzte Aktion rueckgaengig machen'),
    ('shortcuts.hint', 'Dentro de un campo de texto solo cuentan Escape y Enter.',
     'Inside a text field only Escape and Enter apply.',
     'Dans un champ de texte seuls Echap et Entree comptent.',
     'Dentro de um campo de texto so contam Escape e Enter.',
     'In einem Textfeld gelten nur Esc und Eingabe.'),

    ('app.duplicateKey', 'Ya tienes esa clave, en «{0}».',
     'You already have that key, under «{0}».', 'Tu as deja cette cle dans «{0}».',
     'Ja tens essa chave em «{0}».', 'Diesen Schlussel hast du bereits unter «{0}».'),
    ('app.undoDone', 'Deshecho: {0}', 'Undone: {0}', 'Annule : {0}', 'Anulado: {0}',
     'Rueckgaengig gemacht: {0}'),
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
    ('app.exportFilteredNone', 'No hay claves visibles que exportar.',
     'There are no visible keys to export.', 'Aucune cle visible a exporter.',
     'Nao ha chaves visiveis para exportar.',
     'Es gibt keine sichtbaren Schluessel zum Exportieren.'),

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