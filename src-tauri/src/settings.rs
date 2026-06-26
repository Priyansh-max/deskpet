//! Persisted settings — the single source of truth shared with the renderer.
//!
//! Mirrors the TypeScript `Settings` interface (camelCase on the wire). The
//! container-level `#[serde(default)]` makes every absent field fall back to
//! `Default`, so the original `prefs.json` (which only had `selected_pet`)
//! still deserializes cleanly and is then rewritten with the full schema.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Valid pet ids; mirrors `PETS` in `src/shared/types.ts`.
pub const PETS: [&str; 5] = ["cat", "dog", "horse", "bird", "fish"];

const SETTINGS_VERSION: u32 = 2;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub version: u32,
    /// `alias` matches the old snake_case key from the pre-2.0 prefs file.
    #[serde(alias = "selected_pet")]
    pub selected_pet: String,
    pub paused: bool,
    pub metric: String,
    pub show_label: bool,
    pub min_fps: f64,
    pub max_fps: f64,
    pub sensitivity: f64,
    pub show_background: bool,
    pub bg_color: String,
    pub opacity: f64,
    pub scale: f64,
    pub accent: String,
    pub autostart: bool,
    pub remember_pause: bool,
    pub hide_under_fullscreen: bool,
    pub edge_offset: f64,
    pub monitor: u32,
    pub alert_enabled: bool,
    pub cpu_alert_threshold: f64,
    pub ram_alert_threshold: f64,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            version: SETTINGS_VERSION,
            selected_pet: "cat".to_string(),
            paused: false,
            metric: "cpu".to_string(),
            show_label: true,
            min_fps: 3.0,
            max_fps: 18.0,
            sensitivity: 1.0,
            show_background: true,
            bg_color: "#000000".to_string(),
            opacity: 0.34,
            scale: 1.0,
            accent: "#ffffff".to_string(),
            autostart: false,
            remember_pause: true,
            hide_under_fullscreen: true,
            edge_offset: 300.0,
            monitor: 0,
            alert_enabled: true,
            cpu_alert_threshold: 90.0,
            ram_alert_threshold: 90.0,
        }
    }
}

impl Settings {
    /// Clamp numeric fields and reset invalid enum-like values to defaults.
    /// Run after loading and after every patch so the in-memory state and the
    /// file on disk are always valid.
    pub fn normalize(&mut self) {
        let d = Settings::default();
        self.version = SETTINGS_VERSION;
        if !PETS.contains(&self.selected_pet.as_str()) {
            self.selected_pet = d.selected_pet;
        }
        if !matches!(self.metric.as_str(), "cpu" | "ram" | "net") {
            self.metric = d.metric;
        }
        if !self.min_fps.is_finite() {
            self.min_fps = d.min_fps;
        }
        if !self.max_fps.is_finite() {
            self.max_fps = d.max_fps;
        }
        self.min_fps = self.min_fps.clamp(1.0, 60.0);
        self.max_fps = self.max_fps.clamp(self.min_fps, 60.0);
        self.sensitivity = clamp_finite(self.sensitivity, 0.2, 4.0, d.sensitivity);
        self.opacity = clamp_finite(self.opacity, 0.0, 1.0, d.opacity);
        self.scale = clamp_finite(self.scale, 0.6, 2.0, d.scale);
        self.edge_offset = clamp_finite(self.edge_offset, 0.0, 4000.0, d.edge_offset);
        self.cpu_alert_threshold =
            clamp_finite(self.cpu_alert_threshold, 0.0, 100.0, d.cpu_alert_threshold);
        self.ram_alert_threshold =
            clamp_finite(self.ram_alert_threshold, 0.0, 100.0, d.ram_alert_threshold);
        // `accent` is validated by the renderer; `monitor` is best-effort.
    }
}

fn clamp_finite(v: f64, lo: f64, hi: f64, fallback: f64) -> f64 {
    if v.is_finite() {
        v.clamp(lo, hi)
    } else {
        fallback
    }
}

/// A partial update. Every field is optional; `Option<T>` fields are treated as
/// absent (`None`) by serde when missing from the incoming JSON patch.
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SettingsPatch {
    pub selected_pet: Option<String>,
    pub paused: Option<bool>,
    pub metric: Option<String>,
    pub show_label: Option<bool>,
    pub min_fps: Option<f64>,
    pub max_fps: Option<f64>,
    pub sensitivity: Option<f64>,
    pub show_background: Option<bool>,
    pub bg_color: Option<String>,
    pub opacity: Option<f64>,
    pub scale: Option<f64>,
    pub accent: Option<String>,
    pub autostart: Option<bool>,
    pub remember_pause: Option<bool>,
    pub hide_under_fullscreen: Option<bool>,
    pub edge_offset: Option<f64>,
    pub monitor: Option<u32>,
    pub alert_enabled: Option<bool>,
    pub cpu_alert_threshold: Option<f64>,
    pub ram_alert_threshold: Option<f64>,
}

impl SettingsPatch {
    /// Apply present fields onto `s`, then re-normalize.
    pub fn merge_into(self, s: &mut Settings) {
        if let Some(v) = self.selected_pet {
            s.selected_pet = v;
        }
        if let Some(v) = self.paused {
            s.paused = v;
        }
        if let Some(v) = self.metric {
            s.metric = v;
        }
        if let Some(v) = self.show_label {
            s.show_label = v;
        }
        if let Some(v) = self.min_fps {
            s.min_fps = v;
        }
        if let Some(v) = self.max_fps {
            s.max_fps = v;
        }
        if let Some(v) = self.sensitivity {
            s.sensitivity = v;
        }
        if let Some(v) = self.show_background {
            s.show_background = v;
        }
        if let Some(v) = self.bg_color {
            s.bg_color = v;
        }
        if let Some(v) = self.opacity {
            s.opacity = v;
        }
        if let Some(v) = self.scale {
            s.scale = v;
        }
        if let Some(v) = self.accent {
            s.accent = v;
        }
        if let Some(v) = self.autostart {
            s.autostart = v;
        }
        if let Some(v) = self.remember_pause {
            s.remember_pause = v;
        }
        if let Some(v) = self.hide_under_fullscreen {
            s.hide_under_fullscreen = v;
        }
        if let Some(v) = self.edge_offset {
            s.edge_offset = v;
        }
        if let Some(v) = self.monitor {
            s.monitor = v;
        }
        if let Some(v) = self.alert_enabled {
            s.alert_enabled = v;
        }
        if let Some(v) = self.cpu_alert_threshold {
            s.cpu_alert_threshold = v;
        }
        if let Some(v) = self.ram_alert_threshold {
            s.ram_alert_threshold = v;
        }
        s.normalize();
    }
}

/// Read, validate, and rewrite the settings file (also upgrades the old prefs).
pub fn load_settings(path: &Path) -> Settings {
    let mut s = fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<Settings>(&raw).ok())
        .unwrap_or_default();
    s.normalize();
    save_settings(path, &s);
    s
}

pub fn save_settings(path: &Path, s: &Settings) {
    if let Ok(json) = serde_json::to_string_pretty(s) {
        let _ = fs::write(path, json);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Deserialize like the real load path, then normalize.
    fn parse(json: &str) -> Settings {
        let mut s: Settings = serde_json::from_str(json).expect("valid json");
        s.normalize();
        s
    }

    #[test]
    fn old_prefs_file_still_loads() {
        // The pre-2.0 file only had the snake_case `selected_pet` key.
        let s = parse(r#"{"selected_pet":"dog"}"#);
        assert_eq!(s.selected_pet, "dog");
        assert_eq!(s.version, SETTINGS_VERSION);
        // Everything else falls back to defaults.
        assert_eq!(s.metric, "cpu");
        assert!(s.show_label);
        assert_eq!(s.edge_offset, 300.0);
    }

    #[test]
    fn empty_object_is_all_defaults() {
        let s = parse("{}");
        let d = Settings::default();
        assert_eq!(s.selected_pet, d.selected_pet);
        assert_eq!(s.metric, d.metric);
        assert_eq!(s.edge_offset, d.edge_offset);
        assert_eq!(s.min_fps, d.min_fps);
    }

    #[test]
    fn invalid_enums_reset_to_defaults() {
        let s = parse(r#"{"selectedPet":"dragon","metric":"gpu"}"#);
        assert_eq!(s.selected_pet, "cat");
        assert_eq!(s.metric, "cpu");
    }

    #[test]
    fn numeric_fields_are_clamped() {
        let s = parse(r#"{"opacity":5.0,"scale":99.0,"edgeOffset":-50.0,"sensitivity":0.0}"#);
        assert_eq!(s.opacity, 1.0);
        assert_eq!(s.scale, 2.0);
        assert_eq!(s.edge_offset, 0.0);
        assert_eq!(s.sensitivity, 0.2);
    }

    #[test]
    fn max_fps_never_below_min_fps() {
        let s = parse(r#"{"minFps":10.0,"maxFps":4.0}"#);
        assert!(s.max_fps >= s.min_fps);
        assert_eq!(s.min_fps, 10.0);
        assert_eq!(s.max_fps, 10.0);
    }

    #[test]
    fn camelcase_round_trips() {
        let mut s = Settings::default();
        s.selected_pet = "fish".to_string();
        s.metric = "net".to_string();
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"selectedPet\":\"fish\""));
        assert!(json.contains("\"showLabel\""));
        let back = parse(&json);
        assert_eq!(back.selected_pet, "fish");
        assert_eq!(back.metric, "net");
    }

    #[test]
    fn patch_merges_only_present_fields_and_normalizes() {
        let mut s = Settings::default();
        let patch = SettingsPatch {
            metric: Some("ram".to_string()),
            opacity: Some(2.0), // out of range -> clamped
            selected_pet: Some("horse".to_string()),
            ..Default::default()
        };
        patch.merge_into(&mut s);
        assert_eq!(s.metric, "ram");
        assert_eq!(s.selected_pet, "horse");
        assert_eq!(s.opacity, 1.0);
        // Untouched fields keep their defaults.
        assert!(s.show_label);
        assert_eq!(s.edge_offset, 300.0);
    }
}
