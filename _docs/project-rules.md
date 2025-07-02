# Project Rules & Conventions

This document serves as the official engineering guide for the DryPrompt project. Its purpose is to ensure the codebase remains modular, scalable, and easy to understand. Adherence to these rules is mandatory to maintain a high-quality, AI-first codebase.

---

## 1. Core Philosophy

*   **AI-First**: The code must be highly organized, well-documented, and broken into logical, single-responsibility modules. This maximizes its compatibility with modern AI tools and facilitates future maintenance.
*   **Modularity**: Features should be encapsulated within their own modules or services. This minimizes dependencies between different parts of the application and makes the code easier to reason about.
*   **Native & Unobtrusive**: The application should feel like a native part of macOS. It must be lightweight, performant, and respectful of the user's system and privacy.

---

## 2. Directory Structure

The project will follow a strict directory structure based on the Electron Main/Renderer process model. All paths are relative to the `src/` directory.

```
src/
├── main/
│   ├── services/       # Encapsulated logic for external/OS services (keychain, supabase, etc.)
│   ├── workflow/       # The multi-step LangGraph AI workflow
│   ├── utils/          # Shared utility functions for the main process
│   └── index.ts        # Entry point for the Electron main process
│
├── renderer/
│   ├── assets/         # Images, fonts, and other static assets for the UI
│   └── index.ts        # Entry point for the renderer process (UI logic)
│
├── preload/
│   └── index.ts        # Preload script for securely exposing APIs to the renderer
│
└── common/
    └── types/          # Shared TypeScript types and interfaces used by all processes
```

---

## 3. File Conventions

*   **File Naming**: All filenames will use `kebab-case` (e.g., `keychain-service.ts`, `app-controller.ts`).
*   **File Size**: To maintain readability and modularity, files **must not exceed 500 lines**. If a file grows beyond this limit, it is a strong indicator that it needs to be refactored into smaller, more focused modules.
*   **File Header**: Every file **must** begin with a block comment that describes its purpose and its role within the application.

    ```typescript
    /**
     * @file Manages secure storage and retrieval of credentials from the macOS Keychain.
     * @module keychain-service
     */
    ```

---

## 4. Coding Style and Conventions

*   **Language**: The entire project will be written in **TypeScript** with `"strict": true` enabled. The `any` type is forbidden.
*   **Programming Pattern**: We will use **functional and declarative programming patterns**. Avoid classes and object-oriented inheritance in favor of functions and modules. State should be managed explicitly and immutably where possible.
*   **Functions**:
    *   Use the `function` keyword for pure functions that do not rely on or modify external state.
    *   All exported functions must be decorated with a full TSDoc block comment explaining their purpose, parameters, and return value.
*   **Variables**:
    *   Use descriptive names that include auxiliary verbs (e.g., `const isLoading = true;`, `let hasSucceeded = false;`).
    *   Avoid enums. Instead, use `Map` objects or plain object literals for key-value mappings to improve readability and interoperability.
*   **Error Handling**:
    *   Functions should **throw errors** when they encounter an unrecoverable state. Do not use fallback values or silent failures.
    *   Errors must be instances of the `Error` class and contain a clear, descriptive message.
*   **Conditionals**: Avoid unnecessary curly braces for simple, single-line conditional statements.

    ```typescript
    // Good
    if (isLoading) return;

    // Bad
    if (isLoading) {
      return;
    }
    ```

---

## 5. Commit Message Conventions

We will follow the **Conventional Commits** specification to ensure a clean and readable Git history. This is critical for automated versioning and changelog generation.

*   **Format**: `<type>[optional scope]: <description>`
*   **Common Types**:
    *   `feat`: A new feature for the user.
    *   `fix`: A bug fix for the user.
    *   `chore`: Routine tasks, dependency updates, and build process changes.
    *   `docs`: Changes to documentation files (`.md`).
    *   `style`: Code style changes that do not affect meaning (formatting, etc.).
    *   `refactor`: A code change that neither fixes a bug nor adds a feature.
    *   `test`: Adding missing tests or correcting existing tests.

*   **Example**: `feat(keychain): add function to save API key securely` 