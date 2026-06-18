<div align="center">

<h1>🐾 DeskPet</h1>

<p><b>A lightweight desktop companion that lives in your Windows taskbar and runs faster as your CPU heats up.</b></p>

<p><i>Idle CPU → a slow stroll · Heavy load → full zoom — your PC activity, at a glance.</i><br/>
Inspired by the macOS app <i>Zoomies</i>.</p>

<p>
  <a href="https://github.com/Priyansh-max/deskpet/releases/latest">
    <img src="https://img.shields.io/badge/Download-Windows%2010%20%7C%2011-2ea44f?style=for-the-badge&logo=windows&logoColor=white" alt="Download DeskPet for Windows" height="40">
  </a>
</p>

<p>
  <img src="https://img.shields.io/badge/version-1.0.0-4c9aff?style=flat-square" alt="Version 1.0.0">
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
| **[DeskPet installer ↓](https://github.com/Priyansh-max/deskpet/releases/latest)** | ~2 MB | x64 (64-bit) | 10 · 11 |

> Built with **Tauri** (uses the built-in WebView2 instead of bundling a browser), so the installer is only **~2 MB**.
> The link opens the latest release — until the first one is published, [build from source](#getting-started).
> Not code-signed yet, so SmartScreen may warn on first launch — click **More info → Run anyway**.

## ✨ Features

- 🐾 Lives **inside the taskbar** as a small chip — the pet plus a live CPU&nbsp;% readout
- ⚡ Animation speed scales with CPU load (**3–18 FPS**): idle strolls, heavy load zooms
- 🐱 **Five pets** — Cat, Dog, Horse, Bird, Fish
- 🖱️ **Click the chip** for the menu: change pet · pause/resume · quit
- 🖥️ Hides under fullscreen apps and stays put — behaves like a native taskbar element
- 💾 Your chosen pet **persists** across restarts

## Tech Stack

- **Tauri 2** + **Rust** — native shell that uses the system **WebView2** instead of bundling a browser (hence ~2 MB)
- **React** + **TypeScript** (UI)
- **sysinfo** (CPU monitoring)
- **windows** crate (Win32 interop — taskbar placement, keep-on-top, fullscreen detection)

## Getting Started

Prerequisites: **Node.js**, the **Rust** toolchain, and **WebView2** (preinstalled on Windows 11).

```bash
npm install         # install JS dependencies
npm run tauri:dev   # run the app (builds the Rust backend + Vite frontend)
```

## Build & Package

```bash
npm run tauri:build  # build the app + Windows installer
```

The installer lands in `src-tauri/target/release/bundle/nsis/`.

## How It Works

```
sysinfo (Rust backend)  ──"cpu" event──▶  React UI
        every 1000ms                       fps = 3 + (cpu/100)*15, clamped to [3, 18]
```

The Rust backend samples CPU load once per second and emits a `cpu` event; the
React UI maps it to a frame rate and advances the sprite. The chip is a
transparent, always-on-top window kept in the taskbar band via Win32.

## Project Structure

```
src-tauri/                  # Rust backend (Tauri)
├── src/main.rs                # window, tray menu, CPU events, persistence
├── src/win.rs                 # Win32: taskbar placement, keep-on-top, fullscreen
└── tauri.conf.json            # window + bundle config
src/
├── renderer/               # React UI
│   ├── App.tsx
│   ├── Pet.tsx
│   ├── tauri.ts               # invoke/event bridge to the Rust backend
│   ├── hooks/useAnimation.ts
│   └── assets/{cat,dog,horse,bird,fish}/   # sprite frames
└── shared/                 # shared types (PetType, cpuToFps, ...)
scripts/slice-sprites.cjs   # slice real sprite sheets into frames
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
