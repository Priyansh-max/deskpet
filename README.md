<div align="center">

<h1>🐾 DeskPet</h1>

<p><b>A lightweight desktop companion that lives in your Windows taskbar and runs faster as your CPU heats up.</b></p>

<p><i>Idle → a slow stroll · Heavy load → full zoom — your PC activity, at a glance.</i><br/>
Inspired by <a href="https://kyome.io/runcat/"><i>RunCat</i></a>.</p>

<p>
  <a href="https://github.com/Priyansh-max/deskpet/releases/download/v1.1.0/DeskPet_1.1.0_x64-setup.exe">
    <img src="https://img.shields.io/badge/Download-Windows%2010%20%7C%2011-2ea44f?style=for-the-badge&logo=windows&logoColor=white" alt="Download DeskPet for Windows" height="40">
  </a>
</p>

<p>
  <img src="https://img.shields.io/badge/version-1.1.0-4c9aff?style=flat-square" alt="Version 1.1.0">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License: Apache 2.0"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6?style=flat-square&logo=windows&logoColor=white" alt="Platform: Windows 10 | 11">
</p>

<p>
  <img src="https://img.shields.io/badge/Tauri_2-24C8DB?style=flat-square&logo=tauri&logoColor=white" alt="Tauri 2">
  <img src="https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
</p>

</div>

---

## ⬇️ Download

| File | Size | Architecture | Windows |
| :--- | :--- | :--- | :--- |
| **[DeskPet_1.1.0_x64-setup.exe ↓](https://github.com/Priyansh-max/deskpet/releases/download/v1.1.0/DeskPet_1.1.0_x64-setup.exe)** | ~2 MB | x64 (64-bit) | 10 · 11 |

> Built with **Tauri** (uses the built-in WebView2 instead of bundling a browser), so the installer is only **~2 MB**.
> See all builds on the [Releases page](https://github.com/Priyansh-max/deskpet/releases).
> Not code-signed yet, so SmartScreen may warn on first launch — click **More info → Run anyway**.

## ✨ Features

- 🐾 Lives **inside the taskbar** as a small chip — your pet plus a live system readout.
- ⚡ **Animation speed scales with CPU load** — idle strolls, heavy load zooms. The speed range and ramp (sensitivity) are adjustable.
- 📊 **Choose what the chip shows** — CPU %, RAM %, or live **network** throughput (↓ download / ↑ upload), with an optional text label.
- 🚨 **Load alerts** — the readout pulses and the pet glows when the shown metric crosses a threshold (independent CPU and RAM thresholds).
- 🐱 **Five pets** — Cat, Dog, Horse, Bird, Fish.
- ⚙️ **Settings window** — a tabbed window (opened from the chip menu) for Pet, Readout, Animation, Appearance, Startup, and About.
- 🎨 **Appearance** — transparent or custom-coloured pill, opacity, chip size, and an accent colour for the readout.
- 🚀 **Launch at login**, remember pause state, and hide-under-fullscreen — all toggleable.
- 🖥️ Stays pinned beside the system tray and **hides under fullscreen apps** — behaves like a native taskbar element, and returns to place even after DPI/resolution changes.
- 💾 All settings **persist** across restarts.

## 🖱️ Using it

- **Click the chip** for the menu: **Change Pet**, **Settings…**, **Quit**.
- Everything else — metric, animation speed, alerts, appearance, pause, and autostart — lives in **Settings…**.

## Tech Stack

- **Tauri 2** + **Rust** — native shell that uses the system **WebView2** instead of bundling a browser (hence ~2 MB).
- **React** + **TypeScript** (UI).
- **sysinfo** — CPU, memory, and network sampling.
- **windows** crate — Win32 interop for taskbar placement, keep-on-top, fullscreen detection, and the launch-at-login registry entry.

## Getting Started

Prerequisites: **Node.js**, the **Rust** toolchain, and **WebView2** (preinstalled on Windows 11).

```bash
npm install      # install JS dependencies
npm run dev      # run the app (builds the Rust backend + Vite frontend)
```

## Build & Package

```bash
npm run build    # build the app + Windows installer
```

The installer lands in `src-tauri/target/release/bundle/nsis/` as `DeskPet_<version>_x64-setup.exe`.

## How It Works

```
sysinfo (Rust)  ──"metrics" event (CPU · RAM · network) every 1000ms──▶  React UI
                                            fps = minFps + (cpu/100)^sensitivity · (maxFps − minFps)
```

The Rust backend samples CPU, memory, and network once per second and emits a single
`metrics` event; the React UI maps **CPU** to a frame rate (regardless of which metric is
displayed) and advances the sprite. Settings are the single source of truth — every change
(tray menu or settings window) funnels through the backend, which persists it, syncs the
tray, and broadcasts a `settings` event to all windows. A lightweight window manager keeps
the chip pinned to the correct spot in the taskbar band even as the taskbar geometry changes
(DPI, resolution, `explorer.exe` restarts) and hides it under genuine fullscreen apps.

## Project Structure

```
src-tauri/                     # Rust backend (Tauri)
├── src/main.rs                   # windows, tray menu, settings funnel, events
├── src/settings.rs               # persisted Settings schema (validation + back-compat)
├── src/metrics.rs                # CPU / RAM / network sampling thread
├── src/win.rs                    # Win32: taskbar placement, keep-on-top, fullscreen, autostart
└── tauri.conf.json               # window + bundle config
src/
├── renderer/                  # React UI
│   ├── App.tsx                   # the taskbar chip
│   ├── SettingsApp.tsx           # the settings window
│   ├── Pet.tsx · Readout.tsx     # pet animation + the label/value readout
│   ├── tauri.ts                  # invoke/event bridge to the backend
│   ├── appearance.ts             # applies accent / background / scale as CSS vars
│   ├── hooks/useAnimation.ts
│   └── assets/{cat,dog,horse,bird,fish}/   # sprite frames
└── shared/types.ts            # shared types (Settings, Metrics, PetType, …)
scripts/slice-sprites.cjs      # slice real sprite sheets into frames
```

## Sprites

Each pet is a folder of transparent PNG frames in `src/renderer/assets/<pet>/`
(`<pet>_1.png`, `<pet>_2.png`, …) that the app cycles through. The loader finds
them by filename, so the frame count is flexible.

The art is sliced from sprite sheets in `sprite-sheets/` by
`scripts/slice-sprites.cjs` (background key-out, defringe, trim, downscale). To
add or swap a pet:

1. Drop frames into `src/renderer/assets/<pet>/` (or add a sheet to the slicer config).
2. Add the pet id to `PETS` in `src/shared/types.ts` **and** to `PETS` in `src-tauri/src/main.rs`.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set
up, the project layout, and how to add a new pet.

## License

[Apache License 2.0](LICENSE)
