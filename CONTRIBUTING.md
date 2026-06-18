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
3. **Generate** the placeholder sprite assets (only needed once, or after editing
   the generator):
   ```bash
   npm run gen:assets
   ```
4. **Run** in development with hot reload:
   ```bash
   npm run dev
   ```

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
src/
├── main/      # Electron main process: window, tray, CPU monitor, store
├── preload/   # context-isolated IPC bridge
├── renderer/  # React UI + sprite assets
└── shared/    # types, constants, and IPC channel names used by both sides
```

See the [README](README.md) for a fuller architecture overview.

## Adding a New Pet

DeskPet was built so new pets need **no code changes** in the common case:

1. Add 8 transparent PNG frames to `src/renderer/assets/<pet>/`, named
   `<pet>_1.png` … `<pet>_8.png`.
2. Register the pet name in `src/shared/types.ts` (the `PetType` union and the
   `PETS` array) and add a tray label in `src/main/tray.ts`.
3. Run `npm run dev` and pick your pet from the tray menu.

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
