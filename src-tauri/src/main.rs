// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, Wry};

mod metrics;
mod settings;
#[cfg(windows)]
mod win;

use settings::{load_settings, save_settings, Settings, SettingsPatch};

const PETS: [(&str, &str); 5] = [
    ("cat", "Cat"),
    ("dog", "Dog"),
    ("horse", "Horse"),
    ("bird", "Bird"),
    ("fish", "Fish"),
];

/// Base chip width (logical px), sized for the labelled worst case ("CPU 100%");
/// the network readout ("↓99.9M ↑99.9M") needs more room. Extra width is just
/// transparent margin around the pill. Multiplied by the UI scale.
#[cfg(windows)]
const CHIP_WIDTH_PCT: f64 = 140.0;
#[cfg(windows)]
const CHIP_WIDTH_NET: f64 = 212.0;
/// Reposition only when the chip drifts past this many physical px, so the
/// periodic re-assert never flickers or fights the user/compositor.
#[cfg(windows)]
const DRIFT_PX: i32 = 2;

struct AppState {
    settings: Mutex<Settings>,
    menu: Menu<Wry>,
    pet_items: Vec<(String, CheckMenuItem<Wry>)>,
    config_path: PathBuf,
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> Settings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn update_settings(app: AppHandle, patch: SettingsPatch) {
    apply_patch(&app, patch);
}

#[tauri::command]
fn open_menu(window: tauri::WebviewWindow, state: State<AppState>) {
    // Anchor at the chip's top edge so the menu opens upward, above the chip,
    // instead of at the cursor (which overlaps the chip).
    let _ = window.popup_menu_at(&state.menu, tauri::LogicalPosition::new(0.0, 0.0));
}

#[tauri::command]
fn open_settings(app: AppHandle) {
    open_settings_window(&app);
}

/// Open a URL in the default browser. Used by the settings "About" tab; avoids
/// pulling in a shell/opener plugin for a couple of static links.
#[tauri::command]
fn open_url(url: String) {
    #[cfg(windows)]
    {
        // `cmd /C start "" <url>` hands the URL to the default protocol handler.
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn();
    }
    #[cfg(not(windows))]
    {
        let _ = url;
    }
}

/// The single funnel for every settings mutation (settings window, tray menu,
/// chip popup). Persists, re-syncs the tray, applies side effects, and
/// broadcasts the new state so both windows reconcile from one source of truth.
fn apply_patch(app: &AppHandle, patch: SettingsPatch) {
    let state = app.state::<AppState>();
    let (before, after) = {
        let mut s = state.settings.lock().unwrap();
        let before = s.clone();
        patch.merge_into(&mut s);
        (before, s.clone())
    };

    save_settings(&state.config_path, &after);
    sync_tray(state.inner(), &after);

    if before.autostart != after.autostart {
        set_autostart(after.autostart);
    }

    #[cfg(windows)]
    if needs_relayout(&before, &after) {
        if let Some(window) = app.get_webview_window("main") {
            relayout_chip(&window, &after);
        }
    }

    let _ = app.emit("settings", after);
}

/// Keep the tray menu's pet checkmarks in sync with settings.
fn sync_tray(state: &AppState, s: &Settings) {
    for (id, item) in &state.pet_items {
        let _ = item.set_checked(id == &s.selected_pet);
    }
}

/// Reconcile the OS launch-at-login entry with the preference. No-op off Windows.
fn set_autostart(enabled: bool) {
    #[cfg(windows)]
    {
        win::set_autostart(enabled);
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
    }
}

fn select_pet(app: &AppHandle, pet: &str) {
    apply_patch(
        app,
        SettingsPatch {
            selected_pet: Some(pet.to_string()),
            ..Default::default()
        },
    );
}

fn handle_menu(app: &AppHandle, id: &str) {
    match id {
        "quit" => app.exit(0),
        "settings" => open_settings_window(app),
        other => {
            if let Some(pet) = other.strip_prefix("pet:") {
                select_pet(app, pet);
            }
        }
    }
}

/// Open the settings window, focusing the existing one if it's already open.
fn open_settings_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
        .title("DeskPet Settings")
        .inner_size(720.0, 500.0)
        .min_inner_size(640.0, 440.0)
        .resizable(true)
        .center()
        .build();
}

/// Whether a settings change affects the chip's size or placement.
#[cfg(windows)]
#[allow(clippy::float_cmp)]
fn needs_relayout(a: &Settings, b: &Settings) -> bool {
    a.metric != b.metric
        || a.scale != b.scale
        || a.edge_offset != b.edge_offset
        || a.monitor != b.monitor
}

#[cfg(windows)]
struct ChipLayout {
    width_logical: f64,
    height_logical: f64,
    width_physical: i32,
    height_physical: i32,
    x: i32,
    y: i32,
}

#[cfg(windows)]
fn chip_logical_width(settings: &Settings) -> f64 {
    let base = if settings.metric == "net" {
        CHIP_WIDTH_NET
    } else {
        CHIP_WIDTH_PCT
    };
    base * settings.scale
}

/// Compute the chip's target size + position from the *live* taskbar geometry.
/// Recomputed every tick (never cached) so DPI/resolution/taskbar changes are
/// picked up automatically. The chip sits at the tray end of the taskbar band,
/// `edge_offset` logical px in, and is sized to the band's thickness.
#[cfg(windows)]
fn compute_layout(window: &tauri::WebviewWindow, settings: &Settings) -> Option<ChipLayout> {
    let tb = win::taskbar_rect_for(settings.monitor)?;
    let scale = window.scale_factor().unwrap_or(1.0);
    let width_logical = chip_logical_width(settings);
    let width_physical = (width_logical * scale) as i32;
    let height_physical = tb.bottom - tb.top;
    let offset = (settings.edge_offset * scale) as i32;
    Some(ChipLayout {
        width_logical,
        height_logical: height_physical as f64 / scale,
        width_physical,
        height_physical,
        x: tb.right - offset - width_physical,
        y: tb.top,
    })
}

/// Resize then reposition together — `x` depends on the width, so a width change
/// (metric=net, scale) must move the chip in the same pass to avoid a jump.
#[cfg(windows)]
fn relayout_chip(window: &tauri::WebviewWindow, settings: &Settings) {
    if let Some(l) = compute_layout(window, settings) {
        let _ = window.set_size(tauri::LogicalSize::new(l.width_logical, l.height_logical));
        let _ = window.set_position(tauri::PhysicalPosition::new(l.x, l.y));
    }
}

/// Re-assert the chip's size and position when either has drifted (or when
/// forced, e.g. after leaving fullscreen). This is the fix for the
/// random-reposition bug. Size is re-asserted too so a DPI/taskbar-thickness
/// change that happens off the relayout path still self-heals each tick.
#[cfg(windows)]
fn reassert_layout(window: &tauri::WebviewWindow, settings: &Settings, force: bool) {
    let Some(l) = compute_layout(window, settings) else {
        return;
    };
    let size_drifted = match window.outer_size() {
        Ok(sz) => {
            (sz.width as i32 - l.width_physical).abs() > DRIFT_PX
                || (sz.height as i32 - l.height_physical).abs() > DRIFT_PX
        }
        Err(_) => true,
    };
    // Size first: x already accounts for the (new) width, so set size then move.
    if force || size_drifted {
        let _ = window.set_size(tauri::LogicalSize::new(l.width_logical, l.height_logical));
    }
    let pos_drifted = match window.outer_position() {
        Ok(pos) => (pos.x - l.x).abs() > DRIFT_PX || (pos.y - l.y).abs() > DRIFT_PX,
        Err(_) => true,
    };
    if force || pos_drifted {
        let _ = window.set_position(tauri::PhysicalPosition::new(l.x, l.y));
    }
}

/// Keep the chip above the taskbar (which jumps above us when clicked), hide it
/// under genuine fullscreen apps, and keep it pinned to the correct taskbar
/// position even as the taskbar geometry changes.
#[cfg(windows)]
fn start_window_manager(app: AppHandle) {
    std::thread::spawn(move || {
        let mut hidden = false;
        loop {
            std::thread::sleep(Duration::from_millis(350));
            let window = match app.get_webview_window("main") {
                Some(w) => w,
                None => continue,
            };
            let raw = match window.hwnd() {
                Ok(h) => h.0 as isize,
                Err(_) => continue,
            };
            let hwnd = win::hwnd_from_raw(raw);

            let settings = { app.state::<AppState>().settings.lock().unwrap().clone() };

            // Detect fullscreen relative to the monitor the chip actually lives
            // on, so a fullscreen app on another monitor doesn't hide the chip
            // (and resolution differences between monitors are handled).
            let fullscreen = settings.hide_under_fullscreen
                && window
                    .current_monitor()
                    .ok()
                    .flatten()
                    .map(|m| {
                        let p = m.position();
                        let s = m.size();
                        win::foreground_covers(
                            hwnd,
                            p.x,
                            p.y,
                            p.x + s.width as i32,
                            p.y + s.height as i32,
                        )
                    })
                    .unwrap_or(false);

            if fullscreen && !hidden {
                hidden = true;
                let _ = window.hide();
            } else if !fullscreen && hidden {
                hidden = false;
                let _ = window.show();
                win::set_topmost(hwnd);
                reassert_layout(&window, &settings, true);
            } else if !hidden {
                win::set_topmost(hwnd);
                reassert_layout(&window, &settings, false);
            }
        }
    });
}

fn build_tray(app: &AppHandle, settings: &Settings) -> tauri::Result<AppState> {
    let mut pet_items: Vec<(String, CheckMenuItem<Wry>)> = Vec::new();
    for (id, label) in PETS.iter() {
        let item = CheckMenuItem::with_id(
            app,
            format!("pet:{id}"),
            *label,
            true,
            *id == settings.selected_pet.as_str(),
            None::<&str>,
        )?;
        pet_items.push((id.to_string(), item));
    }
    let pet_refs: Vec<&dyn IsMenuItem<Wry>> = pet_items
        .iter()
        .map(|(_, i)| i as &dyn IsMenuItem<Wry>)
        .collect();
    let change_pet = Submenu::with_items(app, "Change Pet", true, &pet_refs)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&change_pet, &settings_item, &sep, &quit])?;

    // Menu events (tray and chip popup) are handled by the global
    // Builder::on_menu_event so each event fires exactly once.
    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().unwrap())
        .tooltip("DeskPet")
        .menu(&menu)
        .build(app)?;

    Ok(AppState {
        settings: Mutex::new(settings.clone()),
        menu,
        pet_items,
        config_path: PathBuf::new(),
    })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_settings,
            update_settings,
            open_menu,
            open_settings,
            open_url
        ])
        // Handles events from the chip's popup menu and the tray menu so each
        // fires exactly once.
        .on_menu_event(|app, event| handle_menu(app, event.id.as_ref()))
        .setup(|app| {
            let handle = app.handle().clone();

            let config_dir = handle
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            let _ = fs::create_dir_all(&config_dir);
            let config_path = config_dir.join("prefs.json");

            let mut settings = load_settings(&config_path);
            if !settings.remember_pause {
                settings.paused = false;
            }

            let mut state = build_tray(&handle, &settings)?;
            state.config_path = config_path;
            app.manage(state);

            // Keep the OS autostart entry in step with the saved preference (and
            // pointed at the current exe, which matters after an update).
            set_autostart(settings.autostart);

            #[cfg(windows)]
            if let Some(window) = handle.get_webview_window("main") {
                relayout_chip(&window, &settings);
                start_window_manager(handle.clone());
            }

            metrics::start_metrics(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running DeskPet");
}
