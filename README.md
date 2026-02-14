<p align="center">
  <img src="unified-extension/icons/icon128.png" alt="Vector Logo" width="120" />
</p>

<h1 align="center">Vector — AI Browser Agent & Accessibility Intelligence-Top 10 Finalists in iNTUition</h1>

<p align="center">
  <strong>Voice-controlled, accessibility-first Chrome extension with AI-powered browser automation</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension%20MV3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome MV3" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/AI-Claude%20%7C%20OpenAI%20%7C%20Grok-blueviolet" alt="AI Models" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/Build-iNTUition%202026-orange" alt="Hackathon" />
</p>

---

## 🎯 The Problem

| Problem | Reality |
|---------|---------|
| **Inaccessible Web** | Despite WCAG guidelines, most websites are **not** accessible. Screen readers are clunky, voice control is primitive. |
| **Manual Browsing Fatigue** | Clicking through menus, scrolling, and filling forms is tedious — why can't you just *say* what you want? |
| **One-Size-Fits-All UX** | People have different needs (dyslexia, ADHD, color blindness, motor impairments) but browsers don't adapt. |
| **AI Assistants Don't Act** | ChatGPT can answer questions but can't click buttons or fill forms. There's no "hands" for AI in the browser. |

## 💡 The Solution

**Vector** is an AI-powered Chrome extension that transforms how people interact with the web. Instead of clicking and typing, users simply **talk to their browser**:

> *"Scroll down"* → it scrolls. *"Click the login button"* → it finds and clicks it. *"Summarize this page"* → it reads and explains the content.

Built **accessibility-first**: for someone who is blind, has limited hand mobility, or has ADHD, Vector provides adaptive overlays, voice control, and an AI companion that describes what's on screen in natural language.

### Core Capabilities

| Feature | Description |
|---------|-------------|
| 🤖 **AI Browser Agent** | Natural language → DOM manipulation. Say *"click submit"* and it finds and clicks the submit button. |
| 🎙️ **Voice Workflow** | Full hands-free browsing with STT, TTS, wake word ("Buddy"), and continuous voice control loop. |
| ♿ **Accessibility Intelligence** | 12+ adaptive overlay modes for dyslexia, ADHD, color blindness, seizure safety, high contrast, and more. |
| 🧠 **Page Understanding** | AI describes pages in natural language — structured DOM extraction in 6 different formats for comprehensive page understanding. |
| 👁️ **Eye-Tracking Support** | 9-point calibration system using MediaPipe for gaze-based interaction — fully client-side, no cloud processing. |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER INTERACTION LAYER                        │
│         Voice Commands  ·  Chat Side Panel  ·  Accessibility Toggles   │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND SERVICE WORKER (Brain)                    │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Fast-Path   │  │  Intent LLM  │  │ Code Gen LLM │  │  Session   │  │
│  │  Matcher     │→ │  (Haiku)     │→ │  (Sonnet)    │  │  Manager   │  │
│  │  30+ regex   │  │  Classify    │  │  Plan actions │  │  Per-tab   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  Safety      │  │  Action      │  │  Rate        │                  │
│  │  Filter      │  │  Executor    │  │  Limiter     │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       CONTENT SCRIPTS (Hands)                          │
│                                                                         │
│  DOM Extraction (6 formats)  ·  Action Execution  ·  CSS Injection     │
│  Element Mapping  ·  Accessibility Overlays  ·  UI Editing             │
└─────────────────────────────────────────────────────────────────────────┘
```

### End-to-End Data Flow

```
1. User speaks: "Click the search button"
2. Dashboard captures speech via Web Speech API (STT)
3. Command sent to Service Worker via chrome.runtime.sendMessage
4. Fast-Path Matcher checks 30+ regex patterns (e.g., "scroll down")
   ├─ 5a. MATCH → Execute directly, no LLM call (<50ms, $0 cost)
   └─ 5b. NO MATCH → Intent LLM classifies command (200-500ms)
6. Service Worker requests DOM context from Content Script
7. Content Script extracts interactive elements, semantic regions, spatial layout
8. Code Generation LLM produces structured action plan (DOM + intent)
9. Safety Filter validates actions (blocks dangerous operations)
10. Executor sends structured action to Content Script
11. Content Script performs DOM manipulation (click, scroll, fill, etc.)
12. Verification checks if action succeeded
13. TTS speaks result: "Done! I clicked the search button."
```

---

## 🔧 Technical Deep Dive

### 5-Stage AI Pipeline

The core intelligence runs through a purpose-built pipeline where each stage can succeed, fail, or require clarification:

```
Input → Fast-Path → Intent LLM → Code Gen LLM → Safety Filter → Executor → Verification
         (regex)    (classify)    (plan)          (validate)      (act)      (confirm)
```

#### Stage 1 — Fast-Path Pattern Matching

**Why:** 80% of commands are simple (`scroll down`, `go back`, `new tab`). Pattern matching handles them in **<50ms for $0**.

```javascript
// 30+ regex patterns bypass LLM entirely
{ pattern: /^scroll\s+(down|up)$/i,     action: "scroll"    }
{ pattern: /^go\s+back$/i,              action: "goBack"    }
{ pattern: /^click\s+["'](.+)["']$/i,   action: "clickByText" }
{ pattern: /^new\s+tab$/i,              action: "newTab"    }
// ... 30+ more patterns for common commands
```

#### Stage 2 — Intent Classification (Claude Haiku)

For complex commands, a **fast + cheap** model classifies intent. Haiku costs ~$0.001/call at 200-500ms latency.

```json
{
  "clear": true,
  "parsedIntent": {
    "action": "click",
    "target": "search button",
    "value": null
  }
}
```

The intent LLM receives rich spatial context — element positions, regions, nearby elements, and content associations — to disambiguate references like *"the button at the top-right"* or *"the Apply button for the Software Engineer job."*

#### Stage 3 — Code Generation (Claude Sonnet)

A **more capable** model generates structured action plans using full DOM context. Actions are structured objects, **not raw JavaScript** — this is a deliberate security decision:

```json
{
  "actions": [
    {
      "actionType": "click",
      "selector": "el-5",
      "description": "Click the search button",
      "verification": { "type": "domChange", "expectedResult": "Search results appear" }
    }
  ]
}
```

**9 supported action types:** `click` · `fill` · `scroll` · `navigate` · `extract` · `modify` · `tab` · `keyboard` · `browser`

#### Stage 4 — Safety Filter

Every action passes through pattern-based security checks:

| Category | Blocked Patterns | Reason |
|----------|-----------------|--------|
| **Network** | `fetch()`, `XMLHttpRequest`, `WebSocket` | Prevent data exfiltration |
| **Storage** | `localStorage`, `sessionStorage`, `cookies` | Protect user data |
| **Injection** | `eval()`, `Function()`, `<script>` | Prevent code injection |
| **Chrome APIs** | `chrome.*`, `browser.*` | Block privilege escalation |

**Confirmation required** for risky-but-legitimate actions: form submissions, deletions, purchases, password fields.

#### Stage 5 — Execution & Verification

Actions execute via Chrome's `scripting.executeScript` API with element ID mapping through `window.__aiAgentElementMap` (WeakMap). After each action, the pipeline verifies success and retries up to 3 times on failure.

---

### DOM Extraction Engine (6 Formats)

The content script extracts page information in **six complementary formats**, giving the AI multiple views to find the right element:

| Format | Optimized For | Use Case |
|--------|--------------|----------|
| Simplified HTML | Structure | Clean DOM without scripts/styles/hidden elements |
| Structured Text | Readability | Hierarchical text with indentation |
| Interactive Elements | Action targeting | All clickable/typeable elements with bounding boxes |
| Accessibility Tree | Screen readers | ARIA structure and roles |
| Flat Element List | ID-based lookup | All elements with unique stable IDs |
| Semantic Regions | Page understanding | Header/nav/main/footer/sidebar sections |

Each interactive element includes: **bounding box**, **spatial position**, **nearby elements**, **semantic context**, **content associations**, and **importance score**.

---

### Voice Workflow Engine

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Wake    │ →  │  STT     │ →  │  Command │ →  │  TTS     │
│  Word    │    │  (Web    │    │  Process │    │  Response │
│ "Buddy"  │    │  Speech) │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                          ┌───────────┘
                                          ▼
                                    ┌──────────┐
                                    │ Leakage  │  ← Prevents mic from
                                    │ Filter   │    hearing its own TTS
                                    └──────────┘
```

**TTS Leakage Filter:** A critical innovation — the microphone picks up speaker output, creating infinite loops. The filter tracks recent TTS output and compares word overlap. If >60% word overlap with what was just spoken, the input is classified as echo and ignored.

---

### Accessibility System (12+ Modes)

Accessibility modes inject CSS modifications dynamically based on user needs:

| Mode | What It Does |
|------|-------------|
| High Contrast | Increases contrast ratios for low-vision users |
| Large Text | Scales all text for readability |
| Dyslexia Font | Applies OpenDyslexic or similar spacing-optimized fonts |
| ADHD Focus | Highlights focused elements, dims distractions |
| Color Blind Filters | Deuteranopia, protanopia, tritanopia corrections |
| Seizure Safe | Removes animations, flashing, auto-playing media |
| Calm Overlay | Reduces visual noise with muted colors |
| Link Highlighting | Makes all links visually distinct |
| Reading Guide | Adds a focus line for line-by-line reading |
| Cursor Enhancement | Larger, higher-contrast cursor |
| Text Spacing | Increases letter/word/line spacing |
| Image Descriptions | AI-generates alt text for images |

**Onboarding-based setup:** Users select their impairment type during first run, and appropriate modes are auto-configured.

---

### Eye-Tracking Calibration

For users who cannot use hands at all, Vector includes a **9-point calibration system** using Google's **MediaPipe** face landmark detection:

- Runs **entirely in-browser** — no cloud processing, complete privacy
- Uses `face_landmarker.task` and `hand_landmarker.task` models
- Maps gaze direction to screen coordinates via calibration points
- Supports both eye-tracking and finger-tracking input methods

---

### Session Management

Sessions are **per-tab** with conversation history and action memory:

- Each tab gets an isolated session (Gmail history doesn't affect Amazon)
- Sessions auto-cleanup after 30 minutes of inactivity
- Maximum 50 concurrent sessions with LRU eviction
- Action history limited to 50 entries per session
- Conversation context sent to LLM (last 10 messages) for continuity

---

## 📦 Project Structure

```
iNTUition-2026/
├── unified-extension/              # Production Chrome extension bundle
│   ├── manifest.json               # Chrome MV3 manifest (permissions, scripts, CSP)
│   ├── background.js               # Service worker — AI pipeline, session management
│   ├── content.js                  # DOM interaction, element mapping, action execution
│   ├── dom-extractor-content.js    # 6-format DOM extraction engine
│   ├── sidepanel.html/.js          # React-based side panel UI (chat + dashboard)
│   ├── dashboard.js/.css           # Voice workflow, accessibility toggles, onboarding
│   ├── options.html/.js            # Settings UI (API keys, model selection, preferences)
│   ├── calibration.html/.js        # 9-point eye-tracking calibration
│   ├── tracking-content.js         # Eye & finger tracking content script
│   ├── tracking-manager.js         # Tracking lifecycle management
│   ├── tracking.css                # Tracking UI styles
│   ├── ui-editing-content.js       # Live UI editing content script
│   ├── ui-editing-interceptor.js   # UI editing in MAIN world (framework interop)
│   ├── ui-editing-styles.css       # UI editing visual feedback
│   ├── permission.html/.js         # Microphone permission flow
│   ├── background/                 # TypeScript declarations
│   │   ├── index.d.ts              # Service worker types
│   │   ├── aiClient.d.ts           # Multi-provider AI client types
│   │   ├── sessionManager.d.ts     # Session management types
│   │   ├── networkMonitor.d.ts     # Network request monitoring types
│   │   └── pipeline/               # AI pipeline stage types
│   │       ├── intentLLM.d.ts      # Intent classification
│   │       ├── codeGenLLM.d.ts     # Action code generation
│   │       ├── safetyFilter.d.ts   # Safety validation
│   │       ├── executor.d.ts       # Action execution
│   │       └── fastPath.d.ts       # Regex fast-path matching
│   ├── content/                    # Content script types
│   ├── shared/types/               # Shared type contracts
│   │   ├── messages.d.ts           # Message protocol schemas
│   │   └── pipeline.d.ts           # Pipeline data structures
│   ├── sidepanel/                  # Side panel React component types
│   ├── options/                    # Options page component types
│   ├── icons/                      # Extension icons (16/48/128px)
│   └── lib/mediapipe/              # MediaPipe ML models (face + hand)
│       ├── models/                 # .task model files
│       └── wasm/                   # WASM runtime for in-browser ML
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Chrome Extension Manifest V3 | Service workers, content scripts, side panel |
| **Language** | TypeScript 5.x | Type-safe development, compiled to JS |
| **UI Framework** | React 18 | Side panel chat interface, settings page |
| **Bundler** | Webpack 5 | Module bundling for extension distribution |
| **AI — Intent** | Claude 3.5 Haiku | Fast intent classification (~$0.001/call) |
| **AI — Code Gen** | Claude Sonnet 4 | Structured action plan generation |
| **AI — Alternative** | OpenAI / Grok | Configurable multi-provider support |
| **Voice — STT** | Web Speech API | Browser-native speech recognition |
| **Voice — TTS** | Web Speech API | Browser-native speech synthesis |
| **Eye Tracking** | MediaPipe (Google) | Face/hand landmark detection, fully client-side |
| **ML Runtime** | WASM | In-browser ML inference, no cloud dependency |

### Key Chrome Extension APIs Used

`tabs` · `scripting` · `storage` · `sidePanel` · `webRequest` · `activeTab` · `sessions` · `history` · `downloads`

---

## 🚀 Installation & Setup

### Step 0 — Download ML Models (Eye/Hand Tracking)

The MediaPipe WASM and model files (~30MB) are not included in the repo. If you need eye/hand tracking features, run the setup script:

```powershell
cd unified-extension
powershell -ExecutionPolicy Bypass -File setup-tracking.ps1
```

> This downloads the models from Google's CDN. Skip this step if you don't need tracking features.

### Step 1 — Load the Extension

1. Open **Google Chrome**
2. Navigate to `chrome://extensions`
3. Enable **Developer Mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the `unified-extension/` folder

### Step 2 — Configure AI Provider (Required)

> ⚠️ **The extension requires an AI provider API key to function.** Without it, the AI agent cannot process commands.

1. Click the Vector icon in the toolbar → the side panel opens
2. Go to the **Settings** tab
3. Choose your AI provider:
   - **Claude** (recommended) — requires [Anthropic API key](https://console.anthropic.com/)
   - **OpenAI** — requires [OpenAI API key](https://platform.openai.com/)
4. Select models:
   - **Intent Model:** Claude 3.5 Haiku (fast, cheap classification)
   - **Code Gen Model:** Claude Sonnet 4 (capable action planning)
5. Save settings

### Step 3 — First-Run Onboarding

On first launch, Vector presents a personalized onboarding flow:
1. Enter API keys
2. Select your accessibility profile (vision, motor, cognitive, or none)
3. Appropriate accessibility modes are auto-configured

---

## 🎮 Usage

### Voice Commands

Open the side panel and use the **Voice** tab, or say **"Buddy"** to activate:

```
"Scroll down"                    → Scrolls the page
"Click the login button"         → Finds and clicks it
"Fill the email field with hello@example.com"  → Fills the input
"Go to youtube.com"              → Navigates to YouTube
"Summarize this page"            → AI describes page content
"New tab"                        → Opens a new tab
"Find 'pricing'"                 → Ctrl+F search
"Zoom in"                        → Increases page zoom
"Go back"                        → Browser back
```

### Chat Interface

Use the **Agent** tab for natural language chat:

```
"What buttons are on this page?"
"Click the third link in the navigation"
"Fill out this form with test data"
"What does this page do?"
```

### Accessibility

Use the **Access** tab to toggle overlay modes, or let onboarding auto-configure based on your profile.

---

## 🔐 Safety & Security

Vector implements defense-in-depth for safe browser automation:

1. **Structured Actions** — LLMs generate action objects (not raw JS), making validation possible
2. **Pattern-Based Blocking** — 20+ dangerous patterns blocked: `eval()`, `fetch()`, `document.cookie`, `chrome.*` APIs
3. **Confirmation Flow** — Risky actions (purchases, form submissions, deletions) require user confirmation
4. **Sandboxed Execution** — Content scripts run in an isolated world, cannot access page JS variables
5. **Rate Limiting** — 10 requests per 60-second window to prevent API abuse
6. **No Persistent Storage Access** — Injected code cannot touch `localStorage`, `sessionStorage`, or `indexedDB`

---

## 🐛 Notable Engineering Challenges

### TTS Leakage → Infinite Loops
**Problem:** Microphone picks up TTS speaker output → STT transcribes it → processes as new command → speaks response → infinite loop.  
**Solution:** Built a word-overlap leakage filter. If STT input has >60% word overlap with recent TTS output, it's classified as echo and ignored.

### Content Script Injection on Extension Reload
**Problem:** After reloading the extension during development, existing tabs fail with *"Receiving end does not exist."*  
**Solution:** On startup, iterate all tabs and programmatically inject content scripts if missing. Added PING/PONG health check protocol.

### Unstable DOM Element IDs in SPAs
**Problem:** AI generates "click element 5" but by execution time, the DOM has changed and element 5 is different.  
**Solution:** Store element references in `window.__aiAgentElementMap` (WeakMap). Use stable selectors (`#id`, `[data-testid]`) when available. Fall back to re-querying by text content.

---

## 🗺️ Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Fast-path before LLM** | 80% of commands are simple. Instant execution at $0 cost. |
| **Two-stage LLM pipeline** | Intent = classification (fast model). Code gen = reasoning (capable model). Right tool for each job. |
| **Per-tab sessions** | User mental model: commands on Gmail shouldn't affect Amazon. Tab isolation is natural. |
| **Structured actions, not raw JS** | Security: can validate structured objects. Can't validate arbitrary JavaScript. |
| **6 DOM extraction formats** | Different AI tasks need different views. Spatial grid for "click the top button," accessibility tree for screen reader context. |
| **Wake word ("Buddy")** | For users who can't press buttons, hands-free activation is essential. "Buddy" is friendly and unlikely in normal speech. |
| **In-browser ML (MediaPipe WASM)** | Eye-tracking data is sensitive. Zero cloud dependency = complete privacy. |

---

## 🔮 Future Roadmap

- **Cross-Tab Intelligence** — Remember context across tabs (*"go back to the email I was writing"*)
- **Persistent Memory** — Learn user preferences over time (*"I usually want dark mode on news sites"*)
- **Multi-Modal Perception** — Use screenshots + DOM for better page understanding
- **Macro Recording** — Record action sequences and replay them
- **Adaptive Impairment Detection** — Automatically detect user struggles and offer help
- **Fine-Tuned Models** — Train a small, specialized model for browser commands
- **Firefox Port** — WebExtensions API compatibility

---

## 🏆 Built At

**iNTUition 2026** — A hackathon project demonstrating that the browser can be made accessible, intelligent, and voice-driven with modern AI.

---

<p align="center">
  <strong>Vector</strong> — Because the web should adapt to people, not the other way around.
</p>


