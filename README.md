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

### 🚧 Phase 2: Precision Monitoring Engine (Next)
- [ ] Process monitor for Cursor.app
- [ ] Active window monitoring
- [ ] Keyboard input capture (with Accessibility permissions)
- [ ] Secure local data storage

### 🔄 Phase 3: AI Workflow Implementation
- [ ] LangGraph.js workflow setup
- [ ] OpenAI API integration for embeddings and clustering
- [ ] ml-js DBSCAN clustering implementation
- [ ] Supabase database integration

## Development

### Prerequisites
- Node.js (v18 or higher)
- macOS (required for system integrations)
- OpenAI API key (stored in `.env`)
- Supabase project credentials (stored in `.env`)

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
- **Clustering**: ml-js DBSCAN algorithm

## License

MIT License - see LICENSE file for details.

---

*This project represents the cutting edge of productivity tools by leveraging local processing power, persistent background operations, and intelligent automation in a way that web and mobile apps simply can't match.* 