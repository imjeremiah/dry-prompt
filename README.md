# DryPrompt

DryPrompt is a macOS desktop application that runs silently in the background to learn your typing habits and proactively suggest creating native macOS Keyboard Text Replacements to automate your repetitive phrases. It turns the tedious manual task of creating shortcuts into an intelligent, automated one.

## Core Features

*   **Silent Background Monitoring**: Intelligently monitors specified applications (initially `Cursor.app`) for repetitive text input.
*   **Local AI Analysis**: Uses a local **LangGraph.js** workflow to find and synthesize repeated phrases without sending your keystrokes to the cloud.
*   **Proactive Shortcut Suggestions**: Generates native macOS notifications with suggestions for creating keyboard text replacements.
*   **Secure & Native**: Stores API keys securely in the macOS Keychain and integrates seamlessly into the menu bar for an unobtrusive experience.

## Tech Stack

Our stack is built to be secure, robust, and scalable, leveraging the best of desktop and AI technologies:

*   **Core**: Electron, TypeScript, Vite, Node.js
*   **AI & Workflow**: LangGraph.js, OpenAI API, ml-js
*   **Data Persistence**: Supabase
*   **System Integration**: `keytar`, `active-win`, `iohook`

## Project Conventions

This project follows a strict set of rules to ensure the codebase remains clean, modular, and easy to navigate.

### Directory Structure
```
src/
├── main/       # Backend logic, OS integration, and AI workflows
├── renderer/   # UI-facing code
├── preload/    # Secure scripts for IPC
└── common/     # Shared types and interfaces
```

### Key Rules
*   **AI-First Codebase**: All code is thoroughly documented (TSDoc) and modularized into single-responsibility files.
*   **File Size Limit**: Files must not exceed 500 lines.
*   **Functional Programming**: We prefer functional patterns over classes.
*   **Conventional Commits**: Git history is kept clean and readable.

For more details, please refer to the complete documentation in the `project-brief.md` and other documentation files.

## Getting Started

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Run the development server: `npm run dev` 