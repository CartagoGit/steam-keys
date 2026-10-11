//! Shell Tauri del gestor de keys.
//!
//! Reglas de seguridad:
//! - La base de datos es SQLite (plugin `sql`) y vive en el directorio de
//!   configuracion de la app, nunca dentro del repositorio.
//! - El unico acceso a ficheros del usuario es a traves del dialogo nativo:
//!   `read_text_file` / `write_text_file` solo se ejecutan sobre rutas que el
//!   propio usuario acaba de elegir, asi que no hace falta el plugin `fs` con
//!   permisos amplios.
//! - Las copias de seguridad se mueven **solo** dentro del directorio de la
//!   app, y el nombre de fichero se valida para que no se pueda escapar de ahi.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::Manager;

/// Nombre del fichero de base de datos. Debe coincidir con `DB_CONNECTION`.
const DB_FILE_NAME: &str = "steam-keys.db";

/// Subdirectorio donde se guardan las copias de seguridad.
const BACKUP_DIR_NAME: &str = "backups";

/// Fichero temporal donde se deposita una copia para poder restaurarla.
const STAGED_FILE_NAME: &str = "restore-candidate.db";

/// Cuantas copias de seguridad se conservan como maximo.
const MAX_BACKUPS: usize = 10;

/// Una copia de seguridad, tal y como se la devuelve a la interfaz.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupInfo {
    name: String,
    path: String,
    size_bytes: u64,
    /// Epoch en milisegundos, para que lo formatee el frontend.
    created_at_ms: u128,
}

// ---------------------------------------------------------------------------
// Rutas internas
// ---------------------------------------------------------------------------

fn config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|error| format!("No se pudo resolver el directorio de la app: {error}"))
}

fn database_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(config_dir(app)?.join(DB_FILE_NAME))
}

fn backups_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(config_dir(app)?.join(BACKUP_DIR_NAME))
}

/// Epoch actual en milisegundos.
fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Convierte epoch en segundos a fecha civil UTC.
///
/// Implementa el algoritmo inverso de dias-desde-civil, para no arrastrar una
/// dependencia de fechas solo para nombrar un fichero.
fn civil_from_epoch(secs: i64) -> (i64, u32, u32, u32, u32, u32) {
    let days = secs.div_euclid(86_400);
    let rest = secs.rem_euclid(86_400);

    let hour = (rest / 3_600) as u32;
    let minute = ((rest % 3_600) / 60) as u32;
    let second = (rest % 60) as u32;

    // Dias desde 1970-01-01 a dias desde 0000-03-01.
    let shifted = days + 719_468;
    let era = if shifted >= 0 {
        shifted
    } else {
        shifted - 146_096
    } / 146_097;

    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;

    let day = (day_of_year - (153 * month_prime + 2) / 5 + 1) as u32;
    let month = if month_prime < 10 {
        month_prime + 3
    } else {
        month_prime - 9
    } as u32;

    if month <= 2 {
        year += 1;
    }

    (year, month, day, hour, minute, second)
}

/// Marca de tiempo legible para nombres de fichero: `20261010-153427`.
fn timestamp_label(secs: i64) -> String {
    let (year, month, day, hour, minute, second) = civil_from_epoch(secs);
    format!("{year:04}{month:02}{day:02}-{hour:02}{minute:02}{second:02}")
}

/// Deja solo `[a-z0-9-]` en un texto, para usarlo dentro de un nombre de fichero.
///
/// Los separadores (espacios, barras, puntos) se convierten en guion en lugar
/// de desaparecer: `"antes de importar"` produce `antes-de-importar` y no
/// `antesdeimportar`, que es mucho mas legible en un listado de copias.
fn sanitize(text: &str) -> String {
    let limpio: String = text
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect();

    // Colapsar guiones seguidos y recortar los sobrantes de los extremos.
    let colapsado: String = limpio
        .split('-')
        .filter(|trozo| !trozo.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    let recortado: String = colapsado.chars().take(24).collect();

    if recortado.is_empty() {
        "manual".to_string()
    } else {
        recortado
    }
}

/// Comprueba que un nombre de fichero es seguro y no escapa del directorio.
///
/// Es la unica defensa frente a `../`: sin esto, `list_backups` +
/// `stage_backup` permitirian tocar cualquier fichero del disco.
fn es_nombre_seguro(nombre: &str) -> bool {
    if nombre.is_empty() || nombre.len() > 120 {
        return false;
    }

    if !nombre.ends_with(".db") {
        return false;
    }

    if nombre.contains("..") {
        return false;
    }

    nombre
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

/// Epoch en milisegundos de un fichero, o el actual si no se puede leer.
fn created_ms(metadata: &fs::Metadata) -> u128 {
    metadata
        .created()
        .or(metadata.modified())
        .ok()
        .and_then(|tiempo| tiempo.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or_else(now_ms)
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
}

/// Ruta de la base de datos, para mostrarla en la UI.
#[tauri::command]
fn database_path(app: tauri::AppHandle) -> Result<String, String> {
    Ok(database_file(&app)?.to_string_lossy().to_string())
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
    })
}

// ---------------------------------------------------------------------------
// Copias de seguridad
// ---------------------------------------------------------------------------

/// Crea una copia de la base de datos dentro del directorio de la app.
///
/// `reason` solo se usa para nombrar la copia: se sanea antes de tocar el
/// sistema de ficheros, asi que no puede inyectar rutas.
#[tauri::command]
fn create_backup(app: tauri::AppHandle, reason: String) -> Result<BackupInfo, String> {
    let origen = database_file(&app)?;

    if !origen.is_file() {
        return Err("Todavia no hay base de datos que respaldar.".to_string());
    }

    let destino_dir = backups_dir(&app)?;
    fs::create_dir_all(&destino_dir)
        .map_err(|error| format!("No se pudo crear {}: {error}", destino_dir.display()))?;

    let segundos = (now_ms() / 1_000) as i64;
    let etiqueta = timestamp_label(segundos);
    let sufijo = sanitize(&reason);

    // Dos copias en el mismo segundo no pueden compartir nombre.
    let mut nombre = format!("steam-keys-{etiqueta}-{sufijo}.db");
    let mut intento = 2;
    while destino_dir.join(&nombre).exists() {
        nombre = format!("steam-keys-{etiqueta}-{sufijo}-{intento}.db");
        intento += 1;
    }

    let destino = destino_dir.join(&nombre);

    fs::copy(&origen, &destino).map_err(|error| {
        format!(
            "No se pudo copiar {} a {}: {error}",
            origen.display(),
            destino.display()
        )
    })?;

    rotar(&destino_dir);

    let metadata = fs::metadata(&destino).map_err(|error| error.to_string())?;

    Ok(BackupInfo {
        name: nombre,
        path: destino.to_string_lossy().to_string(),
        size_bytes: metadata.len(),
        created_at_ms: created_ms(&metadata),
    })
}

/// Lista las copias de seguridad, de la mas reciente a la mas antigua.
#[tauri::command]
fn list_backups(app: tauri::AppHandle) -> Result<Vec<BackupInfo>, String> {
    let dir = backups_dir(&app)?;

    if !dir.is_dir() {
        return Ok(Vec::new());
    }

    let entradas =
        fs::read_dir(&dir).map_err(|error| format!("No se pudo leer {}: {error}", dir.display()))?;

    let mut backups: Vec<BackupInfo> = entradas
        .filter_map(|entrada| {
            let entrada = entrada.ok()?;
            let nombre = entrada.file_name().to_string_lossy().to_string();

            if !es_nombre_seguro(&nombre) {
                return None;
            }

            let metadata = entrada.metadata().ok()?;

            Some(BackupInfo {
                name: nombre,
                path: entrada.path().to_string_lossy().to_string(),
                size_bytes: metadata.len(),
                created_at_ms: created_ms(&metadata),
            })
        })
        .collect();

    // El nombre empieza por la marca de tiempo, asi que ordenar por nombre es
    // equivalente a ordenar por fecha.
    backups.sort_by(|a, b| b.name.cmp(&a.name));

    Ok(backups)
}

/// Deja una copia preparada para que el frontend la pueda abrir con SQL.
///
/// No se copia encima de la base de datos viva: la app mantiene la conexion
/// abierta, y sustituir el fichero por debajo dejaria a SQLite con una
/// referencia obsoleta. En su lugar se deposita en el directorio de la app
/// como `restore-candidate.db`, y el frontend lo lee con su propia conexion y
/// fusiona las filas.
#[tauri::command]
fn stage_backup(app: tauri::AppHandle, name: String) -> Result<String, String> {
    if !es_nombre_seguro(&name) {
        return Err("Nombre de copia no valido.".to_string());
    }

    let origen = backups_dir(&app)?.join(&name);

    if !origen.is_file() {
        return Err(format!("La copia {name} ya no existe."));
    }

    let destino = config_dir(&app)?.join(STAGED_FILE_NAME);

    fs::copy(&origen, &destino)
        .map_err(|error| format!("No se pudo preparar la copia: {error}"))?;

    // Nombre relativo, que es como el plugin SQL resuelve las rutas.
    Ok(format!("sqlite:{STAGED_FILE_NAME}"))
}

/// Borra la copia preparada tras usarla.
#[tauri::command]
fn discard_staged_backup(app: tauri::AppHandle) -> Result<(), String> {
    let staged = config_dir(&app)?.join(STAGED_FILE_NAME);

    if staged.exists() {
        fs::remove_file(&staged)
            .map_err(|error| format!("No se pudo borrar la copia preparada: {error}"))?;
    }

    Ok(())
}

/// Borra una copia concreta del historial de respaldos.
#[tauri::command]
fn delete_backup(app: tauri::AppHandle, name: String) -> Result<(), String> {
    if !es_nombre_seguro(&name) {
        return Err("Nombre de copia no valido.".to_string());
    }

    let destino = backups_dir(&app)?.join(&name);

    if !destino.is_file() {
        return Err(format!("La copia {name} ya no existe."));
    }

    fs::remove_file(&destino).map_err(|error| format!("No se pudo borrar {name}: {error}"))
}

/// Conserva solo las `MAX_BACKUPS` copias mas recientes.
fn rotar(dir: &Path) {
    let Ok(entradas) = fs::read_dir(dir) else {
        return;
    };

    let mut nombres: Vec<String> = entradas
        .filter_map(|entrada| {
            let nombre = entrada.ok()?.file_name().to_string_lossy().to_string();

            if es_nombre_seguro(&nombre) {
                Some(nombre)
            } else {
                None
            }
        })
        .collect();

    if nombres.len() <= MAX_BACKUPS {
        return;
    }

    nombres.sort();
    nombres.reverse();

    for sobra in nombres.into_iter().skip(MAX_BACKUPS) {
        let _ = fs::remove_file(dir.join(sobra));
    }
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
            database_info,
            create_backup,
            list_backups,
            stage_backup,
            discard_staged_backup,
            delete_backup
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicacion");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn el_nombre_de_copia_debe_ser_seguro() {
        assert!(es_nombre_seguro("steam-keys-20261010-153427-manual.db"));
        assert!(es_nombre_seguro("copia-2.db"));

        // Escapes de directorio.
        assert!(!es_nombre_seguro("../../etc/passwd"));
        assert!(!es_nombre_seguro("..\\..\\windows\\system32"));
        assert!(!es_nombre_seguro("cosas/../otra.db"));
        assert!(!es_nombre_seguro(".."));

        // Extension y formato.
        assert!(!es_nombre_seguro("notas.txt"));
        assert!(!es_nombre_seguro(""));
        assert!(!es_nombre_seguro("con espacio.db"));
    }

    #[test]
    fn la_marca_de_tiempo_usa_formato_compacto() {
        // Los valores esperados se sacaron de `date -u -d @<epoch>`.
        assert_eq!(timestamp_label(1_789_566_867), "20260916-135427");
        assert_eq!(timestamp_label(0), "19700101-000000");
    }

    #[test]
    fn las_fechas_civiles_son_correctas() {
        assert_eq!(civil_from_epoch(0), (1970, 1, 1, 0, 0, 0));
        assert_eq!(civil_from_epoch(1_789_566_867), (2026, 9, 16, 13, 54, 27));

        // Cruce de ano, en las dos direcciones.
        assert_eq!(civil_from_epoch(1_735_689_600), (2025, 1, 1, 0, 0, 0));
        assert_eq!(civil_from_epoch(1_735_689_599), (2024, 12, 31, 23, 59, 59));

        // 2000 es bisiesto: el 29 de febrero tiene que existir.
        assert_eq!(civil_from_epoch(951_782_400), (2000, 2, 29, 0, 0, 0));

        // Epoch negativo, para que el algoritmo no falle antes de 1970.
        assert_eq!(civil_from_epoch(-1), (1969, 12, 31, 23, 59, 59));
    }

    #[test]
    fn el_sufijo_se_sanea() {
        // Los separadores se convierten en guion, no desaparecen.
        assert_eq!(sanitize("Antes de importar"), "antes-de-importar");
        assert_eq!(sanitize("con/caracteres:raros"), "con-caracteres-raros");

        // Ni espacios repetidos ni guiones de sobra.
        assert_eq!(sanitize("  doble  espacio  "), "doble-espacio");
        assert_eq!(sanitize("a---b"), "a-b");

        // Recorte a 24 caracteres.
        assert_eq!(sanitize("abcdefghijklmnopqrstuvwxyz012345").len(), 24);

        // Sin nada aprovechable.
        assert_eq!(sanitize(""), "manual");
        assert_eq!(sanitize("!!!"), "manual");
        assert_eq!(sanitize("///"), "manual");
    }

    #[test]
    fn las_rutas_de_steam_pasan_el_filtro() {
        assert!(es_ruta_permitida("api.steampowered.com/ISteamUser/GetOwnedGames"));
        assert!(es_ruta_permitida("steamcommunity.com/id/cartagonova/?xml=1"));

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