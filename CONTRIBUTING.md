# Contributing to DeskPet

Thanks for your interest in improving DeskPet! 🐾 This is a small, friendly
open-source project and contributions of all sizes are welcome — bug reports,
new pets, code cleanups, and docs.

## Getting Started

1. **Fork** the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/deskpet.git
   cd deskpet
   ```
2. **Install** dependencies:
   ```bash
   npm install
   ```
3. **Run** in development with hot reload (builds the Rust backend + Vite frontend):
   ```bash
   npm run dev
   ```

Prerequisites: **Node.js**, the **Rust** toolchain, and **WebView2** (preinstalled on
Windows 11). The sprite frames are committed, so no asset-generation step is needed.

## Development Workflow

- Create a branch off `main` for your change:
  ```bash
  git checkout -b feature/my-change
  ```
- Keep changes focused — one logical change per pull request.
- Before opening a PR, make sure the project type-checks and builds cleanly:
  ```bash
  npm run typecheck
  npm run build
  ```
- Match the style of the surrounding code (TypeScript, 2-space indent, no
  semicolons — Prettier-style defaults).

## Project Layout

```
src-tauri/     # Rust backend (Tauri): windows, tray menu, settings, metrics, Win32 interop
src/
├── renderer/  # React UI (taskbar chip + settings window) + sprite assets
└── shared/    # types and constants shared by the backend and renderer
```

See the [README](README.md) for a fuller architecture overview.

## Adding a New Pet

DeskPet was built so new pets need almost no code changes:

1. Add transparent PNG frames to `src/renderer/assets/<pet>/`, named
   `<pet>_1.png`, `<pet>_2.png`, … (the frame count is flexible).
2. Register the pet id in **both** `PETS` arrays — `src/shared/types.ts` (also add
   it to the `PetType` union) and `src-tauri/src/main.rs`.
3. Run `npm run dev` and pick your pet from the chip's **Change Pet** menu (or the
   Settings → Pet tab).

If you're contributing original artwork, please make sure you have the right to
share it under this project's license.

## Reporting Bugs

Open an issue with:

- What you expected to happen and what actually happened
- Steps to reproduce
- Your Windows version and DeskPet version
- Screenshots or logs if relevant

## Pull Requests

- Describe **what** changed and **why**.
- Link any related issue (e.g. `Fixes #12`).
- Be patient and kind in review — this is a hobby-scale project. 🙂

## Code of Conduct

Be respectful and constructive. Harassment or discrimination of any kind is not
tolerated.

## License

By contributing, you agree that your contributions will be licensed under the
[Apache License 2.0](LICENSE) that covers this project.
