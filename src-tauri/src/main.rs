// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use sysinfo::System;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State, Wry};

#[cfg(windows)]
mod win;

/// Distance (logical px) the chip keeps from the tray end of the taskbar.
const EDGE_OFFSET: f64 = 300.0;

const PETS: [(&str, &str); 5] = [
    ("cat", "Cat"),
    ("dog", "Dog"),
    ("horse", "Horse"),
    ("bird", "Bird"),
    ("fish", "Fish"),
];

#[derive(Serialize)]
struct InitialState {
    #[serde(rename = "selectedPet")]
    selected_pet: String,
    paused: bool,
}

#[derive(Serialize, Deserialize, Default)]
struct Prefs {
    selected_pet: Option<String>,
}

struct AppState {
    selected_pet: Mutex<String>,
    paused: Mutex<bool>,
    menu: Menu<Wry>,
    pet_items: Vec<(String, CheckMenuItem<Wry>)>,
    pause_item: CheckMenuItem<Wry>,
    config_path: PathBuf,
}

fn load_pref(path: &PathBuf) -> String {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str::<Prefs>(&s).ok())
        .and_then(|p| p.selected_pet)
        .filter(|p| PETS.iter().any(|(id, _)| id == p))
        .unwrap_or_else(|| "cat".to_string())
}

fn save_pref(path: &PathBuf, pet: &str) {
    let prefs = Prefs {
        selected_pet: Some(pet.to_string()),
    };
    if let Ok(json) = serde_json::to_string(&prefs) {
        let _ = fs::write(path, json);
    }
}

#[tauri::command]
fn get_initial_state(state: State<AppState>) -> InitialState {
    InitialState {
        selected_pet: state.selected_pet.lock().unwrap().clone(),
        paused: *state.paused.lock().unwrap(),
    }
}

#[tauri::command]
fn open_menu(window: tauri::WebviewWindow, state: State<AppState>) {
    let _ = window.popup_menu(&state.menu);
}

fn select_pet(app: &AppHandle, pet: &str) {
    let state = app.state::<AppState>();
    {
        let mut sel = state.selected_pet.lock().unwrap();
        if *sel == pet {
            return;
        }
        *sel = pet.to_string();
    }
    save_pref(&state.config_path, pet);
    for (id, item) in &state.pet_items {
        let _ = item.set_checked(id == pet);
    }
    let _ = app.emit("pet", pet.to_string());
}

fn toggle_pause(app: &AppHandle) {
    let state = app.state::<AppState>();
    let paused = {
        let mut p = state.paused.lock().unwrap();
        *p = !*p;
        *p
    };
    let _ = state.pause_item.set_checked(paused);
    let _ = app.emit("pause", paused);
}

fn handle_menu(app: &AppHandle, id: &str) {
    match id {
        "quit" => app.exit(0),
        "pause" => toggle_pause(app),
        other => {
            if let Some(pet) = other.strip_prefix("pet:") {
                select_pet(app, pet);
            }
        }
    }
}

/// Place the chip in the taskbar band, near the system-tray end.
#[cfg(windows)]
fn position_chip(window: &tauri::WebviewWindow) {
    if let Some(tb) = win::taskbar_rect() {
        let scale = window.scale_factor().unwrap_or(1.0);
        let width = window.outer_size().map(|s| s.width as i32).unwrap_or(160);
        let offset = (EDGE_OFFSET * scale) as i32;
        let x = tb.right - offset - width;
        let _ = window.set_position(tauri::PhysicalPosition::new(x, tb.top));
    }
}

/// Keep the chip above the taskbar (which jumps above us when clicked) and hide
/// it under genuine fullscreen apps — mirroring taskbar behaviour.
#[cfg(windows)]
fn start_keep_alive(window: tauri::WebviewWindow) {
    std::thread::spawn(move || {
        let mut hidden = false;
        loop {
            std::thread::sleep(Duration::from_millis(350));
            let raw = match window.hwnd() {
                Ok(h) => h.0 as isize,
                Err(_) => continue,
            };
            let hwnd = win::hwnd_from_raw(raw);
            let (mw, mh) = window
                .primary_monitor()
                .ok()
                .flatten()
                .map(|m| (m.size().width as i32, m.size().height as i32))
                .unwrap_or((i32::MAX, i32::MAX));

            let fullscreen = win::is_foreground_fullscreen(hwnd, mw, mh);
            if fullscreen && !hidden {
                hidden = true;
                let _ = window.hide();
            } else if !fullscreen && hidden {
                hidden = false;
                let _ = window.show();
                win::set_topmost(hwnd);
            } else if !fullscreen {
                win::set_topmost(hwnd);
            }
        }
    });
}

fn start_cpu_monitor(app: AppHandle) {
    std::thread::spawn(move || {
        let mut sys = System::new();
        sys.refresh_cpu_usage();
        loop {
            std::thread::sleep(Duration::from_millis(1000));
            sys.refresh_cpu_usage();
            let _ = app.emit("cpu", sys.global_cpu_usage() as f64);
        }
    });
}

fn build_tray(app: &AppHandle, selected: &str) -> tauri::Result<AppState> {
    let mut pet_items: Vec<(String, CheckMenuItem<Wry>)> = Vec::new();
    for (id, label) in PETS.iter() {
        let item = CheckMenuItem::with_id(app, format!("pet:{id}"), *label, true, *id == selected, None::<&str>)?;
        pet_items.push((id.to_string(), item));
    }
    let pet_refs: Vec<&dyn IsMenuItem<Wry>> = pet_items.iter().map(|(_, i)| i as &dyn IsMenuItem<Wry>).collect();
    let change_pet = Submenu::with_items(app, "Change Pet", true, &pet_refs)?;
    let pause_item = CheckMenuItem::with_id(app, "pause", "Pause Animation", true, false, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&change_pet, &pause_item, &sep, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().unwrap())
        .tooltip("DeskPet")
        .menu(&menu)
        .on_menu_event(|app, event| handle_menu(app, event.id.as_ref()))
        .build(app)?;

    Ok(AppState {
        selected_pet: Mutex::new(selected.to_string()),
        paused: Mutex::new(false),
        menu,
        pet_items,
        pause_item,
        config_path: PathBuf::new(),
    })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_initial_state, open_menu])
        // Handles events from the chip's popup menu (the tray menu uses the
        // tray's own handler).
        .on_menu_event(|app, event| handle_menu(app, event.id.as_ref()))
        .setup(|app| {
            let handle = app.handle().clone();

            let config_dir = handle.path().app_config_dir().unwrap_or_else(|_| PathBuf::from("."));
            let _ = fs::create_dir_all(&config_dir);
            let config_path = config_dir.join("prefs.json");
            let selected = load_pref(&config_path);

            let mut state = build_tray(&handle, &selected)?;
            state.config_path = config_path;
            app.manage(state);

            #[cfg(windows)]
            if let Some(window) = handle.get_webview_window("main") {
                position_chip(&window);
                start_keep_alive(window);
            }

            start_cpu_monitor(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running DeskPet");
}
