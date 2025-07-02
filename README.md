# DryPrompt

**AI-powered desktop application that learns your typing habits and automates repetitive prompts**

DryPrompt is a macOS desktop application that runs silently in the background, monitoring text input and using AI to identify repeated prompts. When patterns are discovered, it proactively suggests creating native macOS Keyboard Text Replacements to automate repetitive typing.

## Project Status

### ✅ Phase 1: Project Setup & Foundation (COMPLETED)
- [x] Electron application initialized with TypeScript and Vite
- [x] Complete project directory structure established
- [x] Basic menu bar application with system tray
- [x] Core dependencies installed (LangGraph, OpenAI API, Supabase, etc.)
- [x] Build system and development environment configured
- [x] Version control setup with Git

### ✅ Phase 2: Minimum Viable Product (COMPLETED)
- [x] Configuration UI & IPC with secure keychain storage
- [x] Precision monitoring engine (uiohook-napi + active-win)
- [x] AI workflow implementation with LangGraph.js
- [x] Proper DBSCAN clustering using density-clustering library
- [x] OpenAI API integration for embeddings and synthesis
- [x] Supabase database integration for persistence
- [x] Native macOS notifications with AppleScript integration
- [x] Manual "Analyze Now" trigger in menu bar

### 🔄 Phase 3: Enhanced Features & Polish (Next)
- [ ] Automatic hourly analysis scheduling
- [ ] Advanced monitoring controls and settings
- [ ] Enhanced error handling and recovery
- [ ] Performance optimizations
- [ ] User analytics and feedback dashboard

## Development

### Prerequisites
- Node.js (v18 or higher)
- macOS (required for system integrations)
- OpenAI API key (stored in `.env`)
- Supabase project credentials (stored in `.env`)
- Supabase database tables set up (see `SUPABASE_SETUP.md`)

### Running the Application

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **The application will appear as a menu bar icon** (three horizontal lines) in your macOS menu bar. Right-click the icon to see the context menu with options including "Quit".

### Optional: Enhanced Keyboard Capture

For full keyboard capture functionality, you can install the optional `uiohook-napi` dependency:

```bash
npm install uiohook-napi
npm run electron-rebuild  # May be needed for your Electron version
```

If `uiohook-napi` is not available, the app will automatically use fallback mode with simulated text capture for testing purposes. The core AI workflow and suggestion system will work in both modes.

### Building for Production

```bash
npm run make
```

This creates a distributable `.dmg` file in the `out/` directory.

## Architecture

The application follows a secure, modular architecture:

- **Main Process** (`src/main/`): Handles OS integration, system monitoring, and AI workflow
- **Renderer Process** (`src/renderer/`): UI components (minimal for this menu bar app)
- **Preload Scripts** (`src/preload/`): Secure bridge between main and renderer processes
- **Services** (`src/main/services/`): Modular services for different system integrations
- **Workflow** (`src/main/workflow/`): LangGraph.js AI analysis workflow

## Security & Privacy

- All system monitoring requires explicit user permission (Accessibility API)
- API keys stored securely in macOS Keychain
- Local data processing with minimal cloud dependencies
- Captured text stored only in application's private user data directory

## Technology Stack

- **Framework**: Electron with TypeScript
- **Build System**: Vite
- **AI Workflow**: LangGraph.js
- **AI Models**: OpenAI GPT-4o and text-embedding-3-small
- **Database**: Supabase
- **System Integration**: Native macOS APIs via Node.js
- **Clustering**: DBSCAN algorithm via density-clustering library

## License

MIT License - see LICENSE file for details.

---

*This project represents the cutting edge of productivity tools by leveraging local processing power, persistent background operations, and intelligent automation in a way that web and mobile apps simply can't match.* 