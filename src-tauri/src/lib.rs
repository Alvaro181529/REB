use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{State, Manager};
use std::fs;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ExcelFile {
    id: String,
    name: String,
    columns: String, // Guardado como JSON string
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ExcelRow {
    file_id: String,
    data: String, // Guardado como JSON string
}

pub struct DbState(Mutex<Connection>);

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hola, {}! Los datos ahora son persistentes.", name)
}

#[tauri::command]
fn save_excel_data(
    state: State<DbState>,
    name: String,
    columns: Vec<String>,
    data: serde_json::Value,
) -> Result<String, String> {
    let mut conn = state.0.lock().unwrap();
    let file_id = uuid::Uuid::new_v4().to_string();
    let columns_json = serde_json::to_string(&columns).unwrap();

    // Iniciar una transacción
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    {
        // Guardar metadata del archivo dentro de la transacción
        tx.execute(
            "INSERT INTO files (id, name, columns) VALUES (?1, ?2, ?3)",
            params![file_id, name, columns_json],
        )
        .map_err(|e| e.to_string())?;

        // Guardar las filas eficientemente
        if let Some(rows) = data.as_array() {
            let mut stmt = tx.prepare("INSERT INTO file_rows (file_id, data) VALUES (?1, ?2)")
                .map_err(|e| e.to_string())?;
            
            for row in rows {
                let row_json = serde_json::to_string(row).unwrap();
                stmt.execute(params![file_id, row_json])
                    .map_err(|e| e.to_string())?;
            }
        }
    }

    // Confirmar la transacción
    tx.commit().map_err(|e| e.to_string())?;

    Ok(format!("Archivo '{}' guardado con éxito con {} filas", name, data.as_array().map(|a| a.len()).unwrap_or(0)))
}

#[tauri::command]
fn get_all_files(state: State<DbState>) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, columns FROM files")
        .map_err(|e| e.to_string())?;
    
    let file_iter = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let columns_json: String = row.get(2)?;
            let columns: Vec<String> = serde_json::from_str(&columns_json).unwrap_or_default();
            
            // También obtenemos las filas para este archivo
            // Nota: En una app real, podrías querer cargar esto bajo demanda
            Ok(serde_json::json!({
                "id": id,
                "name": name,
                "columns": columns,
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut files = Vec::new();
    for file in file_iter {
        files.push(file.map_err(|e| e.to_string())?);
    }
    Ok(files)
}

#[tauri::command]
fn get_file_rows(state: State<DbState>, file_id: String) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT data FROM file_rows WHERE file_id = ?1")
        .map_err(|e| e.to_string())?;
    
    let row_iter = stmt
        .query_map(params![file_id], |row| {
            let data_json: String = row.get(0)?;
            let data: serde_json::Value = serde_json::from_str(&data_json).unwrap_or_default();
            Ok(data)
        })
        .map_err(|e| e.to_string())?;

    let mut rows = Vec::new();
    for row in row_iter {
        rows.push(row.map_err(|e| e.to_string())?);
    }
    Ok(rows)
}

#[tauri::command]
fn delete_file(state: State<DbState>, file_id: String) -> Result<String, String> {
    let mut conn = state.0.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    {
        tx.execute("DELETE FROM file_rows WHERE file_id = ?1", params![file_id])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM files WHERE id = ?1", params![file_id])
            .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(format!("Archivo eliminado exitosamente"))
}

#[tauri::command]
fn save_disability(state: State<DbState>, data: serde_json::Value) -> Result<String, String> {
    let conn = state.0.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let data_json = serde_json::to_string(&data).unwrap();

    conn.execute(
        "INSERT INTO disabilities (id, data) VALUES (?1, ?2)",
        params![id, data_json],
    )
    .map_err(|e| e.to_string())?;

    Ok(format!("Planilla guardada correctamente"))
}

#[tauri::command]
fn get_all_disabilities(state: State<DbState>) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, data FROM disabilities")
        .map_err(|e| e.to_string())?;
    
    let iter = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let data_json: String = row.get(1)?;
            let mut data: serde_json::Value = serde_json::from_str(&data_json).unwrap_or_default();
            // Inyectamos el ID en el objeto JSON para facilitar el manejo en el frontend
            if let Some(obj) = data.as_object_mut() {
                obj.insert("id".to_string(), serde_json::json!(id));
            }
            Ok(data)
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in iter {
        list.push(item.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
fn delete_disability(state: State<DbState>, id: String) -> Result<String, String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM disabilities WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(format!("Planilla eliminada"))
}

#[tauri::command]
fn update_disability(state: State<DbState>, id: String, data: serde_json::Value) -> Result<String, String> {
    let conn = state.0.lock().unwrap();
    let data_json = serde_json::to_string(&data).map_err(|e| e.to_string())?;
    let rows_affected = conn.execute(
        "UPDATE disabilities SET data = ?1 WHERE id = ?2",
        params![data_json, id],
    )
    .map_err(|e| e.to_string())?;
    if rows_affected == 0 {
        return Err(format!("No se encontró la planilla con id {}", id));
    }
    Ok(format!("Planilla actualizada correctamente"))
}

#[tauri::command]
fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Error al leer el archivo {}: {}", path, e))
}

#[tauri::command]
fn save_file_binary(path: String, contents: Vec<u8>) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("Error al guardar el archivo en {}: {}", path, e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Obtener el directorio de datos de la aplicación de forma dinámica
            let handle = app.handle();
            let mut db_path = handle.path().app_data_dir().expect("No se pudo obtener el directorio de datos");
            
            // Asegurarse de que el directorio exista
            fs::create_dir_all(&db_path).expect("No se pudo crear el directorio de base de datos");
            
            // Nombre del archivo de base de datos
            db_path.push("reb_database.db");
            
            let conn = Connection::open(db_path).expect("No se pudo abrir la base de datos");
            
            conn.execute(
                "CREATE TABLE IF NOT EXISTS files (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    columns TEXT NOT NULL
                )",
                [],
            ).expect("Error al crear tabla files");

            conn.execute(
                "CREATE TABLE IF NOT EXISTS file_rows (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id TEXT NOT NULL,
                    data TEXT NOT NULL,
                    FOREIGN KEY(file_id) REFERENCES files(id)
                )",
                [],
            ).expect("Error al crear tabla file_rows");

            conn.execute(
                "CREATE TABLE IF NOT EXISTS disabilities (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                )",
                [],
            ).expect("Error al crear tabla disabilities");

            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet, 
            save_excel_data, 
            get_all_files,
            get_file_rows,
            delete_file,
            save_disability,
            get_all_disabilities,
            delete_disability,
            update_disability,
            read_file_binary,
            save_file_binary
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
