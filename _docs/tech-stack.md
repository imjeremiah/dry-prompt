# Technology Stack & Engineering Guide

This document outlines the technology stack for the DryPrompt application and defines the best practices, limitations, and conventions for using each component. Adhering to these guidelines is crucial for building a secure, robust, and maintainable application.

---

## 1. Application Framework: Electron

Electron allows us to build a desktop application with web technologies. It has a **Main** process (Node.js for backend/OS operations) and one or more **Renderer** processes (Chromium for UI).

### Best Practices & Conventions
*   **Strict Process Separation**: All OS-level access, file system operations, and sensitive logic (like API calls or the AI workflow) **MUST** reside in the Main process. The Renderer process is for UI only.
*   **Secure IPC (Inter-Process Communication)**: We will use Electron's `contextBridge` to expose specific, secure functions from the Main process to the Renderer. Global `nodeIntegration` will be disabled. This prevents the UI from accessing powerful Node.js APIs directly.
*   **File Structure**:
    *   `src/main`: Code for the Main process.
    *   `src/renderer`: Code for the UI (Renderer process).
    *   `src/preload`: Preload scripts that define the `contextBridge`.
    *   `src/common`: Shared types and utilities that can be used by any process.
*   **Security**: We will implement a strict Content Security Policy (CSP) to mitigate cross-site scripting (XSS) risks.

### Limitations & Pitfalls
*   **Resource Usage**: Electron apps can consume more RAM and disk space than fully native applications. We must be mindful of performance, especially in background tasks.
*   **Security Responsibility**: Electron is powerful, but its security rests entirely on developer implementation. Misconfiguration (e.g., enabling `nodeIntegration` in the renderer) can create severe vulnerabilities.

---

## 2. Language: TypeScript

TypeScript will be used for the entire codebase to ensure type safety and improve maintainability.

### Best Practices & Conventions
*   **Strict Mode**: `"strict": true` will be enabled in `tsconfig.json` to enforce strong typing rules.
*   **Explicit Types**: The `any` type should be avoided. We will define clear `interface` or `type` definitions for all data structures, especially for API payloads and IPC communication.
*   **TSDoc**: All exported functions, classes, and types must be documented using TSDoc comments.

---

## 3. AI & Data

### 3.1. AI Workflow: LangGraph.js

LangGraph orchestrates our multi-step AI analysis workflow locally.

### Best Practices & Conventions
*   **Modularity**: Each step in the workflow (embedding, clustering, synthesis) should be a distinct, single-responsibility node in the graph.
*   **State Management**: The state of the graph will be explicitly defined with a TypeScript interface for clarity and type safety.
*   **Error Handling**: Errors will be handled within the graph nodes, using conditional edges to route to a fallback or failure state if necessary. This prevents the entire workflow from crashing on a single point of failure.
*   **Location**: All LangGraph code will reside in `src/main/workflow/`.

### Limitations & Pitfalls
*   **Debugging**: Visualizing the flow of a graph can be complex. We will rely on thorough logging of state transitions to debug issues.

### 3.2. Data Persistence: Supabase

Supabase stores the results of the analysis and user interactions with suggestions.

### Best Practices & Conventions
*   **Main Process Only**: All interaction with the Supabase client **MUST** be from the Main process. The renderer should never have direct access to Supabase keys.
*   **Service Abstraction**: We will create a dedicated `SupabaseService` in `src/main/services/` to encapsulate all database logic.
*   **Connection Handling**: The service must gracefully handle network errors or loss of internet connection.

### 3.3. Local Clustering: ml-js (DBSCAN)

This library is used to find clusters of similar prompts from the text embeddings.

### Best Practices & Conventions
*   **Parameter Tuning**: The `epsilon` and `minPoints` parameters for the DBSCAN algorithm are critical for good results. These will be configurable and tuned during development.
*   **Performance**: For now, clustering will run in the main process. If performance becomes an issue with very large prompt logs, we will move it to a non-blocking worker thread.

### Limitations & Pitfalls
*   **Parameter Sensitivity**: DBSCAN's effectiveness is highly dependent on its parameters. Poor choices can lead to all points being classified as noise or a single, large cluster.

---

## 4. System & OS Integration

### 4.1. Secure Storage: `keytar`

Used to securely store the user's OpenAI API key in the native macOS Keychain.

### Best Practices & Conventions
*   **Service Abstraction**: All calls to `keytar` will be wrapped in a `KeychainService` module in `src/main/services/`.
*   **Error Handling**: The service must handle cases where a key is not found or access to the Keychain is denied by the user.

### 4.2. Precision Monitoring: `active-win` and `iohook`

These are the most sensitive components of the application.

### Best Practices & Conventions
*   **Least Privilege**: The keyboard listener (`iohook`) **MUST** only be active when the process monitor (`active-win`) confirms that the target application (`Cursor.app`) is the frontmost window. It must be disabled immediately when the user switches to another app.
*   **User Transparency**: The application must be transparent about what it is monitoring and why. The need for Accessibility permissions must be clearly explained.
*   **Encapsulation**: All logic for these modules will be strictly contained within dedicated services (`ProcessMonitor`, `KeyboardListener`) to prevent misuse elsewhere in the codebase.

### Limitations & Pitfalls
*   **Privacy Risk**: This is the highest-risk area of the application. A bug in the monitoring logic could lead to unintentional data capture, which would be a major privacy violation.
*   **System Conflicts**: `iohook` can potentially conflict with other low-level system utilities. It also requires pre-built binaries which may need to be rebuilt for specific Electron versions using `electron-rebuild`.

### 4.3. OS Scripting: Node.js `child_process`

Used to execute `osascript` commands for creating and checking keyboard shortcuts.

### Best Practices & Conventions
*   **Input Sanitization**: Never pass raw, un-sanitized user input directly into a shell command. While our use case is low-risk, this is a critical security practice.
*   **Error Capturing**: We will listen for `stderr` output from the child process to detect and log errors during script execution.

---

## 5. Development & Build

### 5.1. Dev Environment: Electron-Vite

Vite provides a fast, modern development server and build process.

### 5.2. Packaging: `electron-builder`

Used to package the application into a distributable `.dmg` file.

### Best Practices & Conventions
*   **Code Signing & Notarization**: For macOS distribution, the application **MUST** be code-signed with a valid Apple Developer ID and notarized by Apple. This is essential for user trust and bypassing macOS Gatekeeper security.
*   **Configuration**: All `electron-builder` configuration will be managed in the `package.json` file under the `build` key. 