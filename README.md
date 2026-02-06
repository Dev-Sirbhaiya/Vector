# iNTUition-2026

## Overview
iNTUition-2026 is a Chrome Extension workspace that combines an AI browser agent with accessibility and voice-control features. The project is organized into two main parts:

- **browser-ai-agent/**: the TypeScript source code for the extension (React UI + background + content scripts).
- **unified-extension/**: a built, unified bundle that integrates the agent UI with extra voice and accessibility dashboards.

At a high level, the extension lets users:
- chat with an AI assistant in a side panel to control the current page,
- execute actions like scroll, click, and form filling via content scripts,
- describe the current page using DOM extraction + LLM prompts,
- enable accessibility overlays (contrast, dyslexia, focus aids, etc.),
- configure AI providers/models and API keys via the options/settings UI,
- optionally use voice commands and a voice workflow (STT/TTS loop).

## Repository Structure

### Top-level
- **README.md** — project documentation (this file).
- **browser-ai-agent/** — source, build config, and assets for the extension.
- **unified-extension/** — compiled/bundled output plus additional integrated UI.

### browser-ai-agent/
This folder contains the extension source code.

- **package.json** — dependencies, scripts, and build tooling.
- **tsconfig.json** — TypeScript configuration.
- **webpack.config.js** — build pipeline that produces bundled outputs in `dist/`.
- **public/** — static assets (icons, etc.) copied into the build.
- **src/manifest.json** — extension manifest (MV3) defining permissions, background, content scripts, and UI entry points.

#### src/background/
Background service worker responsible for orchestration and state:

- **index.ts** — registers lifecycle handlers (install/startup), loads settings, and routes messages between the UI and content scripts.
- **aiClient.ts** — API client layer for AI providers.
- **sessionManager.ts** — manages user sessions and memory/state.
- **pipeline/** — multi-step processing flow:
	- **intentLLM.ts** — interprets user intent.
	- **codeGenLLM.ts** — generates action plans/code for execution.
	- **executor.ts** — executes planned actions via content script messaging.
	- **fastPath.ts** — short-circuit handling for simple commands.
	- **safetyFilter.ts** — safeguards and confirmations for destructive actions.

#### src/content/
Content script injected into every page:

- **index.ts** — parses DOM into structured context, exposes actions like click/fill/scroll, and applies UI modifications on the page.

#### src/sidepanel/
Side panel chat UI (React):

- **App.tsx** — chat experience, message list, and status bar.
- **index.tsx** — entry point that mounts the React app.
- **index.html** — sidepanel shell template.
- **styles/** — CSS for the side panel interface.

#### src/options/
Options/settings page (React):

- **App.tsx** — configuration UI (API keys, provider, models, behavior toggles).
- **index.tsx** — entry point that mounts the React app.
- **index.html** — options page template.
- **styles.css** — page styling.

#### src/shared/
Shared types and message contracts:

- **types/messages.ts** — message types between UI, background, and content scripts.
- **types/pipeline.ts** — pipeline types and default settings.
- **types/index.ts** — barrel exports.

### unified-extension/
This folder contains the compiled/bundled extension and additional dashboards integrated with the agent UI.

- **manifest.json** — MV3 manifest with expanded permissions and multiple content scripts.
- **background.js** — compiled background logic.
- **content.js** — compiled content script.
- **sidepanel.html / sidepanel.js** — agent UI bundled into the unified side panel.
- **dashboard.js / dashboard.css** — additional integrated UI for voice + accessibility and settings.
- **options.html / options.js** — compiled options page.
- **content scripts:**
	- **dom-extractor-content.js** — extracts structured DOM for page description.
	- **ui-editing-content.js** — applies accessibility transformations.
	- **ui-editing-interceptor.js** — early intercept layer in the main world.

## Functional Capabilities

### 1) AI Browser Agent (Side Panel)
- Chat-based interface for issuing commands.
- Interprets natural language requests and maps them to page actions.
- Supports interaction patterns such as:
	- scrolling and navigation,
	- clicking elements by label or selector,
	- filling forms and inputs,
	- applying UI changes (e.g., larger text).

### 2) Background Orchestration & Pipeline
- Loads user settings from storage on startup/install.
- Routes messages between the side panel and content scripts.
- Pipeline stages include intent detection, code generation, execution, and safety filtering.
- Session manager keeps track of conversational context and state.

### 3) Content Script Actions
- Parses the current page into structured context to inform AI responses.
- Executes page actions (click, fill, scroll).
- Injects or removes styles for UI modifications.

### 4) Settings & Provider Configuration
- Options/Settings UI allows:
	- provider selection (Claude/OpenAI/Grok as configured),
	- API key entry,
	- model configuration (intent + codegen).
- Default settings are defined in shared pipeline types.

### 5) Unified Extension Enhancements
The unified build extends the base agent with:

- **Voice control**: speech-to-text commands and voice workflow toggles.
- **Text-to-speech**: reads page descriptions or responses aloud.
- **DOM description**: extracts page structure and summarizes via AI.
- **Accessibility tools**: dyslexia-friendly fonts, ADHD focus aids, high-contrast modes, calm overlays, seizure-safe modes, and link highlighting.

## How It Works (End-to-End)
1. User opens the side panel and sends a command.
2. The side panel posts a message to the background service worker.
3. The background pipeline processes intent and builds an action plan.
4. The content script executes actions in the active tab.
5. Responses and results are relayed back to the side panel UI.

## Notes
- The unified bundle is intended for distribution, while `browser-ai-agent/` is the primary development source.
- All scripts target Chrome Extension Manifest V3.