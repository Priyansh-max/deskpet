//! Once-per-second system metrics (CPU, RAM, network) broadcast to all windows
//! as a single `metrics` event.

use serde::Serialize;
use std::time::Duration;
use sysinfo::{Networks, System};
use tauri::{AppHandle, Emitter};

/// Mirrors the TypeScript `Metrics` interface (camelCase on the wire).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Metrics {
    pub cpu: f64,
    pub ram_used: f64,
    pub ram_total: f64,
    pub ram_pct: f64,
    pub net_down: f64,
    pub net_up: f64,
}

/// Sample CPU, memory, and network once per second and emit `metrics`.
///
/// sysinfo needs two CPU samples to report a non-zero load, so the first tick
/// after startup may read 0%. Network `received`/`transmitted` are deltas since
/// the previous refresh; at a steady 1 Hz cadence they approximate bytes/sec.
pub fn start_metrics(app: AppHandle) {
    std::thread::spawn(move || {
        let mut sys = System::new();
        sys.refresh_cpu_usage();
        sys.refresh_memory();
        let mut networks = Networks::new_with_refreshed_list();

        loop {
            std::thread::sleep(Duration::from_millis(1000));
            sys.refresh_cpu_usage();
            sys.refresh_memory();
            networks.refresh();

            let ram_total = sys.total_memory() as f64;
            let ram_used = sys.used_memory() as f64;
            let (down, up) = networks.iter().fold((0u64, 0u64), |(d, u), (_, data)| {
                (d + data.received(), u + data.transmitted())
            });

            let metrics = Metrics {
                cpu: sys.global_cpu_usage() as f64,
                ram_used,
                ram_total,
                ram_pct: if ram_total > 0.0 {
                    ram_used / ram_total * 100.0
                } else {
                    0.0
                },
                net_down: down as f64,
                net_up: up as f64,
            };
            let _ = app.emit("metrics", metrics);
        }
    });
}
