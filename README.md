# DryPrompt

> An AI-powered macOS desktop application that learns your typing habits and automates repetitive prompts through intelligent keyboard shortcut suggestions.

## Overview

DryPrompt is a productivity-focused desktop application that solves the problem of repetitive typing by learning from your input patterns. Instead of manually creating keyboard shortcuts, DryPrompt runs silently in the background, monitoring your text input and using AI to identify repeated prompts that could be automated.

This is a personal productivity tool built for AI-first workflows, automating the complete process from pattern recognition to native macOS keyboard shortcut creation with intelligent conflict detection and seamless system integration.

## Key Features

### 🤖 **AI-Powered Pattern Recognition**
- Continuous background monitoring of text input across target applications
- LangGraph.js workflow orchestration for intelligent clustering and analysis
- DBSCAN clustering algorithm to identify semantically similar repeated phrases
- OpenAI GPT-4 powered synthesis of reusable shortcuts

### ⚡ **Intelligent Automation**
- Automatic hourly analysis with dynamic visual feedback
- Smart conflict detection prevents overwriting existing system shortcuts
- Native macOS keyboard shortcut creation via AppleScript integration

### 🎯 **Manual Control & Flexibility**
- Manual shortcut creation through built-in editor
- "Analyze Now" for on-demand pattern analysis
- Direct access to system Text Replacements preferences

### 🔒 **Security & Privacy**
- Secure API key storage in macOS Keychain
- Explicit accessibility permission management
- Local data processing with minimal cloud dependencies
- Captured text stored only in application's private directory

### 📊 **Smart State Management**
- Dynamic menu bar icons reflecting current application state
- Real-time status indicators (idle, analyzing, error, configuration-needed)
- Automatic error recovery and graceful degradation
- Comprehensive logging with automatic archiving

## Tech Stack

**Electron, TypeScript, Vite, LangGraph.js, OpenAI API, Supabase, uiohook-napi, and density-clustering**

### Core Framework
- **Electron** - macOS desktop application framework with system tray integration
- **TypeScript** - Type-safe development with comprehensive type definitions
- **Vite** - Fast build tool with hot module replacement

### AI & Workflow
- **LangGraph.js** - AI workflow orchestration for pattern analysis
- **OpenAI API** - GPT-4o for text synthesis and text-embedding-3-small for clustering
- **density-clustering** - DBSCAN algorithm implementation for semantic grouping

### System Integration
- **uiohook-napi** - Low-level keyboard monitoring
- **active-win** - Active window detection for targeted monitoring
- **AppleScript** - Native macOS system integration

### Data & Security
- **Supabase** - Pattern storage and analysis result persistence
- **macOS Keychain** - Secure credential management via keytar

## Project Structure

```
dry-prompt/
├── _docs/                      # Project documentation
│   ├── phases/                 # Development phase documentation
│   ├── project-overview.md     # Project vision and goals
│   ├── user-flow.md           # User journey and workflows
│   ├── tech-stack.md          # Technology decisions and rationale
│   ├── ui-rules.md            # UI design principles
│   ├── theme-rules.md         # Visual theme specifications
│   └── project-rules.md       # Coding standards and conventions
├── src/                       # Source code
│   ├── main/                  # Electron main process
│   │   ├── services/          # Core application services
│   │   ├── utils/             # Utility functions and helpers
│   │   └── workflow/          # AI workflow nodes and orchestration
│   ├── renderer/              # Configuration and edit dialog UI
│   ├── preload/               # Secure IPC bridge
│   └── common/                # Shared types and utilities
├── scripts/                   # Build and setup scripts
└── assets/                    # Static assets and icons
```

## Getting Started

### Prerequisites
- macOS 10.15+ (Catalina or later)
- Node.js 18+ and npm
- Accessibility permissions for system monitoring
- OpenAI API key for AI analysis
- Supabase project (optional, for persistence)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/dry-prompt.git
cd dry-prompt

# Install dependencies
npm install

# Start development server
npm run dev
```

### Required Configuration
DryPrompt requires API keys for external services (stored securely in macOS Keychain):
- **OpenAI API Key** - For AI pattern analysis and shortcut synthesis
- **Supabase Keys** - For pattern storage and analysis persistence (optional)

### Optional: Enhanced Keyboard Capture
For full keyboard capture functionality, install the optional dependency:
```bash
npm install uiohook-napi
npm run electron-rebuild  # May be needed for your Electron version
```

### Building for Production
```bash
npm run make
```
This creates a distributable `.dmg` file in the `out/` directory.

## Development Phases

DryPrompt was built through a structured 3-phase approach:

1. **Phase 1: Setup** - Electron foundation, basic menu bar, and core dependencies
2. **Phase 2: MVP** - Configuration UI, monitoring engine, AI workflow, and database integration
3. **Phase 3: Enhanced Features** - Automated analysis, error handling, and build pipeline

See `_docs/phases/` for detailed phase documentation.

## User Workflow

1. **Initial Setup** - Configure OpenAI API key through settings dialog
2. **Permission Grant** - Allow accessibility access for system monitoring
3. **Background Monitoring** - App silently monitors text input in target applications
4. **Automatic Analysis** - Hourly AI analysis identifies repeated patterns
5. **Smart Suggestions** - Native notifications present shortcut suggestions
6. **Simple Creation** - Acceptor edit suggestions to create macOS shortcuts
7. **Manual Control** - Create shortcuts manually or run analysis on-demand

## Success Criteria

DryPrompt succeeds when it:
- Accurately identifies genuinely useful repeated patterns
- Creates shortcuts that feel natural and don't conflict with existing ones
- Operates transparently without disrupting normal workflow
- Provides immediate productivity gains through automation
- Maintains user privacy and security throughout the process

## License

MIT License - see LICENSE file for details.

---

**Built with AI-first principles for the modern productivity workflow.** 