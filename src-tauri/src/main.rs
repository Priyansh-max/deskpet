// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;

#[derive(Serialize)]
struct InitialState {
    #[serde(rename = "selectedPet")]
    selected_pet: String,
    paused: bool,
}

#[tauri::command]
fn get_initial_state() -> InitialState {
    InitialState {
        selected_pet: "cat".to_string(),
        paused: false,
    }
}

#[tauri::command]
fn open_menu() {}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_initial_state, open_menu])
        .run(tauri::generate_context!())
        .expect("error while running DeskPet");
}
