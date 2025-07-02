# UI Rules

This document defines the user interface (UI) principles and common design patterns for the DryPrompt application. The goal is to create a clean, intuitive, and native macOS experience that feels unobtrusive and powerful.

---

## 1. Core Principles

*   **Menu Bar First**: The application's primary home is the system menu bar. It should be the main entry point for all user interactions. The app will not have a Dock icon.
*   **Native Feel**: All UI elements—windows, notifications, menus, and controls—should look and behave like standard macOS components. We will prioritize system-native elements over custom styling.
*   **Unobtrusive Operation**: The application runs in the background. The UI should only appear when the user explicitly summons it (clicking the menu bar icon) or when the application has a high-value suggestion for the user (a native notification).
*   **Clarity and Actionability**: Every UI component must have a clear purpose. Notifications and menu items should be easy to understand and lead to predictable outcomes.
*   **Accessibility (a11y)**: The application must be fully accessible. All UI elements must support keyboard navigation, be compatible with screen readers (like VoiceOver), and respect system-level accessibility settings.

---

## 2. UI Components

### 2.1. The Menu Bar Interface

This is the application's command center.

*   **Interaction**: A single click on the menu bar icon opens a dropdown menu.
*   **Menu Items**: The menu will contain:
    *   A status indicator (e.g., "Monitoring Active" or "Error: Permissions Required").
    *   **Analyze Now**: Manually triggers the AI workflow. This button may be disabled with a loading indicator while an analysis is already in progress.
    *   **Settings...**: Opens the one-time configuration window. (Initially for API Key, but can be extended).
    *   **Help & Documentation**: A link to online documentation.
    *   **Quit DryPrompt**: A standard command to exit the application.
*   **Error State**: If Accessibility permissions are missing, the menu should clearly state this and the "Settings" item could be replaced by a "Grant Permissions..." item that directly opens the correct pane in macOS System Settings.

### 2.2. Native Notifications

This is the primary outbound communication channel.

*   **Trigger**: A notification is displayed only after the AI finds a valid, non-conflicting suggestion.
*   **Content**:
    *   **Title**: Must be clear and concise (e.g., "New Shortcut Suggestion").
    *   **Body**: Should show the proposed shortcut and the trigger (e.g., "Replace `;explain` with 'Explain the following code:'").
    *   **Icon**: The app's icon.
*   **Actions**: Will always include two buttons:
    *   `Create Shortcut`: The affirmative, primary action.
    *   `Dismiss`: The negative, secondary action.

### 2.3. Configuration Window

This is the only formal window in the application, used for initial setup.

*   **Appearance**: It should resemble a native macOS preferences pane. It will be a single, non-resizable window.
*   **Content**: Initially, it will contain a single input field for the OpenAI API Key and a "Save" button.
*   **Behavior**: It is opened via the "Settings..." menu bar item. Once the key is saved, this window will likely not need to be seen by the user again.

---

## 3. Layout and Spacing

*   **Consistency**: We will use a consistent spacing system based on an 8px grid. All padding and margins will be multiples of 8px (e.g., 8px, 16px, 24px) to ensure a clean and orderly layout in the configuration window.
*   **Alignment**: Content should be cleanly aligned, following standard macOS conventions (e.g., labels right-aligned next to input fields). 