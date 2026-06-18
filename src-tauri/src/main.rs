// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::time::Duration;
use sysinfo::System;
use tauri::Emitter;

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

/// Sample global CPU load once per second and push it to the renderer.
fn start_cpu_monitor(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut sys = System::new();
        sys.refresh_cpu_usage();
        loop {
            std::thread::sleep(Duration::from_millis(1000));
            sys.refresh_cpu_usage();
            let load = sys.global_cpu_usage() as f64;
            let _ = app.emit("cpu", load);
        }
    });
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_initial_state, open_menu])
        .setup(|app| {
            start_cpu_monitor(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running DeskPet");
}
