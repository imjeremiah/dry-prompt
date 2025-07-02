# Theme Rules

This document outlines the visual theme for the DryPrompt application, focusing on a "clean technical" aesthetic that feels native to macOS. The theme will ensure a consistent and polished look across all UI components.

---

## 1. Color Palette

To achieve a native macOS feel, we will primarily use system-defined colors. This ensures our application automatically adapts to the user's system appearance (Light Mode / Dark Mode) and accessibility settings (e.g., increased contrast).

*   **Primary Text**: `labelColor` - The standard color for text in labels.
*   **Secondary Text**: `secondaryLabelColor` - For less prominent text.
*   **Window Background**: `windowBackgroundColor` - The background for our configuration window.
*   **Control Background**: `controlBackgroundColor` - The background for buttons and other controls.
*   **Accent Color**: `controlAccentColor` - We will use the user's chosen system accent color for interactive elements to provide a seamless experience.

### Status Colors
These colors will be used for status indicators within the menu bar or other UI.
*   **Success**: `systemGreen` - Indicates a successful operation (e.g., shortcut created).
*   **Error**: `systemRed` - Indicates a critical error (e.g., missing permissions).
*   **Warning**: `systemYellow` - For non-critical warnings.
*   **Informational**: `systemBlue` - For informational messages or when an action is in progress.

---

## 2. Typography

We will use the standard macOS system font to maintain a native look and feel.

*   **Font Family**: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif`
    *   This CSS font stack defaults to "San Francisco" on macOS and provides sensible fallbacks for other systems.
*   **Typographic Scale**:
    *   **Heading / Title**: 18pt, Semibold
    *   **Body / Standard Text**: 13pt, Regular
    *   **Caption / Secondary Text**: 11pt, Regular

---

## 3. Iconography

Icons must be simple, clear, and consistent with the macOS aesthetic.

### 3.1. Main Application Icon (Menu Bar)

*   **Style**: The icon will be a monochrome, template-style image that automatically adapts to the menu bar's color in both Light and Dark modes. It should be a simple, geometric design.
*   **Design**: A stylized, abstract representation of a text prompt or an intelligent spark.
*   **States**:
    *   **Idle**: The standard icon.
    *   **Analyzing**: The icon can animate subtly (e.g., a fade-in/fade-out loop or animated dots) to indicate background processing.
    *   **Error**: A small dot or exclamation mark in a status color (`systemRed`) will be overlaid on the icon to indicate an error state requiring user attention.

### 3.2. Other Icons

Any icons used within the configuration window or notifications should be sourced from an open-source library that mimics the Apple SF Symbols style for consistency (e.g., Feather Icons, Heroicons).

---

## 4. Component Styling

*   **Windows**: The configuration window will use the standard macOS window appearance, with default traffic-light controls.
*   **Buttons**: Will use the standard system button style. The primary action ("Save") will be styled as the default button.
*   **Input Fields**: Will use the standard system text input style.
*   **Menus**: The menu bar dropdown will be a standard `NSMenu`, ensuring it is 100% native in appearance and behavior. 