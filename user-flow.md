# User Flow

This document defines the user journey through the DryPrompt application, from first launch to daily use. It outlines the sequence of interactions and system processes that deliver the core functionality of the app.

## 1. Onboarding & First-Time Setup

This flow occurs only once, when the user launches the application for the very first time.

1.  **Application Launch**: The user opens DryPrompt.
2.  **Configuration Screen**: A setup screen is presented to the user, requesting their OpenAI API key.
3.  **API Key Entry**: The user enters their API key. The application securely stores this key in the native macOS Keychain.
4.  **Accessibility Permissions**: The application prompts the user to grant Accessibility permissions, which are required for monitoring keyboard input.
    *   **If Permissions Granted**: The application's menu bar icon appears, and the monitoring engine is enabled. The app is now fully operational.
    *   **If Permissions Denied**: The menu bar icon displays an error state. Clicking the icon will show a message indicating that permissions are missing and provide a direct link to the macOS System Settings to grant them. The monitoring engine remains dormant until permissions are granted.

## 2. Core Application Loop (Background Operation)

Once set up, the application runs silently in the background. The user's primary interaction is with the suggestions it produces.

1.  **Silent Monitoring**: The application's monitoring engine runs continuously but efficiently.
    *   It first checks if the target application (`Cursor.app`) is running.
    *   If Cursor is running, it then checks if a Cursor window is the active, frontmost window.
    *   Only when a Cursor window is active does it begin capturing keyboard input.
2.  **Local Data Capture**: All captured text is appended to a local `prompt_log.json` file, sandboxed within the app's private data directory.
3.  **Automatic AI Analysis**:
    *   Every hour, the application automatically triggers a local AI workflow using LangGraph.js.
    *   This workflow analyzes the text in `prompt_log.json` to find clusters of semantically similar, repeated phrases.
    *   It synthesizes these clusters into generic, reusable commands.
    *   The results (potential shortcuts) are stored in a Supabase database.

## 3. Suggestion & Interaction Flow

This flow is initiated after the AI analysis identifies a potential shortcut.

1.  **Shortcut Conflict Check**: Before notifying the user, the app silently checks the user's macOS Keyboard settings to ensure the programmatically generated trigger (e.g., `;explain`) does not already exist. If a conflict is found, the suggestion is discarded for the current cycle.
2.  **Native Notification**: If no conflict exists, a native macOS notification is displayed to the user.
    *   **Content**: The notification presents the suggested shortcut and its trigger.
    *   **Actions**: It provides two buttons: `Create Shortcut` and `Dismiss`.
3.  **User Decision**:
    *   **User Clicks `Create Shortcut`**:
        1.  The application executes a script to instantly add the text replacement to the user's macOS Keyboard settings.
        2.  A confirmation notification is sent to inform the user the shortcut is ready.
        3.  The suggestion's status is updated to "accepted" in Supabase.
    *   **User Clicks `Dismiss`**:
        1.  The suggestion's status is updated to "rejected" in Supabase. No changes are made to the user's system.

## 4. Manual User Interaction (Menu Bar)

The user can interact with the application at any time via its menu bar icon.

1.  **Status Indicator**: The menu bar icon provides a visual cue for the application's status (e.g., running normally, error/permissions needed).
2.  **Manual Analysis**: The menu provides an "Analyze Now" button, allowing the user to trigger the AI workflow on demand, without waiting for the next automatic hourly cycle.
3.  **Error State**: If permissions are not granted, the menu will clearly state the issue and provide a direct link for the user to resolve it in System Settings. 