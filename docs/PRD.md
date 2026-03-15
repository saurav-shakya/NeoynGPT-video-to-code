# NeoynGPT Video-to-Code - Product Requirements Document (PRD)

**Version:** 2.0
**Date:** 2026-03-15
**Author:** NeoynGPT Team
**Status:** Draft

---

## 1. Product Overview

### 1.1 Vision
NeoynGPT Video-to-Code is a VS Code extension that enables developers to analyze screen recordings and video tutorials of web/mobile apps using Google Gemini's visual AI, and get actionable code suggestions, bug fixes, and UI feedback — all within their IDE.

### 1.2 Problem Statement
Developers frequently:
- Record screen videos of bugs, UI issues, or desired features
- Watch video tutorials and manually translate what they see into code
- Struggle to communicate visual issues (layout bugs, animation glitches) in text
- Spend time switching between video players and their IDE

There is no tool that lets a developer drop a video into their IDE and get AI-powered code analysis directly from the visual content.

### 1.3 Solution
A VS Code extension that:
1. Accepts **local video files** (upload) or **YouTube video links**
2. Sends the video to **Google Gemini** for **frame-by-frame visual analysis** (NOT transcript-based)
3. Returns structured analysis, code suggestions, and fixes based on what the AI actually *sees* in the video
4. **Feeds the analysis into the Cline coding agent** which can then directly read, edit, and create files in the user's project — all with user approval at every step

### 1.4 Target Users
- Frontend/full-stack developers debugging UI issues
- Developers following video tutorials and wanting code generation
- QA engineers sharing screen recordings for developer review
- Solo developers reviewing their own app screen recordings

---

## 2. Scope

### 2.1 In Scope (v2.0)
- Local video file upload (MP4, WebM, MOV, AVI, etc.)
- YouTube video URL input and processing
- Frame-by-frame visual analysis via Google Gemini API
- Video analysis results integrated into chat workflow
- Gemini model selection (2.5 Flash, 2.5 Pro, etc.)
- Video segment selection (start/end timestamps)
- Progress indicators for upload and analysis
- Video length limits based on Gemini model capabilities

### 2.2 Out of Scope (Removed)
- **Chrome extension** (popup.html, popup.js, styles.css, manifest.json) — REMOVED
- Transcript-based analysis — we do frame-by-frame visual analysis only
- Non-Gemini video analysis providers (future scope)
- Real-time screen sharing/streaming analysis (future scope)

---

## 3. User Stories

### US-01: Local Video Upload
**As a** developer,
**I want to** upload a local screen recording from my computer,
**So that** the AI can visually analyze what's happening in my app and suggest code fixes.

**Acceptance Criteria:**
- User can click a "Upload Video" button in the chat area
- File picker opens with video format filters (MP4, WebM, MOV, AVI, FLV, MPG, WMV, 3GP)
- Upload progress bar shows during Gemini File API upload
- Processing status shown while Gemini processes the video
- Max file size: 2GB (free tier) / 20GB (paid tier)
- User sees error message if file too large or unsupported format

### US-02: YouTube Video Link
**As a** developer,
**I want to** paste a YouTube video URL,
**So that** the AI can analyze the video content and help me write code based on what it sees.

**Acceptance Criteria:**
- User can paste a YouTube URL in the chat input
- System auto-detects YouTube URLs (youtube.com/watch, youtu.be, etc.)
- Video is fetched and processed via Gemini API
- Free tier: up to 8 hours of YouTube video daily
- User sees clear error if video is private/unavailable

### US-03: Frame-by-Frame Analysis
**As a** developer,
**I want** the AI to analyze my video frame-by-frame (not just the transcript),
**So that** it can see visual details like UI layout, colors, animations, errors on screen, console outputs, etc.

**Acceptance Criteria:**
- Gemini analyzes at 1 FPS by default (configurable)
- Analysis includes visual details: UI elements, layout, colors, text on screen, errors
- Audio is also processed (spoken explanations, error sounds)
- User can request analysis of specific segments via timestamps (MM:SS format)
- Results include timestamp references to specific moments in the video

### US-04: Code Generation from Video
**As a** developer,
**I want to** receive code suggestions based on what the AI sees in my video,
**So that** I can quickly implement what I see in tutorials or fix bugs shown in recordings.

**Acceptance Criteria:**
- AI generates code blocks based on video analysis
- Code is contextual to the user's current workspace/project
- User can apply suggested code changes via the existing Cline workflow
- AI references specific video timestamps when explaining code suggestions

### US-05: Screen Recording Feedback
**As a** developer,
**I want to** record my app's screen, upload it, and get feedback on my codebase,
**So that** I can identify and fix UI bugs, performance issues, or improve UX.

**Acceptance Criteria:**
- AI identifies visual issues: broken layouts, misaligned elements, wrong colors, etc.
- AI maps visual issues to potential code locations in the workspace
- AI suggests specific CSS/HTML/JS fixes
- AI can reference the user's actual codebase files using @ mentions

### US-06: Gemini Model Selection
**As a** developer,
**I want to** choose which Gemini model to use for video analysis,
**So that** I can balance between cost, speed, and analysis quality.

**Acceptance Criteria:**
- Dropdown to select Gemini model in settings
- Models shown with their capabilities (max video length, context window, pricing)
- Default model: gemini-2.5-flash (best price-performance)
- Model info displayed: max ~1 hour video (default res), ~3 hours (low res)

### US-07: Direct Codebase Integration — Video to Code Changes
**As a** developer,
**I want** the AI to not just analyze my video but also directly read my project files, find the relevant code, and apply fixes/changes,
**So that** I don't have to manually translate video analysis into code changes myself.

**Acceptance Criteria:**
- After video analysis, the Cline agent has full access to the user's workspace
- Agent can automatically `read_file` to find relevant source files based on what it sees in the video
- Agent can `write_to_file` to fix bugs or implement features shown in video
- Agent can `execute_command` to run builds, tests, install packages
- Agent can `search_files` to find where specific UI components or logic lives
- User approves every file edit and command execution (existing Cline approval flow)
- User can @ mention specific files alongside video to guide the agent

### US-08: Workspace-Aware Video Analysis
**As a** developer,
**I want** the AI to know my project structure while analyzing the video,
**So that** it can map visual issues to actual files in my codebase.

**Acceptance Criteria:**
- Agent receives workspace context: file tree, open files, active terminals
- Agent can correlate "I see a broken navbar in the video at 00:15" with `src/components/Navbar.tsx`
- Agent suggests fixes referencing actual file paths in the user's project
- User can combine @ mentions with video: e.g., "Here's my screen recording, check @/src/App.css for issues"

---

## 4. How It Actually Works — The Video-to-Codebase Pipeline

This is the **core innovation** of NeoynGPT. Here's the complete pipeline from video upload to code changes in the user's project:

### 4.1 The Two-Phase Architecture

```
PHASE 1: VIDEO ANALYSIS (Gemini)          PHASE 2: CODE CHANGES (Cline Agent)
+----------------------------------+      +------------------------------------+
|                                  |      |                                    |
| User uploads video / YT link    |      | Gemini's analysis becomes CONTEXT  |
|          |                       |      | for the Cline coding agent         |
|          v                       |      |          |                          |
| Gemini receives video            |      |          v                          |
|          |                       |      | Agent reads user's project files   |
|          v                       |      | (read_file, list_files, search)    |
| Frame-by-frame visual analysis   | ---> |          |                          |
| (1 FPS, sees UI, code on screen) |      |          v                          |
|          |                       |      | Agent maps visual issues to code   |
|          v                       |      | ("broken navbar" -> Navbar.tsx)    |
| Structured analysis output:      |      |          |                          |
| - UI issues with timestamps      |      |          v                          |
| - Code visible on screen         |      | Agent writes fixes                 |
| - Errors/bugs identified         |      | (write_to_file with user approval) |
| - Suggested approach             |      |          |                          |
|                                  |      |          v                          |
+----------------------------------+      | Agent runs build/tests             |
                                          | (execute_command with approval)    |
                                          |          |                          |
                                          |          v                          |
                                          | DONE - Code is fixed!              |
                                          +------------------------------------+
```

### 4.2 Real-World Example: Bug Fix from Screen Recording

```
USER: [uploads 30-second screen recording of their React app]
      "My navbar dropdown is broken on mobile, fix it"

STEP 1 - GEMINI ANALYZES VIDEO:
  "At 00:05 I see a React web app with a top navigation bar.
   At 00:10 the user clicks a hamburger menu on mobile viewport (375px).
   At 00:12 the dropdown menu opens but overflows off-screen to the right.
   At 00:15 the dropdown items are cut off and not scrollable.
   At 00:20 I can see the browser DevTools open - the element is
   '.nav-dropdown' with 'position: absolute; right: 0; width: 300px'.
   Issue: Fixed width dropdown doesn't account for small viewport."

STEP 2 - CLINE AGENT ACTS ON USER'S CODEBASE:
  Agent: "I'll find the navbar component in your project."
  -> list_files("src/components/") -> finds Navbar.tsx, Navbar.css
  -> read_file("src/components/Navbar.css") -> sees .nav-dropdown styles
  -> write_to_file("src/components/Navbar.css") -> fixes:
       .nav-dropdown {
         position: absolute;
         right: 0;
    -    width: 300px;
    +    width: min(300px, calc(100vw - 2rem));
    +    max-height: 80vh;
    +    overflow-y: auto;
       }
  [USER APPROVES the change]
  -> execute_command("npm run dev") -> starts dev server to verify
  Agent: "Fixed! The dropdown now uses min() to respect viewport width
          and added scroll for overflow. Check your app at mobile size."
```

### 4.3 Real-World Example: Code Generation from YouTube Tutorial

```
USER: [pastes YouTube tutorial link]
      "Build the authentication flow shown in this Next.js tutorial,
       apply it to my project @/src/app/page.tsx @/src/lib/"

STEP 1 - GEMINI ANALYZES VIDEO:
  "This is a Next.js authentication tutorial using NextAuth.js.
   At 00:30 the instructor creates a file 'auth.config.ts'
   At 01:15 they set up Google OAuth provider with credentials
   At 02:00 they create middleware.ts for route protection
   At 03:30 they build a login page with email/password form
   At 05:00 they add session provider to the root layout
   [includes all code visible on screen, transcribed accurately]"

STEP 2 - CLINE AGENT ACTS ON USER'S CODEBASE:
  -> read_file("src/app/page.tsx") -> understands current project structure
  -> read_file("src/lib/") -> sees existing utilities
  -> read_file("package.json") -> checks current dependencies
  -> execute_command("npm install next-auth") [USER APPROVES]
  -> write_to_file("src/lib/auth.config.ts") -> creates auth config [APPROVES]
  -> write_to_file("src/middleware.ts") -> creates middleware [APPROVES]
  -> write_to_file("src/app/login/page.tsx") -> creates login page [APPROVES]
  -> edit existing layout.tsx -> adds SessionProvider [APPROVES]
  Agent: "Authentication flow implemented! I adapted the tutorial code
          to match your project structure. Run 'npm run dev' to test."
```

### 4.4 Real-World Example: App Feedback from Screen Recording

```
USER: [uploads 1-min recording of their e-commerce app]
      "Review my app UX and fix any issues you see"

STEP 1 - GEMINI ANALYZES VIDEO:
  "At 00:05 - Homepage loads in ~3 seconds (slow)
   At 00:10 - Product grid has inconsistent card heights
   At 00:20 - Add to cart button has no loading state, user clicks twice
   At 00:30 - Cart badge doesn't update immediately after adding item
   At 00:40 - Checkout form labels are misaligned on the price column
   At 00:50 - No confirmation toast after successful order"

STEP 2 - CLINE AGENT FIXES EACH ISSUE:
  -> search_files("ProductCard") -> finds component
  -> read_file + write_to_file -> fixes card heights with CSS grid
  -> search_files("addToCart") -> finds handler
  -> write_to_file -> adds loading state and debounce
  -> fixes cart badge with optimistic UI update
  -> fixes form alignment
  -> adds toast notification component
  [Each change requires USER APPROVAL]
```

### 4.5 The Workspace Context Advantage

When the Cline agent runs, it automatically has access to:

| Context | What It Knows | How It Helps |
|---------|--------------|-------------|
| **File Tree** | All files in the project (up to 200 shown) | Maps visual issues to actual files |
| **Open Files** | Files currently open in VS Code editor tabs | Prioritizes relevant files |
| **Active Terminals** | Running dev servers, build outputs | Checks build errors, runs tests |
| **@ Mentions** | User-specified files included as full content | Direct file content for targeted fixes |
| **VS Code Diagnostics** | TypeScript errors, ESLint warnings via `@problems` | Combines video issues with IDE issues |
| **Video Analysis** | Gemini's frame-by-frame visual analysis (NEW) | The visual context that drives everything |

### 4.6 User Control at Every Step

The agent NEVER makes changes silently. For every action:
- **Read file** -> Can be auto-approved (if user enables "always allow read-only")
- **Write/edit file** -> Shows diff preview, user must click "Approve"
- **Run command** -> Shows command, user must click "Approve"
- **User feedback** -> User can deny any action and provide feedback, agent adjusts

This means the user is always in control. The AI suggests, the user decides.

---

## 5. Video Input Specifications (same as before, renumbered)

### 4.1 Supported Video Formats
| Format | MIME Type |
|--------|-----------|
| MP4 | video/mp4 |
| MPEG | video/mpeg |
| MOV | video/mov |
| AVI | video/avi |
| FLV | video/x-flv |
| MPG | video/mpg |
| WebM | video/webm |
| WMV | video/wmv |
| 3GP | video/3gpp |

### 4.2 Video Size Limits
| Tier | Max File Size | Max Video Length (Default Res) | Max Video Length (Low Res) |
|------|--------------|-------------------------------|---------------------------|
| Free | 2 GB | ~1 hour | ~3 hours |
| Paid | 20 GB | ~1 hour | ~3 hours |

### 4.3 Token Consumption
| Component | Tokens |
|-----------|--------|
| 1 video frame (default resolution) | 258 tokens |
| 1 video frame (low resolution) | 66 tokens |
| Audio per second | 32 tokens |
| **Total per second (default res)** | **~300 tokens** |
| **Total per second (low res)** | **~100 tokens** |

### 4.4 YouTube Video Limits
| Tier | Daily Limit |
|------|-------------|
| Free | 8 hours total |
| Paid | No length-based limit |

---

## 5. Gemini Model Capabilities (Updated 2026)

| Model | Context Window | Max Videos/Request | Best For |
|-------|---------------|-------------------|----------|
| gemini-2.5-pro | 1M tokens | Up to 10 | Deep analysis, complex code generation |
| gemini-2.5-flash | 1M tokens | Up to 10 | Fast analysis, best price-performance |
| gemini-2.5-flash-lite | 1M tokens | Up to 10 | Budget-friendly quick analysis |
| gemini-2.0-flash | 1M tokens | 1 | Legacy support |

**Note:** Gemini 2.5+ models support up to 10 videos per request. Older models support only 1.

---

## 6. User Flow

### 6.1 Local Video Upload Flow
```
1. User opens NeoynGPT sidebar in VS Code
2. User clicks "Upload Video" button (or drags video into chat area)
3. File picker opens -> User selects video file
4. System validates: format, file size
5. Upload begins -> Progress bar shown
6. Gemini File API processes video -> "Processing..." status
7. Processing complete -> User types analysis prompt
   (e.g., "What UI bugs do you see?" or "Generate code for what's shown")
8. Gemini analyzes video frame-by-frame + audio
9. AI responds with timestamped analysis + code suggestions
10. User can apply code changes via Cline workflow
```

### 6.2 YouTube Video Link Flow
```
1. User opens NeoynGPT sidebar in VS Code
2. User pastes YouTube URL in chat input
3. System auto-detects YouTube URL pattern
4. System validates URL accessibility
5. Video sent to Gemini API for processing
6. User types analysis prompt
7. Gemini analyzes video frame-by-frame + audio
8. AI responds with analysis + code suggestions
```

---

## 7. UI/UX Requirements

### 7.1 Chat Area Enhancements
- **Video upload button** in chat input toolbar (camera/video icon)
- **YouTube URL detection** — auto-detect when user pastes a YouTube link
- **Video preview thumbnail** shown in chat after upload/link
- **Progress indicators:**
  - Upload progress bar (percentage)
  - Processing spinner with "Analyzing video..." text
  - Estimated time remaining
- **Video timestamp references** in AI responses should be clickable

### 7.2 Settings Enhancements
- **Gemini API Key** input field (already exists)
- **Video Analysis Model** dropdown selector
- **Video Resolution** toggle: Default (258 tokens/frame) vs Low (66 tokens/frame)
- **Custom FPS** option (default: 1 FPS, range: 0.5-5 FPS)
- **Token usage display** showing estimated cost for video analysis

### 7.3 Removed UI
- Chrome extension popup (popup.html, popup.js, styles.css, manifest.json) — DELETE

---

## 8. Non-Functional Requirements

### 8.1 Performance
- Video upload should show progress within 2 seconds of initiation
- Processing status updates every 5 seconds
- Analysis response streaming (show results as they generate)

### 8.2 Security
- Gemini API key stored locally in VS Code secrets storage
- Video files uploaded to Gemini are auto-deleted after 48 hours
- No video data stored locally after analysis (unless user opts in)
- YouTube URLs validated before processing

### 8.3 Error Handling
- Clear error messages for: unsupported formats, file too large, API key missing, rate limits, network failures
- Graceful degradation if video processing fails mid-way
- Retry mechanism for transient API failures (max 3 retries)

### 8.4 Compatibility
- VS Code 1.84.0+
- Node.js 18+
- All major OS: Windows, macOS, Linux

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Video upload success rate | > 95% |
| Average analysis response time (1 min video) | < 30 seconds |
| User satisfaction with code suggestions | > 70% helpful |
| Daily active video analyses per user | > 3 |

---

## 10. Release Plan

### Phase 1 — Foundation (Weeks 1-2)
- Remove Chrome extension files
- Update Gemini models to latest (2.5 Pro, 2.5 Flash)
- Upgrade `@google/genai` SDK
- Refactor VideoManager with new API patterns

### Phase 2 — Local Video Upload (Weeks 3-4)
- File picker integration in chat UI
- Video upload via Gemini File API
- Processing status polling
- Basic frame-by-frame analysis
- Video preview in chat

### Phase 3 — YouTube Integration (Weeks 5-6)
- YouTube URL detection and validation
- YouTube video processing via Gemini
- URL auto-detection in chat input

### Phase 4 — Enhanced Analysis (Weeks 7-8)
- Timestamp-based segment analysis
- Custom FPS configuration
- Low/default resolution toggle
- Codebase-aware analysis (@ mentions + video)
- Token usage estimation and display

### Phase 5 — Polish & Launch (Weeks 9-10)
- Error handling and retry logic
- Performance optimization
- Documentation and user guide
- Testing and bug fixes
- VS Code Marketplace publishing
