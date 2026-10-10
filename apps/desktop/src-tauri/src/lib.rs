//! Shell Tauri del gestor de keys.
//!
//! Reglas:
//! - La base de datos es SQLite (plugin `sql`) y vive en el directorio de
//!   configuracion de la app, nunca dentro del repositorio.
//! - El unico acceso a ficheros es a traves del dialogo nativo del usuario:
//!   `read_text_file` / `write_text_file` solo se ejecutan sobre rutas que el
//!   propio usuario acaba de elegir, asi que no hace falta el plugin `fs` con
//!   permisos amplios.

use std::fs;
use std::path::PathBuf;

/// Lectura de un fichero de texto elegido por el usuario en un dialogo nativo.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let target = PathBuf::from(path);

    if !target.is_file() {
        return Err(format!("No es un fichero: {}", target.display()));
    }

    fs::read_to_string(&target).map_err(|error| {
        format!(
            "No se pudo leer {}: {}",
            target.display(),
            error
        )
    })
}

/// Escritura de un fichero de texto en una ruta elegida por el usuario.
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let target = PathBuf::from(path);

    if let Some(parent) = target.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("No se pudo crear {}: {}", parent.display(), error)
            })?;
        }
    }

    fs::write(&target, contents)
        .map_err(|error| format!("No se pudo escribir {}: {}", target.display(), error))
}

/// Ruta de la base de datos, solo para mostrarla en la UI de ajustes.
#[tauri::command]
fn database_path(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("No se pudo resolver el directorio de la app: {}", error))?;

    Ok(dir.join("steam-keys.db").to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            database_path
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicacion");
}