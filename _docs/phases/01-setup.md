# Phase 1: Project Setup & Foundation

## Scope
This initial phase focuses on establishing the foundational skeleton of the application. The goal is to create a launchable Electron app with the correct project structure, development environment, and core dependencies, but with no implemented logic. This phase ensures our tooling and architecture are correctly configured before we build features.

## Deliverables
*   A running Electron application initialized with the `electron-vite-typescript` template.
*   A `package.json` file with all core development and application dependencies installed.
*   The complete project directory structure (`src/main`, `src/renderer`, etc.) as defined in `project-rules.md`.
*   A basic, static menu bar icon appears when the application is launched.
*   The application can be successfully launched (e.g., via `npm run dev`) and quit from the menu bar.

---

## Features & Tasks

### 1. Initialize Project Scaffold
1.  Use the Vite project scaffolding tool to create a new project with the `electron-vite-typescript` template.
2.  Initialize a Git repository and commit the initial project structure.
3.  Remove any boilerplate UI elements or example code from the template.

### 2. Establish Directory Structure
1.  Delete any example folders from the template.
2.  Create the official project directories: `src/main`, `src/main/services`, `src/main/workflow`, `src/main/utils`, `src/renderer`, `src/renderer/assets`, `src/preload`, and `src/common/types`.
3.  Add placeholder `.gitkeep` files to empty directories to ensure they are tracked by Git.

### 3. Implement Basic Menu Bar
1.  Source a temporary, monochrome template icon and place it in `src/renderer/assets`.
2.  In `src/main/index.ts`, write the minimal code to create an `app.on('ready')` event handler.
3.  Inside the handler, instantiate an Electron `Tray` instance, providing the path to the icon.
4.  Create a basic `ContextMenu` with a "Quit" item that calls `app.quit()`.
5.  Ensure the application does not appear in the macOS Dock. 