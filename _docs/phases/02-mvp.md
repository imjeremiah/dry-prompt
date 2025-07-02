# Phase 2: Minimum Viable Product (Core Intelligence)

## Scope
This phase focuses on implementing the primary user journey to deliver the core value of the application. We will build the entire pipeline from user input to an AI-generated suggestion. The workflow will be manually triggered, and the persistence layer will be omitted in favor of proving the core mechanics.

## Deliverables
*   A functional configuration window where a user can input and save their OpenAI API key.
*   The API key is securely stored in the native macOS Keychain.
*   A monitoring engine that correctly identifies when `Cursor.app` is active and logs keyboard input to a local file.
*   A manually triggered AI workflow that can analyze the logged text and generate a meaningful suggestion.
*   A native macOS notification that displays the suggestion and allows the user to create the system-wide text replacement.

---

## Features & Tasks

### 1. Build First-Time Setup UI & IPC
1.  Create the `index.html` and a renderer script for the configuration window. The UI will contain an input field and a "Save" button.
2.  In the renderer script, add an event listener to the button to get the API key.
3.  Implement the `contextBridge` in a `preload` script to expose a secure `saveApiKey` function.
4.  Implement the `ipcMain` handler in `src/main/index.ts` to receive the key from the renderer process.

### 2. Implement Secure Credential Storage
1.  Install the `keytar` dependency.
2.  Create the `src/main/services/keychain-service.ts` module.
3.  Implement `saveKey(key)` and `getKey()` functions that wrap `keytar`'s methods.
4.  Call `saveKey` from the `ipcMain` handler created in the previous step.

### 3. Build the Precision Monitoring Engine
1.  Install `active-win` and `iohook` dependencies.
2.  Create `src/main/services/monitoring-service.ts`. This service will manage the two-step monitoring logic as defined in the project overview to ensure efficiency.
3.  Implement the core logic: First, use a low-frequency check to see if `Cursor.app` is running. Only if it is, use `active-win` to check if it's the frontmost window before enabling the `iohook` listener.
4.  Create `src/main/services/logging-service.ts` to append all captured keyboard input to `prompt_log.json` in the app's user data directory.

### 4. Implement Core AI Workflow
1.  Install `@openai/openai-api`, `langgraph`, and `ml.js` dependencies.
2.  Create the workflow graph structure in `src/main/workflow/`.
3.  Implement the **Embed** node using the `text-embedding-3-small` model.
4.  Implement the **Cluster** node using the `DBSCAN` algorithm from `ml.js`.
5.  Implement the **Synthesize** node using the `gpt-4o` model.
6.  Create a utility function to generate shortcut triggers using the "Keyword Formula" (e.g., `;` + first verb + first keyword). Define an initial list of keywords (`code`, `test`, `file`, etc.).

### 5. Create Suggestion & Notification System
1.  Create `src/main/services/applescript-service.ts` to execute shell commands using Node's `child_process`.
2.  Implement a function to check for shortcut conflicts by running an `osascript`.
3.  Use Electron's built-in `Notification` module to show the AI-generated suggestion. The notification must have `Create Shortcut` and `Dismiss` buttons.
4.  Implement the `Create Shortcut` functionality by executing another `osascript`.
5.  Add a new "Analyze Now" item to the menu bar to manually trigger this entire workflow. 