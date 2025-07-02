# DryPrompt

## Introduction

Desktop applications represent a unique opportunity in the AI era. Unlike web or mobile apps constrained by browsers or platform limitations, desktop applications can deeply integrate with your operating system, run persistent background processes, and execute complex AI workflows locally. This creates possibilities for sophisticated automation and intelligence that simply aren't feasible in other environments.

This project will build the productivity tool you've always wanted but no one has built yet: a utility that learns your habits and automates your repetitive typing.

## Project Vision

### The Problem It Solves
Users, especially developers and writers who interact heavily with AI, often type the same prompts, commands, or phrases repeatedly without realizing it. This leads to thousands of wasted keystrokes and mental overhead. Manually identifying these patterns and creating text shortcuts in system settings is a tedious, reactive process that most people never do.

### The Solution
We will build a macOS desktop application that runs silently in the background, securely monitoring text input within specified applications (initially, the Cursor code editor). It uses a local AI workflow to find semantically similar, repeated prompts. When it discovers a pattern, it proactively suggests creating a native macOS Keyboard Text Replacement to automate the phrase, turning a tedious manual task into an intelligent, automated one.

## Implementation Blueprint

This project will be built in five clear, achievable layers, creating a robust and scalable application.

### Layer 0: First-Time Setup & Configuration
Before any monitoring begins, the application will perform a one-time setup. On first launch, the user will be presented with a configuration screen to enter their OpenAI API key. This key is essential for the AI analysis and will be stored securely in the native macOS Keychain.

### Layer 1: The Electron Application Shell
The main container for our application, built with **Electron**. This allows us to use HTML, CSS, and JavaScript/TypeScript for the entire application, including the background logic. The initial user interface will be a simple, unobtrusive menu bar icon that shows the app's status. It will provide a manual "Analyze Now" trigger and, if permissions are missing, will indicate an error state and provide a direct link to the macOS System Settings.

### Layer 2: The Precision Monitoring Engine
Our application will use a sophisticated, multi-part monitoring system to ensure it only captures input from the correct application at the correct time, guaranteeing user privacy and data accuracy. This engine will only function if the user has granted Accessibility permissions; otherwise, it will remain dormant.

1.  **Process Monitor (Coarse-grained):** A low-energy script will use `osascript` to periodically check if the `Cursor.app` process is running (default: every 10 seconds). This acts as the first gate, enabling the more detailed monitoring only when necessary.
2.  **Active Window Monitor (Fine-grained):** When the Process Monitor confirms Cursor is open, a more active monitor (using a library like `active-win`) will track which application window is currently in the foreground.
3.  **Keyboard Listener (The `iohook`):** This component, which requires one-time Accessibility permission, will be strictly controlled by the Active Window Monitor. It will only be enabled when a Cursor window is the active, frontmost window.
4.  **Local Data Capture:** Captured text will be immediately written to a secure, append-only `prompt_log.json` file. This file will reside in the application's private user data directory (`app.getPath('userData')`), ensuring it is sandboxed from other apps and users.

### Layer 3: The AI Workflow (The "Brain")
This is the core intelligence of the application, running entirely locally.
1.  **Framework:** We will use **LangGraph.js** to orchestrate a multi-step AI workflow.
2.  **Trigger:** The AI workflow is triggered automatically every hour. Additionally, the user can trigger an analysis at any time via the "Analyze Now" command in the app's menu bar.
3.  **Analysis Components:** The workflow will use the user's configured **OpenAI API** key and perform a three-step analysis:
    *   **Embed:** Using OpenAI's `text-embedding-3-small` model for its balance of high performance and low cost.
    *   **Cluster:** Using the `DBSCAN` algorithm from the `ml-js` library to find dense groups of semantically similar prompts. This method is ideal as it does not require knowing the number of clusters in advance.
    *   **Synthesize:** Using OpenAI's `gpt-4o` model for its top-tier reasoning capabilities. This step will rely on carefully engineered system prompts to reliably convert a cluster of similar phrases into a single, high-quality, generic command.
4.  **Storage:** The results of the analysis and user interactions with suggestions will be stored in a **Supabase** database for persistence.

### Layer 4: The Interactive Notification System
This layer closes the loop by transforming the AI's findings into actionable user suggestions that seamlessly integrate with the operating system.

1.  **Shortcut Conflict Check:** Before a notification is dispatched, the app will run a silent `osascript` command to check if a text replacement with the proposed trigger (e.g., `;explain`) already exists in the user's macOS settings. If a conflict is found, the suggestion is discarded for that cycle to prevent overwriting existing user shortcuts.
2.  **Native Notification:** If no conflict exists, the app will use Electron's `Notification` module to display a native macOS notification. The suggested shortcut trigger will be programmatically generated using a "keyword" formula (e.g., a semicolon, the first verb, and the first relevant keyword, like `;explaincode`). The notification will clearly display this suggestion and provide two buttons: `Create Shortcut` and `Dismiss`.
3.  **User Action, Automation & Feedback:** (Note: all interactions with Supabase require an active internet connection).
    *   **On Acceptance:** If the user clicks `Create Shortcut`, the app executes an `osascript` command to instantly add the text replacement to macOS Keyboard settings, sends a confirmation notification, and updates the suggestion's status in Supabase to "accepted."
    *   **On Rejection:** If the user clicks `Dismiss`, the app simply updates the suggestion's status in Supabase to "rejected." This feedback is logged for future developer analysis and does not perform real-time model tuning.

### Deployment Strategy
We will use a simple deployment method to ensure a fast and straightforward release:

1.  **Packaging:** The application will be packaged into a standard `.dmg` (Disk Image) file using `electron-builder`.
2.  **Code Signing & Notarization:** To comply with macOS security standards and ensure user trust, the application will be code-signed with an Apple Developer ID and notarized by Apple.
3.  **Distribution:** The final, signed `.dmg` file will be made available for direct download from a static location, such as a GitHub Releases page.
4.  **Updates:** This app will not include an auto-updater. Users will need to be notified of new versions and manually download and install them.

## Alignment with Core Requirements

This plan is designed to satisfy 100% of the original project brief's requirements:

-   **Platform**: A **macOS desktop application** built with Electron.
-   **Required Framework**: **LangGraph** is used for the core intelligent workflow.
-   **Local Workflow Execution**: The LangGraph analysis runs entirely locally within the app.
-   **Background Intelligence**: The app's primary value comes from its silent, persistent background monitoring and analysis.
-   **Personal Problem Focus**: It solves the specific, personal productivity problem of repetitive typing.
-   **Harness Desktop Advantages**: It fundamentally relies on desktop-exclusive features: Accessibility APIs, background process monitoring, native notifications, and programmatic control of system settings via AppleScript.
-   **Recommended Technologies**: It integrates the full required stack: **Electron**, **LangGraph**, **OpenAI API**, and **Supabase**.

## Final Notes

This project is about building something you genuinely want to use. The best outcome isn't just a working application, but a tool that becomes an invisible, indispensable part of your daily workflow. It represents the cutting edge of productivity tools by leveraging local processing power, persistent background operations, and intelligent automation in a way that web and mobile apps simply can't match. 