//! Shell Tauri del gestor de keys.
//!
//! Reglas de seguridad:
//! - La base de datos es SQLite (plugin `sql`) y vive en el directorio de
//!   configuracion de la app, nunca dentro del repositorio.
//! - El unico acceso a ficheros del usuario es a traves del dialogo nativo:
//!   `read_text_file` / `write_text_file` solo se ejecutan sobre rutas que el
//!   propio usuario acaba de elegir, asi que no hace falta el plugin `fs` con
//!   permisos amplios.
//! - La base de datos y las copias viven **junto al ejecutable** (modo
//!   portable), y cuando esa carpeta no se puede escribir se cae a la del
//!   sistema. Las copias de seguridad son filas de la propia base de datos, no
//!   ficheros sueltos.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::Manager;

/// Nombre del fichero de base de datos. Debe coincidir con `DB_FILE_NAME`.
const DB_FILE_NAME: &str = "steam-keys.db";

/// Fichero temporal donde se deposita una base de datos traida de otro sitio.
const STAGED_FILE_NAME: &str = "restore-candidate.db";

/// Carpeta donde la version anterior guardaba las copias de seguridad.
///
/// Ya no se escribe: solo se lee, una unica vez, para traer las copias que
/// alguien tenga de antes a la tabla `backups`. No se borra al terminar, porque
/// borrar ficheros del usuario es justo lo que esta app no hace nunca.
const LEGACY_BACKUPS_DIR: &str = "backups";

// ---------------------------------------------------------------------------
// Rutas internas
// ---------------------------------------------------------------------------

/// Carpeta que se supone portable, deducida del ejecutable.
///
/// Se separa de `config_dir` para poder probarla: aqui no se toca el disco ni el
/// entorno, solo entra una ruta y sale otra. Es la parte con los casos raros de
/// cada sistema, y la que hay que poder comprobar sin compilar la app entera.
fn carpeta_portable_de(ejecutable: &Path, appimage: Option<&str>) -> Option<PathBuf> {
    // Un AppImage no se ejecuta desde su sitio: se monta en temporal y el
    // ejecutable real aparece en `/tmp/.mount_XXXX/`. Los datos se guardarian
    // ahi, que se borra al cerrar. El propio AppImage dice donde esta con
    // `$APPIMAGE`, que es la unica ruta fiable en ese caso.
    let base = match appimage {
        Some(ruta) => PathBuf::from(ruta),
        None => PathBuf::from(ejecutable),
    };

    let mut carpeta = base.parent()?.to_path_buf();

    // En macOS el ejecutable cuelga de un paquete:
    //   Steam Keys.app/Contents/MacOS/Steam Keys
    // Los datos van junto al `.app`, no dentro del paquete: dentro esta
    // firmado y macOS no deja escribir ahi.
    //
    // Se sube **solo** si las tres piezas encajan: carpeta `MacOS`, dentro de
    // `Contents`, y ese `Contents` dentro de algo que acabe en `.app`. Con una
    // sola bastaba y sobraba por los dos lados: si solo se mira `MacOS`, ante
    // `/Users/yo/MacOS/steam-keys` —una carpeta corriente con ese nombre— el
    // programa subia tres niveles y guardaba las claves en `/`; y si se miran
    // `MacOS` y `Contents` sin mas, `/Users/yo/Contents/MacOS/steam-keys`
    // tambien cuenta como paquete aunque no haya nada `.app` alrededor.
    let en_paquete = carpeta
        .file_name()
        .is_some_and(|nombre| nombre == "MacOS")
        && carpeta
            .parent()
            .and_then(Path::file_name)
            .is_some_and(|nombre| nombre == "Contents")
        && carpeta
            .parent()
            .and_then(Path::parent)
            .and_then(Path::file_name)
            .is_some_and(|nombre| nombre.to_string_lossy().ends_with(".app"));

    if en_paquete {
        carpeta = carpeta.parent()?.to_path_buf(); // Contents
        carpeta = carpeta.parent()?.to_path_buf(); // Steam Keys.app
        carpeta = carpeta.parent()?.to_path_buf(); // la carpeta que lo contiene
    }

    Some(carpeta)
}

/// Si en `dir` se puede crear un fichero.
///
/// Comprobar los permisos no basta: en Windows da permisos de escritura sobre
/// un fichero pero no sobre la carpeta, y en Linux `readonly` en el montaje
/// hace que `metadata().permissions()` diga que si. La unica forma fiable es
/// intentar escribir, y borrar el testigo enseguida.
fn es_escribible(dir: &Path) -> bool {
    let testigo = dir.join(".escritura-probando");

    match fs::write(&testigo, b"") {
        Ok(()) => {
            let _ = fs::remove_file(&testigo);
            true
        }
        Err(_) => false,
    }
}

/// Directorio de datos: el portable si se puede escribir, si no el del sistema.
///
/// El modo portable es el normal, pero no puede ser el unico: la app acaba en
/// `Program Files` o en `/Applications` en cuanto alguien la instala, y ahi no
/// hay quien escriba sin permisos de administrador. Cuando la carpeta de al lado
/// no sirve se vuelve a la del sistema, que es donde siempre se ha podido
/// escribir, y la interfaz enseña la ruta real para que se vea donde acaba.
fn config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let portable = std::env::current_exe()
        .ok()
        .and_then(|exe| {
            let appimage = std::env::var("APPIMAGE").ok();
            carpeta_portable_de(&exe, appimage.as_deref())
        })
        .filter(|dir| dir.is_dir() && es_escribible(dir));

    if let Some(dir) = portable {
        return Ok(dir);
    }

    app.path()
        .app_config_dir()
        .map_err(|error| format!("No se pudo resolver el directorio de la app: {error}"))
}

/// Si los datos estan junto al ejecutable o en la carpeta del sistema.
///
/// Va al panel de datos para que el sitio donde se guardan las claves no sea un
/// misterio: si esta en modo portable y se mueve el ejecutable, las claves se
/// quedan atras, y eso hay que verlo antes de que pase.
fn es_portable(app: &tauri::AppHandle) -> bool {
    let Ok(ejecutable) = std::env::current_exe() else {
        return false;
    };

    let appimage = std::env::var("APPIMAGE").ok();

    let Some(esperado) = carpeta_portable_de(&ejecutable, appimage.as_deref()) else {
        return false;
    };

    // Se compara con lo que `config_dir` resuelve de verdad, y no con una
    // segunda resolucion por separado: si divergieran, el panel podria
    // decir que es portable mientras la base esta en otro sitio.
    config_dir(app).map(|usada| usada == esperado).unwrap_or(false)
}

fn database_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(config_dir(app)?.join(DB_FILE_NAME))
}

// ---------------------------------------------------------------------------
// Peticiones HTTP a Steam
// ---------------------------------------------------------------------------

/// Dominios a los que se permite llamar. Lista blanca, no negra: si mañana se
/// anade alguna otra llamada hay que tocar aqui, y asi no se puede acabar
/// haciendo una peticion a cualquier sitio por un descuido.
const STEAM_DOMINIOS: [&str; 2] = ["api.steampowered.com", "steamcommunity.com"];

/// Peticion HTTP GET a Steam y devolucion del cuerpo como texto.
///
/// Hace falta porque `steamcommunity.com` **no** envia cabeceras CORS, asi que
/// el navegador rechaza la peticion antes de que salga. Rust no tiene esa
/// restriccion, asi que la llamada se hace desde aqui.
///
/// No acepta URLs libres: solo `ruta` dentro de los dominios de arriba, y se
/// comprueba antes de salir, que es lo que evita que este comando se convierta
/// en un proxy abierto a internet.
#[tauri::command]
fn steam_get(ruta: String) -> Result<String, String> {
    let limpia = ruta.trim();

    if limpia.starts_with("http://") || limpia.starts_with("https://") {
        return Err("Pasa solo la ruta, sin https://".into());
    }

    if !es_ruta_permitida(limpia) {
        return Err("Ese dominio no esta permitido".into());
    }

    let completa = format!("https://{limpia}");

    let respuesta = ureq::get(&completa)
        .call()
        .map_err(|error| format!("Steam no ha contestado: {error}"))?;

    // Steam responde 200 incluso cuando el perfil no existe, con el error
    // dentro del XML. Aqui solo se distingue el fallo de red, que es lo que
    // devuelve 4xx o 5xx de verdad.
    let codigo = respuesta.status();

    if !(200..300).contains(&codigo) {
        return Err(format!("Steam respondio con el estado {codigo}"));
    }

    respuesta
        .into_string()
        .map_err(|error| format!("No se pudo leer la respuesta de Steam: {error}"))
}

/// Comprueba que una ruta pertenece a los dominios permitidos.
///
/// Vive aparte para poder testearla sin salir a la red, que es donde estan de
/// verdad los casos raros: una ruta con `@`, con barra invertida o con un
/// dominio parecido al bueno.
fn es_ruta_permitida(ruta: &str) -> bool {
    let Some((dominio, resto)) = ruta.split_once('/') else {
        return STEAM_DOMINIOS.contains(&ruta);
    };

    // Un `@` antes del dominio hace que lo que parece el host sea en realidad
    // las credenciales: `evil.com@api.steampowered.com` pasa a Steam como si
    // fuera nuestro dominio pero va a otro sitio. Y las barras invertidas
    // hacen lo mismo en algunos resolvers.
    if resto.starts_with('@') || dominio.contains('@') || dominio.contains('\\') {
        return false;
    }

    STEAM_DOMINIOS.contains(&dominio)
}

// ---------------------------------------------------------------------------
// Ficheros del usuario (solo rutas elegidas en un dialogo nativo)
// ---------------------------------------------------------------------------

/// Lectura de un fichero de texto elegido por el usuario.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let target = PathBuf::from(path);

    if !target.is_file() {
        return Err(format!("No es un fichero: {}", target.display()));
    }

    fs::read_to_string(&target)
        .map_err(|error| format!("No se pudo leer {}: {error}", target.display()))
}

/// Escritura de un fichero de texto en una ruta elegida por el usuario.
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let target = PathBuf::from(path);

    if let Some(parent) = target.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("No se pudo crear {}: {error}", parent.display()))?;
        }
    }

    fs::write(&target, contents)
        .map_err(|error| format!("No se pudo escribir {}: {error}", target.display()))
}

/// Datos del fichero de base de datos, para el panel de datos.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseInfo {
    path: String,
    exists: bool,
    size_bytes: u64,
    /// `true` si los datos estan junto al ejecutable, no en la carpeta del
    /// sistema. El panel lo enseña porque de ello depende donde haya que
    /// buscar las claves si un dia desaparecen.
    portable: bool,
}

/// Ruta de la base de datos, para mostrarla en la UI.
#[tauri::command]
fn database_path(app: tauri::AppHandle) -> Result<String, String> {
    Ok(database_file(&app)?.to_string_lossy().to_string())
}

/// Ruta **absoluta** del directorio de datos.
///
/// El frontend la pide antes de abrir la base de datos. Antes no hacia falta:
/// `sqlite:steam-keys.db` la resolvía el plugin contra la carpeta del sistema.
/// Ahora los datos pueden estar en otro sitio, y el plugin solo acepta la ruta
/// absoluta cuando se la dan entera.
///
/// Ojo con el separador `:` de `sqlite:`: el plugin parte por el primer dos
/// puntos, asi que una ruta con unidad de Windows (`C:\...`) sobrevive intacta.
#[tauri::command]
fn data_directory(app: tauri::AppHandle) -> Result<String, String> {
    Ok(config_dir(&app)?.to_string_lossy().to_string())
}

/// Ruta, existencia y tamaño del fichero de base de datos.
#[tauri::command]
fn database_info(app: tauri::AppHandle) -> Result<DatabaseInfo, String> {
    let fichero = database_file(&app)?;

    let (exists, size_bytes) = match fs::metadata(&fichero) {
        Ok(metadata) => (true, metadata.len()),
        Err(_) => (false, 0),
    };

    Ok(DatabaseInfo {
        path: fichero.to_string_lossy().to_string(),
        exists,
        size_bytes,
        portable: es_portable(&app),
    })
}

// ---------------------------------------------------------------------------
// Traer una base de datos de otra carpeta
// ---------------------------------------------------------------------------

/// Nombres de los ficheros de copia que dejo la version anterior.
///
/// Son copias de seguridad de cuando eran ficheros sueltos en `backups/`. La
/// app ya no las crea asi, pero alguien las puede tener de antes, y perderlas
/// sin avisar seria tirar abajo el historico de esa persona.
///
/// El nombre se valida igual que entonces: solo `[a-z0-9-_.]` y `.db` al final,
/// y en ningun caso puede contener `..` ni una barra, asi que no hay forma de
/// sacar nada de su carpeta.
#[tauri::command]
fn legacy_backups(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = config_dir(&app)?.join(LEGACY_BACKUPS_DIR);

    if !dir.is_dir() {
        return Ok(Vec::new());
    }

    let entradas =
        fs::read_dir(&dir).map_err(|error| format!("No se pudo leer {}: {error}", dir.display()))?;

    let mut nombres: Vec<String> = entradas
        .filter_map(|entrada| {
            let entrada = entrada.ok()?;
            let nombre = entrada.file_name().to_string_lossy().to_string();

            if es_nombre_legible(&nombre) && entrada.path().is_file() {
                Some(nombre)
            } else {
                None
            }
        })
        .collect();

    // De mas reciente a mas antigua, como el listado de toda la vida.
    nombres.sort();
    nombres.reverse();

    Ok(nombres)
}

/// Si un nombre de la carpeta de copias antiguas es aceptable.
///
/// Mismo criterio que usaba el listado de ficheros, y por el mismo motivo: es
/// lo unico que impide que un nombre con `..` convierta esto en una manera de
/// leer cualquier fichero del disco.
fn es_nombre_legible(nombre: &str) -> bool {
    !nombre.is_empty()
        && nombre.len() <= 120
        && nombre.ends_with(".db")
        && !nombre.contains("..")
        && nombre
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

/// Deposita una copia antigua en un temporal y devuelve la ruta con que abrirla.
///
/// Es el camino que hace posible traer el historico de la version anterior:
/// esas copias son ficheros `.db` completos, y para meterlas en la tabla
/// `backups` hay que abrirlas. Rust solo copia y devuelve la ruta; el motor que
/// las consulta es el del plugin de SQL, desde el frontend.
///
/// El temporal se llama igual que el de `adopt_database` a proposito: las dos
/// operaciones son de instants distintos y nunca a la vez, y compartir el
/// nombre evita dejar un segundo temporal por ahi.
#[tauri::command]
fn stage_legacy_backup(app: tauri::AppHandle, name: String) -> Result<String, String> {
    if !es_nombre_legible(&name) {
        return Err("Nombre de copia no valido.".to_string());
    }

    let origen = config_dir(&app)?.join(LEGACY_BACKUPS_DIR).join(&name);

    if !origen.is_file() {
        return Err(format!("La copia {name} ya no existe."));
    }

    let destino = config_dir(&app)?.join(STAGED_FILE_NAME);

    fs::copy(&origen, &destino)
        .map_err(|error| format!("No se pudo preparar la copia: {error}"))?;

    // Ruta **absoluta**. Devolver solo el nombre hacia que el plugin lo
    // resolviera contra su carpeta por defecto, que en modo portable no es
    // donde esta el temporal: se abriria una base vacia y la migracion
    // traeria cero claves sin decir nada.
    Ok(format!("sqlite:{}", destino.to_string_lossy()))
}

/// Borra el temporal de la copia preparada.
#[tauri::command]
fn discard_staged_backup(app: tauri::AppHandle) -> Result<(), String> {
    let staged = config_dir(&app)?.join(STAGED_FILE_NAME);

    if staged.exists() {
        fs::remove_file(&staged)
            .map_err(|error| format!("No se pudo borrar la copia preparada: {error}"))?;
    }

    Ok(())
}

/// Adopta una base de datos venida de otra carpeta.
///
/// Es el otro camino del primer arranque: alguien copia el programa a otro
/// sitio, pero trae tambien el `steam-keys.db` de la copia buena. En vez de
/// fusionarla fila a fila como las copias de seguridad —que aqui no hay nada
/// que fusionar todavia— se comprueba que sea una base valida y se coloca
/// entera donde la app la va a buscar.
///
/// La copia se hace a un temporal primero y solo se mueve al sitio definitivo
/// cuando el origen se ha podido abrir. Mover primero y fallar despues dejaria
/// media base de datos en el sitio bueno, que es peor que no tener ninguna.
#[tauri::command]
fn adopt_database(app: tauri::AppHandle, source: String) -> Result<(), String> {
    let origen = PathBuf::from(&source);

    if !origen.is_file() {
        return Err("El fichero elegido no existe.".to_string());
    }

    let directorio = config_dir(&app)?;
    let destino = directorio.join(DB_FILE_NAME);

    // La base de datos ya viva no se pisa: si ya hay una, el camino correcto es
    // restaurar una copia, no sustituirla por un fichero abierto en otra parte.
    if destino.is_file() {
        return Err("Ya hay una base de datos aqui.".to_string());
    }

    let temporal = directorio.join(STAGED_FILE_NAME);

    fs::copy(&origen, &temporal)
        .map_err(|error| format!("No se pudo copiar {source}: {error}"))?;

    // Se comprueba la cabecera antes de darlo por bueno. Un `.db` a medias, de
    // otra version o que no es una base de datos se reconoce aqui y no
    // despues, con el mensaje de error hueco que da el plugin a mitad de la
    // interfaz.
    if let Err(error) = comprobar_sqlite(&temporal) {
        let _ = fs::remove_file(&temporal);
        return Err(error);
    }

    fs::rename(&temporal, &destino)
        .map_err(|error| format!("No se pudo dejar la base de datos en su sitio: {error}"))
}

/// Comprueba que un fichero sea una base de datos de SQLite de verdad.
///
/// Se mira la cabecera en vez de abrir el fichero porque el plugin de SQL solo
/// expone su API al frontend, no a Rust. La cabecera son los 16 bytes con los
/// que empieza todo fichero SQLite.
///
/// Que la cabecera cuadre no significa que la base este entera, pero descarta
/// el caso de verdad habitual —un `.db` de cero bytes, un fichero de texto o el
/// que estaba a mitad de una copia— sin anadir la dependencia de un motor SQLite
/// solo para poder abrir un fichero.
fn comprobar_sqlite(ruta: &Path) -> Result<(), String> {
    /// Los 16 bytes con los que empieza todo fichero SQLite.
    const CABECERA: &[u8; 16] = b"SQLite format 3\0";

    let bytes = fs::read(ruta).map_err(|error| format!("No se pudo leer el fichero: {error}"))?;

    if bytes.len() < CABECERA.len() || &bytes[..CABECERA.len()] != CABECERA {
        return Err("Ese fichero no es una base de datos de SQLite.".to_string());
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            steam_get,
            read_text_file,
            write_text_file,
            database_path,
            data_directory,
            database_info,
            legacy_backups,
            stage_legacy_backup,
            discard_staged_backup,
            adopt_database
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicacion");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn la_carpeta_portable_es_la_del_ejecutable() {
        // Linux y macOS: un binario suelto, y la carpeta es la de al lado.
        assert_eq!(
            carpeta_portable_de(Path::new("/home/yo/juegos/steam-keys"), None),
            Some(PathBuf::from("/home/yo/juegos"))
        );

        // El caso de Windows no se prueba aqui a proposito: `Path` solo trata
        // la barra invertida como separador en Windows, asi que
        // `C:\Juegos\app.exe` seria un unico nombre de fichero al probar en
        // Linux y la comprobacion daria una carpeta vacia. El codigo es el
        // mismo (`parent()`); lo que hay que mirar en Windows es que la carpeta
        // de al lado se pueda escribir, que es lo que decide el modo de verdad.
    }

    #[test]
    fn en_macos_se_sale_del_paquete_app() {
        // El ejecutable cuelga tres niveles del sitio donde esta el `.app`:
        // Contents/MacOS/Steam Keys. Los datos no pueden ir dentro del
        // paquete, que esta firmado.
        assert_eq!(
            carpeta_portable_de(
                Path::new("/Applications/Steam Keys.app/Contents/MacOS/Steam Keys"),
                None
            ),
            Some(PathBuf::from("/Applications"))
        );

        // Una carpeta corriente que se llama `MacOS` **no** es un paquete. Sin
        // comprobar tambien `Contents`, el programa subia tres niveles y
        // acababa escribiendo las claves en `/`, a tres carpetas de donde
        // tocaba: aqui se queda donde esta.
        assert_eq!(
            carpeta_portable_de(Path::new("/Users/yo/MacOS/steam-keys"), None),
            Some(PathBuf::from("/Users/yo/MacOS"))
        );

        // Y un `MacOS` suelto en la raiz tampoco.
        assert_eq!(
            carpeta_portable_de(Path::new("/MacOS/steam-keys"), None),
            Some(PathBuf::from("/MacOS"))
        );
    }

    #[test]
    fn un_contents_suelto_no_es_un_paquete() {
        // `Contents` sin nada `.app` alrededor: el nombre tambien aparece en
        // otros sitios, y subir ahi seria subir de mas.
        assert_eq!(
            carpeta_portable_de(Path::new("/Users/yo/Contents/MacOS/steam-keys"), None),
            Some(PathBuf::from("/Users/yo/Contents/MacOS"))
        );

        // Un `MacOS` dentro de `Contents` sin `MacOS` intermedio tampoco:
        // esta vez la carpeta que contiene el ejecutable no se llama asi.
        assert_eq!(
            carpeta_portable_de(Path::new("/Users/yo/Contents/steam-keys"), None),
            Some(PathBuf::from("/Users/yo/Contents"))
        );
    }

    #[test]
    fn el_appimage_manda_sobre_el_ejecutable() {
        // Dentro de un AppImage el ejecutable esta en `/tmp/.mount_XXXX/`, que
        // se borra al cerrar. `$APPIMAGE` es lo unico que dice donde esta de
        // verdad el fichero que el usuario tiene en su disco o en su USB.
        let montada = "/tmp/.mount_SteamKeys1234/usr/bin/steam-keys";
        let appimage = "/home/yo/juegos/Steam Keys.AppImage";

        assert_eq!(
            carpeta_portable_de(Path::new(montada), Some(appimage)),
            Some(PathBuf::from("/home/yo/juegos"))
        );
    }

    #[test]
    fn sin_carpeta_no_se_puede_resolver() {
        // La raiz no tiene padre, asi que no hay donde guardar nada.
        assert_eq!(carpeta_portable_de(Path::new("/"), None), None);
    }

    #[test]
    fn se_detecta_si_se_puede_escribir() {
        // Con que se pueda crear un fichero, vale. En una carpeta de solo
        // lectura el resultado puede depender de si los tests se ejecutan como
        // root, asi que ese caso no se comprueba aqui: lo decide `es_escribible`
        // en el momento de arrancar, que es cuando importa.
        let temporal = std::env::temp_dir();

        assert!(es_escribible(&temporal));
        assert!(!es_escribible(Path::new("/no/existe/esta/carpeta")));
    }

    #[test]
    fn una_base_de_datos_valida_pasa_la_comprobacion() {
        let ruta = std::env::temp_dir().join("comprobada-valida.db");

        // Cabecera de SQLite seguida de algo de contenido.
        fs::write(&ruta, b"SQLite format 3\0\x00\x10\x00\x01\x01\x00@\x00\x00\x00\x01pagina")
            .expect("no se pudo escribir");

        assert_eq!(comprobar_sqlite(&ruta), Ok(()));

        let _ = fs::remove_file(&ruta);
    }

    #[test]
    fn un_fichero_vacio_o_que_no_es_base_de_datos_se_rechaza() {
        let ruta = std::env::temp_dir().join("comprobada-invalida.db");

        // Cero bytes: es el caso de verdad de la copia a medias.
        fs::write(&ruta, b"").expect("no se pudo escribir");
        assert!(comprobar_sqlite(&ruta).is_err());

        // Un TXT cualquiera, que es lo que se elige por error en el dialogo.
        fs::write(&ruta, b"Steam Key: ABCDE-FGHIJ-KLMNO\n").expect("no se pudo escribir");
        assert!(comprobar_sqlite(&ruta).is_err());

        // Cabecera parecida pero no exacta: la diferencia esta en el final.
        fs::write(&ruta, b"SQLite format 2\0\x00\x10\x00\x01\x01\x00@")
            .expect("no se pudo escribir");
        assert!(comprobar_sqlite(&ruta).is_err());

        // Mas corto que la cabecera.
        fs::write(&ruta, b"SQLite").expect("no se pudo escribir");
        assert!(comprobar_sqlite(&ruta).is_err());

        let _ = fs::remove_file(&ruta);
    }

    #[test]
    fn un_fichero_que_no_existe_se_rechaza() {
        assert!(comprobar_sqlite(Path::new("/no/existe/este/fichero.db")).is_err());
    }
    #[test]
    fn los_nombres_de_copia_antigua_se_filtran() {
        assert!(es_nombre_legible("steam-keys-20261010-153427-manual.db"));
        assert!(es_nombre_legible("copia-2.db"));

        // Escapes de directorio: es lo que impide leer ficheros de fuera.
        assert!(!es_nombre_legible("../../etc/passwd"));
        assert!(!es_nombre_legible("..\\..\\windows\\system32"));
        assert!(!es_nombre_legible("cosas/../otra.db"));
        assert!(!es_nombre_legible(".."));

        // Extension y formato.
        assert!(!es_nombre_legible("notas.txt"));
        assert!(!es_nombre_legible(""));
        assert!(!es_nombre_legible("con espacio.db"));
    }

    #[test]
    fn las_rutas_de_steam_pasan_el_filtro() {
        assert!(es_ruta_permitida("api.steampowered.com/ISteamUser/GetOwnedGames"));
        assert!(es_ruta_permitida("steamcommunity.com/id/mi-perfil/?xml=1"));

        // Sin barra detras: es solo el dominio.
        assert!(es_ruta_permitida("api.steampowered.com"));
    }

    #[test]
    fn un_dominio_falso_no_pasa_el_filtro() {
        // Ni uno parecido, ni uno que lo imite.
        assert!(!es_ruta_permitida("evil.com/robo"));
        assert!(!es_ruta_permitida("api.steampowered.com.evil.com/x"));
        assert!(!es_ruta_permitida("steamcommunity.com.evil.io/x"));

        // El truco clasico: lo que parece el dominio va en las credenciales.
        assert!(!es_ruta_permitida("evil.com@api.steampowered.com/x"));
        assert!(!es_ruta_permitida("@evil.com/x"));

        // Barras invertidas, que algunos resolvers leen como separador.
        assert!(!es_ruta_permitida("evil.com\\@api.steampowered.com/x"));

        // Y las rutas local-files de Tauri, que serian un agujero gigante.
        assert!(!es_ruta_permitida("file:///etc/passwd"));
        assert!(!es_ruta_permitida("localhost:8080/x"));
    }
}