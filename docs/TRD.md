# NeoynGPT Video-to-Code - Technical Requirements Document (TRD)

**Version:** 2.0
**Date:** 2026-03-15
**Author:** NeoynGPT Team
**Status:** Draft

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
+--------------------------------------------------------------------------+
|                           VS Code Extension                               |
|                                                                           |
|  +------------------+    +--------------------------------------------+  |
|  |   Webview UI     |    |           Extension Backend                 |  |
|  |   (React)        |<-->|           (TypeScript)                      |  |
|  |                  |    |                                             |  |
|  | - ChatView       |    |  +--------------+    +------------------+  |  |
|  | - VideoUpload    |    |  | VideoManager  |--->| Gemini API       |  |  |
|  | - YouTubeInput   |    |  | (upload +     |    | (frame-by-frame  |  |  |
|  | - Settings       |    |  |  analyze)     |<---| visual analysis) |  |  |
|  | - AnalysisView   |    |  +--------------+    +------------------+  |  |
|  |                  |    |        |                                    |  |
|  |                  |    |        | analysis result as context         |  |
|  |                  |    |        v                                    |  |
|  |                  |    |  +--------------+    +------------------+  |  |
|  |                  |    |  | Cline Agent   |--->| User's Codebase  |  |  |
|  |                  |    |  | (read, write, |    | (actual project  |  |  |
|  |                  |    |  |  search, exec)|<---| files on disk)   |  |  |
|  |                  |    |  +--------------+    +------------------+  |  |
|  +------------------+    +--------------------------------------------+  |
+--------------------------------------------------------------------------+

DATA FLOW:
  Video --> Gemini (visual analysis) --> Analysis Context --> Cline Agent
  Cline Agent --> reads/searches user's codebase --> proposes edits
  User approves --> Cline Agent writes files / runs commands --> DONE
```

### 1.2 Component Overview

| Component | Location | Responsibility |
|-----------|----------|---------------|
| VideoManager | `src/integrations/video/VideoManager.ts` | Video upload, processing, analysis via Gemini |
| YouTubeHandler | `src/integrations/video/YouTubeHandler.ts` (NEW) | YouTube URL validation, video processing |
| GeminiHandler | `src/api/providers/gemini.ts` | Text/chat via Gemini (existing) |
| ClineProvider | `src/core/webview/ClineProvider.ts` | Webview message routing, state management |
| ChatView | `webview-ui/src/components/chat/ChatView.tsx` | Chat UI with video upload controls |
| VideoUploadButton | `webview-ui/src/components/chat/VideoUploadButton.tsx` (NEW) | Upload button + file picker |
| VideoPreview | `webview-ui/src/components/chat/VideoPreview.tsx` (NEW) | Video thumbnail + status in chat |
| ApiOptions | `webview-ui/src/components/settings/ApiOptions.tsx` | Gemini settings UI |

---

## 2. Video-to-Codebase Integration (CRITICAL SECTION)

This section explains HOW video analysis results connect to the user's actual project files and how the AI makes real code changes.

### 2.1 The Two-Phase Pipeline

The system works in two phases. This is the key architectural decision:

**Phase 1 — Gemini (Vision AI):** Analyzes the video frame-by-frame, outputs structured text describing what it SEES (UI, code, errors, layout issues).

**Phase 2 — Cline Agent (Coding AI):** Receives Gemini's analysis as context, then uses its existing tools to read/search/edit/create files in the user's actual project.

```
Phase 1: VIDEO ANALYSIS
========================
Input:  Video file (local) or YouTube URL + User's prompt
Engine: Google Gemini (gemini-2.5-flash / 2.5-pro)
Method: Frame-by-frame visual analysis (1 FPS, NOT transcript)
Output: Structured text analysis with timestamps, visual observations,
        code visible on screen, issues identified

Phase 2: CODEBASE MODIFICATION
===============================
Input:  Gemini's analysis output + User's workspace context
Engine: Cline Agent (any LLM provider: Claude, GPT, Gemini, etc.)
Method: Agentic loop with tool calls (read_file, write_to_file, etc.)
Output: Actual code changes in the user's project (with approval)
```

### 2.2 How Cline Agent Accesses the User's Codebase

The Cline agent (defined in `src/core/Cline.ts`) already has these tools available:

| Tool | What It Does | How It Helps with Video |
|------|-------------|------------------------|
| `read_file` | Reads any file in the workspace | Reads the files Gemini identified from video |
| `write_to_file` | Creates or overwrites files | Applies code fixes suggested by video analysis |
| `execute_command` | Runs terminal commands | Runs builds, tests, installs packages |
| `search_files` | Regex search across project | Finds components/functions seen in video |
| `list_files` | Lists directory structure | Explores project to find relevant files |
| `list_code_definition_names` | Lists functions/classes via tree-sitter | Maps video UI to code definitions |
| `ask_followup_question` | Asks user for clarification | Confirms before making risky changes |
| `attempt_completion` | Signals task is done | Shows final summary of all changes |

### 2.3 Context Injection — How Video Analysis Reaches the Agent

The video analysis result is injected into the Cline agent's conversation as a **special context block** within the user's message. This happens in `ClineProvider.ts`:

```typescript
// When user sends a message with video analysis attached
case "newTask": {
    const userText = message.text;
    const videoAnalysis = message.videoAnalysis; // Gemini's output from Phase 1

    // Build enriched task message
    let taskMessage = userText;

    if (videoAnalysis) {
        taskMessage = `${userText}

<video_analysis>
The following is a frame-by-frame visual analysis of a video the user provided.
Use this analysis to understand what the user sees and make changes to their codebase accordingly.

${videoAnalysis.text}

Video details:
- Source: ${videoAnalysis.source} (local upload / YouTube)
- Duration: ${videoAnalysis.duration}
- Analysis model: ${videoAnalysis.model}
</video_analysis>`;
    }

    // This goes into the Cline agent's conversation
    await this.initClineWithTask(taskMessage, message.images);
}
```

### 2.4 System Prompt Enhancement for Video-Aware Agent

The system prompt in `src/core/prompts/system.ts` must be extended to teach the agent how to use video analysis:

```typescript
// Addition to system prompt
const VIDEO_ANALYSIS_INSTRUCTIONS = `
## Working with Video Analysis

When the user's message contains a <video_analysis> block, it means they uploaded
a video (screen recording or YouTube tutorial) that has been analyzed frame-by-frame
by a vision AI. Follow these steps:

1. READ the video analysis carefully — it describes what was visually observed
   at specific timestamps (MM:SS format).

2. MAP visual observations to the user's codebase:
   - If the analysis mentions UI components, use search_files to find them
   - If it shows code on screen, compare with actual project files
   - If it identifies errors, find the relevant source files

3. MAKE CHANGES using your tools:
   - read_file to examine relevant source files
   - write_to_file to fix bugs or implement features
   - execute_command to run builds/tests to verify fixes

4. REFERENCE timestamps when explaining your changes:
   - "The navbar overflow at 00:12 was caused by fixed width in Navbar.css line 45"
   - "The code shown at 02:30 in the tutorial is now implemented in src/auth.ts"

5. ALWAYS verify your changes make sense with the user's existing code structure.
   Don't blindly copy code from video — adapt it to the project's patterns.
`;
```

### 2.5 Workspace Context the Agent Already Receives

Every time the Cline agent makes an API request, it automatically receives (from `getEnvironmentDetails()` in `Cline.ts`):

```
<environment_details>
# VSCode Visible Files
src/components/Navbar.tsx
src/styles/global.css

# VSCode Open Tabs
src/App.tsx
src/components/Navbar.tsx
src/pages/Home.tsx
package.json

# Actively Running Terminals
[Terminal 1] npm run dev
  Output: Local: http://localhost:3000
          Ready in 2.3s

# Current Working Directory (/home/user/my-project) Files
src/
  components/
    Navbar.tsx
    Navbar.css
    ProductCard.tsx
    Cart.tsx
  pages/
    Home.tsx
    Checkout.tsx
  styles/
    global.css
  App.tsx
  main.tsx
package.json
tsconfig.json
</environment_details>
```

This means the agent ALREADY knows the project structure before making any tool calls. Combined with video analysis, it can directly map "I see a broken navbar" to `src/components/Navbar.tsx`.

### 2.6 The @ Mention + Video Combo

Users can supercharge video analysis by combining @ mentions with video:

```
User message: "Here's my screen recording showing the cart bug.
               Check @/src/components/Cart.tsx and @/src/hooks/useCart.ts"
               [+ attached video]
```

What the agent receives:
```
1. Video analysis from Gemini (visual observations with timestamps)
2. Full content of Cart.tsx (injected by @ mention parser)
3. Full content of useCart.ts (injected by @ mention parser)
4. Workspace file tree (automatic)
5. Open files and terminals (automatic)
```

The agent now has EVERYTHING it needs: visual context from video + actual source code + project structure.

### 2.7 Complete Technical Flow — Step by Step

```
1. USER uploads video + types "Fix the checkout form validation bug"
                |
2. WEBVIEW sends {type: "uploadVideo"} to extension
                |
3. EXTENSION (ClineProvider) opens file picker, user selects video
                |
4. VIDEOMANAGER uploads to Gemini File API, polls until ACTIVE
                |
5. USER clicks "Send" with their prompt
                |
6. EXTENSION calls Gemini generateContent(videoUri + analysis prompt)
   Prompt: "Analyze this screen recording frame-by-frame. Describe all
            UI issues, errors, and code visible on screen with timestamps."
                |
7. GEMINI returns structured analysis:
   "00:05 - Checkout form with name, email, card fields
    00:08 - User types invalid email 'abc', no validation shown
    00:12 - User submits form, page reloads without error message
    00:15 - Console shows: 'Uncaught TypeError: validate is not a function'
    00:18 - Network tab shows POST /api/checkout returned 400"
                |
8. EXTENSION wraps analysis in <video_analysis> block,
   combines with user's text, passes to Cline agent
                |
9. CLINE AGENT receives: user prompt + video analysis + workspace context
                |
10. AGENT decides tool calls:
    -> search_files(regex: "validate", path: "src/")
    -> Finds: src/utils/validation.ts, src/pages/Checkout.tsx
                |
11. AGENT reads files:
    -> read_file("src/pages/Checkout.tsx")
    -> read_file("src/utils/validation.ts")
                |
12. AGENT identifies bug: validate function is imported but not called,
    or imported incorrectly
                |
13. AGENT writes fix:
    -> write_to_file("src/pages/Checkout.tsx") with fix
    [USER SEES DIFF PREVIEW, CLICKS "APPROVE"]
                |
14. AGENT verifies:
    -> execute_command("npm run build")
    [USER APPROVES]
    -> Build succeeds
                |
15. AGENT calls attempt_completion:
    "Fixed the checkout validation bug. The issue was that the validate
     function from validation.ts was imported but never called in the
     form submit handler (visible at 00:12 in your recording). I added
     email validation before form submission and an error toast for
     invalid inputs."
```

### 2.8 Video Analysis Does NOT Replace the Coding LLM

Important distinction:
- **Gemini** = Vision expert. It SEES the video and describes what's happening.
- **Cline Agent LLM** (Claude/GPT/Gemini/etc.) = Coding expert. It reads code, writes fixes, runs commands.

The user can use ANY LLM for the Cline agent (Claude, GPT-4, Gemini, local models). The video analysis always uses Gemini because it has the best video understanding. The coding agent just receives the analysis as text context.

```
Video Analysis:  ALWAYS Gemini (frame-by-frame vision)
Coding Agent:    User's choice (Claude, GPT, Gemini, Ollama, etc.)
```

If the user chooses Gemini as their coding agent too, it's a dual Gemini setup where Gemini both sees the video AND writes the code. But they're separate API calls with different purposes.

---

## 3. Files to DELETE (Chrome Extension Removal) (renumbered from here)

The following files are Chrome extension artifacts and must be removed:

| File | Reason |
|------|--------|
| `popup.html` | Chrome extension popup UI |
| `popup.js` | Chrome extension popup logic |
| `styles.css` | Chrome extension styles |
| `manifest.json` | Chrome extension manifest (MV3) |

**Note:** The `package.json` remains (it's the VS Code extension config, not Chrome).

---

## 3. SDK Migration

### 3.1 Current State
```json
"@google/generative-ai": "^0.18.0"
```
Current VideoManager uses:
- `GoogleGenerativeAI` from `@google/generative-ai`
- `GoogleAIFileManager` from `@google/generative-ai/server`
- Model: `gemini-1.5-flash-002` (outdated)

### 3.2 Target State
```json
"@google/genai": "^1.x.x"
```
New unified SDK with:
- `GoogleGenAI` — single entry point
- `ai.files.upload()` — File API
- `ai.models.generateContent()` — content generation
- `createUserContent()`, `createPartFromUri()` — helper functions
- Built-in YouTube URL support

### 3.3 Migration Steps

**Step 1:** Remove old package
```bash
npm uninstall @google/generative-ai
```

**Step 2:** Install new package
```bash
npm install @google/genai
```

**Step 3:** Update all imports across the project:

| Old Import | New Import |
|-----------|------------|
| `import { GoogleGenerativeAI } from "@google/generative-ai"` | `import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai"` |
| `import { GoogleAIFileManager, FileState } from "@google/generative-ai/server"` | File management built into `GoogleGenAI.files` |

**Affected files:**
- `src/integrations/video/VideoManager.ts`
- `src/api/providers/gemini.ts`
- `src/api/transform/gemini-format.ts`

---

## 4. Gemini Model Updates

### 4.1 Updated Model Registry

Update `src/shared/api.ts` with latest models:

```typescript
export const geminiDefaultModelId: GeminiModelId = "gemini-2.5-flash"

export const geminiModels = {
    "gemini-2.5-pro": {
        maxTokens: 65536,
        contextWindow: 1_048_576,
        supportsImages: true,
        supportsVideo: true,          // NEW field
        maxVideosPerRequest: 10,       // NEW field
        supportsPromptCache: true,
        inputPrice: 1.25,             // per 1M tokens (<=200K)
        outputPrice: 10.0,            // per 1M tokens (<=200K)
    },
    "gemini-2.5-flash": {
        maxTokens: 65536,
        contextWindow: 1_048_576,
        supportsImages: true,
        supportsVideo: true,
        maxVideosPerRequest: 10,
        supportsPromptCache: true,
        inputPrice: 0.15,
        outputPrice: 0.60,
    },
    "gemini-2.5-flash-lite": {
        maxTokens: 65536,
        contextWindow: 1_048_576,
        supportsImages: true,
        supportsVideo: true,
        maxVideosPerRequest: 10,
        supportsPromptCache: false,
        inputPrice: 0.075,
        outputPrice: 0.30,
    },
    "gemini-2.0-flash": {
        maxTokens: 8192,
        contextWindow: 1_048_576,
        supportsImages: true,
        supportsVideo: true,
        maxVideosPerRequest: 1,
        supportsPromptCache: false,
        inputPrice: 0.10,
        outputPrice: 0.40,
    },
} as const satisfies Record<string, ModelInfo>
```

### 4.2 ModelInfo Interface Update

```typescript
export interface ModelInfo {
    maxTokens: number
    contextWindow: number
    supportsImages: boolean
    supportsVideo: boolean           // NEW
    maxVideosPerRequest?: number     // NEW
    supportsPromptCache: boolean
    inputPrice: number
    outputPrice: number
}
```

---

## 5. VideoManager Refactoring

### 5.1 Current Implementation Issues
1. Uses outdated SDK (`@google/generative-ai`)
2. Hardcoded model: `gemini-1.5-flash-002`
3. No YouTube support
4. No FPS configuration
5. No resolution control
6. No segment analysis (start/end timestamps)
7. No progress callbacks

### 5.2 New VideoManager Architecture

**File:** `src/integrations/video/VideoManager.ts`

```typescript
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import * as vscode from "vscode";

export interface VideoUploadOptions {
    filePath: string;
    mimeType?: string;
    displayName?: string;
}

export interface VideoAnalysisOptions {
    prompt: string;
    modelId?: string;
    fps?: number;                    // default: 1
    resolution?: "default" | "low";  // default: "default"
    startOffset?: string;            // "MM:SS" format
    endOffset?: string;              // "MM:SS" format
}

export interface VideoUploadProgress {
    status: "uploading" | "processing" | "ready" | "failed";
    progress?: number;               // 0-100 for upload
    message?: string;
}

export interface UploadedVideo {
    uri: string;
    mimeType: string;
    name: string;
    displayName: string;
    sizeBytes: string;
    state: string;
}

export class VideoManager {
    private ai: GoogleGenAI;
    private onProgress?: (progress: VideoUploadProgress) => void;

    constructor(apiKey: string) {
        this.ai = new GoogleGenAI({ apiKey });
    }

    setProgressCallback(callback: (progress: VideoUploadProgress) => void): void {
        this.onProgress = callback;
    }

    /**
     * Upload a local video file to Gemini File API
     */
    async uploadLocalVideo(options: VideoUploadOptions): Promise<UploadedVideo> {
        this.emitProgress({ status: "uploading", progress: 0, message: "Starting upload..." });

        const mimeType = options.mimeType || this.getMimeType(options.filePath);
        const displayName = options.displayName || this.getFileName(options.filePath);

        // Upload via File API
        const uploadResult = await this.ai.files.upload({
            file: options.filePath,
            config: { mimeType, displayName },
        });

        this.emitProgress({ status: "processing", message: "Video uploaded. Processing..." });

        // Poll for processing completion
        const file = await this.waitForProcessing(uploadResult.name);

        this.emitProgress({ status: "ready", progress: 100, message: "Video ready for analysis" });

        return {
            uri: file.uri,
            mimeType: file.mimeType,
            name: file.name,
            displayName: file.displayName,
            sizeBytes: file.sizeBytes,
            state: file.state,
        };
    }

    /**
     * Analyze a video (uploaded file or YouTube URL) with Gemini
     */
    async analyzeVideo(
        videoSource: { type: "file"; uri: string; mimeType: string } | { type: "youtube"; url: string },
        options: VideoAnalysisOptions
    ): Promise<AsyncGenerator<string>> {
        const modelId = options.modelId || "gemini-2.5-flash";

        // Build content parts
        const parts: any[] = [];

        if (videoSource.type === "file") {
            parts.push(createPartFromUri(videoSource.uri, videoSource.mimeType));
        } else {
            // YouTube URL — Gemini handles this natively
            parts.push({
                fileData: {
                    fileUri: videoSource.url,
                    mimeType: "video/*",
                },
            });
        }

        // Build prompt with optional timestamp constraints
        let prompt = options.prompt;
        if (options.startOffset || options.endOffset) {
            prompt += `\n\nFocus your analysis on the segment from ${options.startOffset || "00:00"} to ${options.endOffset || "end"}.`;
        }
        if (options.fps && options.fps !== 1) {
            prompt += `\n\nAnalyze at ${options.fps} frames per second for more detail.`;
        }

        parts.push(prompt);

        // Stream response
        const response = await this.ai.models.generateContentStream({
            model: modelId,
            contents: createUserContent(parts),
            config: {
                mediaResolution: options.resolution === "low" ? "low" : undefined,
            },
        });

        return response;
    }

    /**
     * Poll Gemini File API until video processing completes
     */
    private async waitForProcessing(fileName: string): Promise<any> {
        let file = await this.ai.files.get({ name: fileName });
        let pollCount = 0;

        while (file.state === "PROCESSING") {
            pollCount++;
            this.emitProgress({
                status: "processing",
                message: `Processing video... (${pollCount * 5}s elapsed)`,
            });
            await new Promise((resolve) => setTimeout(resolve, 5000));
            file = await this.ai.files.get({ name: fileName });
        }

        if (file.state === "FAILED") {
            this.emitProgress({ status: "failed", message: "Video processing failed" });
            throw new Error("Video processing failed on Gemini servers");
        }

        return file;
    }

    private emitProgress(progress: VideoUploadProgress): void {
        this.onProgress?.(progress);
    }

    private getMimeType(filePath: string): string {
        const extension = filePath.split(".").pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
            mp4: "video/mp4",
            mpeg: "video/mpeg",
            mov: "video/mov",
            avi: "video/avi",
            flv: "video/x-flv",
            mpg: "video/mpg",
            webm: "video/webm",
            wmv: "video/wmv",
            "3gp": "video/3gpp",
        };
        return mimeTypes[extension || ""] || "video/mp4";
    }

    private getFileName(filePath: string): string {
        return filePath.split(/[\\/]/).pop() || "uploaded_video";
    }
}
```

---

## 6. YouTubeHandler (New Module)

**File:** `src/integrations/video/YouTubeHandler.ts`

```typescript
export interface YouTubeVideoInfo {
    url: string;
    videoId: string;
    isValid: boolean;
}

export class YouTubeHandler {
    // Regex patterns for YouTube URLs
    private static URL_PATTERNS = [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];

    /**
     * Check if a string contains a YouTube URL
     */
    static isYouTubeUrl(text: string): boolean {
        return YouTubeHandler.URL_PATTERNS.some((pattern) => pattern.test(text));
    }

    /**
     * Extract YouTube video ID and validate URL
     */
    static extractVideoInfo(url: string): YouTubeVideoInfo {
        for (const pattern of YouTubeHandler.URL_PATTERNS) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return {
                    url: url.trim(),
                    videoId: match[1],
                    isValid: true,
                };
            }
        }
        return { url: url.trim(), videoId: "", isValid: false };
    }

    /**
     * Normalize YouTube URL to standard format for Gemini API
     */
    static normalizeUrl(url: string): string {
        const info = YouTubeHandler.extractVideoInfo(url);
        if (info.isValid) {
            return `https://www.youtube.com/watch?v=${info.videoId}`;
        }
        throw new Error("Invalid YouTube URL");
    }
}
```

---

## 7. ClineProvider Updates

### 7.1 New Webview Message Types

Add to the message handler in `src/core/webview/ClineProvider.ts`:

```typescript
// New message types for video features
interface VideoWebviewMessages {
    // From Webview -> Extension
    "uploadVideo": { /* triggers file picker */ }
    "analyzeYouTubeUrl": { url: string; prompt: string }
    "analyzeUploadedVideo": { prompt: string; options?: VideoAnalysisOptions }
    "cancelVideoUpload": { }

    // From Extension -> Webview
    "videoUploadProgress": VideoUploadProgress
    "videoReady": { video: UploadedVideo }
    "videoAnalysisChunk": { text: string }
    "videoAnalysisComplete": { fullText: string }
    "videoError": { message: string }
}
```

### 7.2 Message Handler Additions

```typescript
case "uploadVideo": {
    // Open file picker
    const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
            "Video Files": ["mp4", "webm", "mov", "avi", "flv", "mpg", "wmv", "3gp", "mpeg"],
        },
        title: "Select Video for Analysis",
    });

    if (fileUri && fileUri[0]) {
        const filePath = fileUri[0].fsPath;
        const apiKey = this.getGeminiApiKey();

        if (!apiKey) {
            this.postMessageToWebview({ type: "videoError", message: "Gemini API key not configured. Go to Settings." });
            return;
        }

        const videoManager = new VideoManager(apiKey);
        videoManager.setProgressCallback((progress) => {
            this.postMessageToWebview({ type: "videoUploadProgress", ...progress });
        });

        try {
            const video = await videoManager.uploadLocalVideo({ filePath });
            this.postMessageToWebview({ type: "videoReady", video });
        } catch (error) {
            this.postMessageToWebview({ type: "videoError", message: error.message });
        }
    }
    break;
}

case "analyzeYouTubeUrl": {
    const { url, prompt } = message;

    if (!YouTubeHandler.isYouTubeUrl(url)) {
        this.postMessageToWebview({ type: "videoError", message: "Invalid YouTube URL" });
        return;
    }

    const normalizedUrl = YouTubeHandler.normalizeUrl(url);
    const apiKey = this.getGeminiApiKey();
    const videoManager = new VideoManager(apiKey);

    try {
        const stream = await videoManager.analyzeVideo(
            { type: "youtube", url: normalizedUrl },
            { prompt, modelId: this.getSelectedGeminiModel() }
        );
        // Stream results to webview
        for await (const chunk of stream) {
            this.postMessageToWebview({ type: "videoAnalysisChunk", text: chunk.text() });
        }
        this.postMessageToWebview({ type: "videoAnalysisComplete" });
    } catch (error) {
        this.postMessageToWebview({ type: "videoError", message: error.message });
    }
    break;
}
```

---

## 8. Webview UI Changes

### 8.1 New Components

#### VideoUploadButton (`webview-ui/src/components/chat/VideoUploadButton.tsx`)
- Video camera icon button in chat input toolbar
- Click triggers `uploadVideo` message to extension
- Shows upload progress overlay during upload

#### VideoPreview (`webview-ui/src/components/chat/VideoPreview.tsx`)
- Displays video info (name, size, duration) in chat
- Shows processing status with spinner
- "Ready for analysis" badge when complete
- Remove button to clear uploaded video

#### YouTubeLinkDetector (logic in `ChatTextArea.tsx`)
- Detects YouTube URLs as user types in chat input
- Shows video preview card when YouTube URL detected
- Auto-suggests "Analyze this video" prompt

### 8.2 ChatTextArea Updates

**File:** `webview-ui/src/components/chat/ChatTextArea.tsx`

Add to the input toolbar (alongside existing image attachment):

```
[@ mention] [image] [VIDEO UPLOAD] [YouTube detected badge] [send]
```

Changes:
- Add video upload button next to image button
- YouTube URL auto-detection on input change
- Video attachment state management
- Show attached video info above input area

### 8.3 ChatView Updates

**File:** `webview-ui/src/components/chat/ChatView.tsx`

- Handle new message types: `videoUploadProgress`, `videoReady`, `videoAnalysisChunk`, `videoError`
- Display video analysis results as streaming chat messages
- Show video processing status inline in chat

### 8.4 Settings Updates

**File:** `webview-ui/src/components/settings/ApiOptions.tsx`

Add under Gemini provider settings:

```
Gemini API Key: [___________]
Video Analysis Model: [gemini-2.5-flash v]
Video Resolution: [Default (better quality)] / [Low (3x longer videos)]
Analysis FPS: [1] (frames per second, 0.5 - 5)
```

### 8.5 ExtensionStateContext Updates

**File:** `webview-ui/src/context/ExtensionStateContext.tsx`

Add new state fields:

```typescript
interface ExtensionState {
    // ... existing fields
    uploadedVideo?: UploadedVideo | null;
    videoUploadProgress?: VideoUploadProgress | null;
    videoAnalysisModel?: string;
    videoResolution?: "default" | "low";
    videoFps?: number;
}
```

---

## 9. Extension Commands Update

### 9.1 Updated package.json Commands

```json
{
    "commands": [
        {
            "command": "cline.plusButtonClicked",
            "title": "New Task",
            "icon": "$(add)"
        },
        {
            "command": "cline.mcpButtonClicked",
            "title": "MCP Servers",
            "icon": "$(server)"
        },
        {
            "command": "cline.historyButtonClicked",
            "title": "History",
            "icon": "$(history)"
        },
        {
            "command": "cline.popoutButtonClicked",
            "title": "Open in Editor",
            "icon": "$(link-external)"
        },
        {
            "command": "cline.settingsButtonClicked",
            "title": "Settings",
            "icon": "$(settings-gear)"
        },
        {
            "command": "cline.openInNewTab",
            "title": "Open In New Tab",
            "category": "Cline"
        },
        {
            "command": "neoyn.uploadVideo",
            "title": "NeoynGPT: Upload Video for Analysis"
        },
        {
            "command": "neoyn.analyzeYouTubeVideo",
            "title": "NeoynGPT: Analyze YouTube Video"
        }
    ]
}
```

### 9.2 Updated Configuration

```json
{
    "configuration": {
        "properties": {
            "cline.geminiApiKey": {
                "type": "string",
                "default": "",
                "description": "Google Gemini API Key for video analysis and chat"
            },
            "neoyn.videoAnalysisModel": {
                "type": "string",
                "default": "gemini-2.5-flash",
                "enum": ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
                "description": "Gemini model to use for video analysis"
            },
            "neoyn.videoResolution": {
                "type": "string",
                "default": "default",
                "enum": ["default", "low"],
                "description": "Video analysis resolution. 'low' allows 3x longer videos but less detail."
            },
            "neoyn.videoFps": {
                "type": "number",
                "default": 1,
                "minimum": 0.5,
                "maximum": 5,
                "description": "Frames per second for video analysis (higher = more detail, more tokens)"
            }
        }
    }
}
```

---

## 10. API Flow — Technical Sequence

### 10.1 Local Video Upload + Analysis

```
Webview                    ClineProvider              VideoManager              Gemini API
  |                            |                          |                        |
  |-- uploadVideo ------------>|                          |                        |
  |                            |-- showOpenDialog() ----->|                        |
  |                            |<-- filePath -------------|                        |
  |                            |                          |                        |
  |                            |-- uploadLocalVideo() --->|                        |
  |                            |                          |-- files.upload() ----->|
  |<-- videoUploadProgress ----|<-- progress callback ----|                        |
  |    (uploading...)          |                          |                        |
  |                            |                          |<-- uploadResult -------|
  |                            |                          |                        |
  |<-- videoUploadProgress ----|<-- progress callback ----|-- files.get() -------->|
  |    (processing...)         |                          |<-- state: PROCESSING --|
  |                            |                          |    (poll every 5s)     |
  |                            |                          |                        |
  |<-- videoUploadProgress ----|<-- progress callback ----|<-- state: ACTIVE ------|
  |    (ready!)                |                          |                        |
  |<-- videoReady -------------|<-- UploadedVideo --------|                        |
  |                            |                          |                        |
  |-- analyzeUploadedVideo --->|                          |                        |
  |   (prompt + options)       |-- analyzeVideo() ------->|                        |
  |                            |                          |-- generateContent() -->|
  |                            |                          |   (fileUri + prompt)   |
  |<-- videoAnalysisChunk -----|<-- stream chunks --------|<-- stream response ----|
  |<-- videoAnalysisChunk -----|<-- stream chunks --------|<-- stream response ----|
  |<-- videoAnalysisComplete --|                          |                        |
```

### 10.2 YouTube Video Analysis

```
Webview                    ClineProvider              VideoManager              Gemini API
  |                            |                          |                        |
  |-- analyzeYouTubeUrl ------>|                          |                        |
  |   (url + prompt)           |                          |                        |
  |                            |-- validate URL --------->|                        |
  |                            |-- normalizeUrl() ------->|                        |
  |                            |                          |                        |
  |                            |-- analyzeVideo() ------->|                        |
  |                            |   (type: "youtube")      |-- generateContent() -->|
  |                            |                          |   (youtubeUrl + prompt)|
  |<-- videoAnalysisChunk -----|<-- stream chunks --------|<-- stream response ----|
  |<-- videoAnalysisChunk -----|<-- stream chunks --------|<-- stream response ----|
  |<-- videoAnalysisComplete --|                          |                        |
```

---

## 11. Gemini API Reference

### 11.1 File Upload API

```typescript
// Upload a file
const file = await ai.files.upload({
    file: "/path/to/video.mp4",
    config: {
        mimeType: "video/mp4",
        displayName: "my-video",
    },
});

// Check processing status
const status = await ai.files.get({ name: file.name });
// status.state: "PROCESSING" | "ACTIVE" | "FAILED"

// Delete file (auto-deleted after 48 hours)
await ai.files.delete({ name: file.name });
```

### 11.2 Video Analysis API

```typescript
// Analyze uploaded video
const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: createUserContent([
        createPartFromUri(file.uri, file.mimeType),
        "Describe what you see in this video frame by frame."
    ]),
});

// Streaming variant
const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: createUserContent([
        createPartFromUri(file.uri, file.mimeType),
        "Analyze this screen recording and suggest code fixes."
    ]),
});
```

### 11.3 YouTube Video Analysis

```typescript
// Direct YouTube URL analysis (Gemini handles fetching)
const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: createUserContent([
        {
            fileData: {
                fileUri: "https://www.youtube.com/watch?v=VIDEO_ID",
                mimeType: "video/*",
            },
        },
        "Analyze this tutorial and generate the code shown."
    ]),
});
```

### 11.4 Timestamp-based Segment Analysis

```typescript
// Analyze specific segment
const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: createUserContent([
        createPartFromUri(file.uri, file.mimeType),
        "Analyze the segment from 02:30 to 05:00. What UI bugs do you see?"
    ]),
    config: {
        // Optional: control resolution
        mediaResolution: "low", // for longer videos
    },
});
```

### 11.5 Token Estimation

```typescript
// Estimate tokens before analysis
function estimateVideoTokens(
    durationSeconds: number,
    resolution: "default" | "low" = "default",
    fps: number = 1
): number {
    const tokensPerFrame = resolution === "default" ? 258 : 66;
    const audioTokensPerSecond = 32;
    const framesPerSecond = fps;

    const visualTokens = durationSeconds * framesPerSecond * tokensPerFrame;
    const audioTokens = durationSeconds * audioTokensPerSecond;

    return visualTokens + audioTokens;
}

// Example: 5-minute video at default resolution
// estimateVideoTokens(300) = 300 * 1 * 258 + 300 * 32 = 87,000 tokens
```

---

## 12. Prompt Engineering for Video Analysis

### 12.1 System Prompts for Different Use Cases

**Screen Recording Bug Analysis:**
```
You are a senior developer analyzing a screen recording of a web/mobile application.
Analyze the video FRAME BY FRAME. Focus on:
1. UI layout issues (misalignment, overflow, broken elements)
2. Visual bugs (wrong colors, missing images, flickering)
3. Console errors visible on screen
4. Network errors or loading issues
5. UX problems (confusing flow, missing feedback)

Reference specific timestamps (MM:SS) when describing issues.
Suggest specific code fixes for each issue found.
If you can see file names or code in the video, reference them directly.
```

**Tutorial Code Generation:**
```
You are a coding assistant analyzing a video tutorial.
Watch the video FRAME BY FRAME and:
1. Identify all code shown on screen
2. Transcribe the code accurately
3. Note any explanations given (audio or text on screen)
4. Generate complete, working code files based on what's shown
5. Add comments referencing the video timestamp where each section was shown

Output the code in proper file structure with correct syntax.
```

**App Feedback:**
```
You are a UX and code review expert analyzing a screen recording.
Analyze the application shown and provide:
1. Visual design feedback (layout, spacing, typography, colors)
2. Interaction feedback (animations, transitions, responsiveness)
3. Accessibility issues (contrast, font size, touch targets)
4. Performance observations (loading times, jank, lag)
5. Specific CSS/HTML/JS fixes for each issue

Reference timestamps and provide before/after code suggestions.
```

---

## 13. Error Handling Strategy

| Error Scenario | User Message | Recovery |
|----------------|-------------|----------|
| No Gemini API key | "Gemini API key not configured. Go to Settings to add your key." | Link to settings |
| File too large (>2GB free) | "Video file exceeds 2GB limit. Compress the video or upgrade to paid tier." | Show file size |
| Unsupported format | "Unsupported video format. Supported: MP4, WebM, MOV, AVI, FLV, MPG, WMV, 3GP." | List formats |
| Gemini processing failed | "Video processing failed. Try a shorter video or different format." | Retry button |
| YouTube video unavailable | "YouTube video is private or unavailable. Use a public video URL." | — |
| Rate limit exceeded | "Gemini API rate limit reached. Wait a moment and try again." | Auto-retry after delay |
| Network error | "Network error. Check your connection and try again." | Retry button |
| Context window exceeded | "Video too long for selected model. Use a shorter clip or switch to low resolution." | Show token estimate |
| YouTube daily limit (free) | "YouTube video daily limit reached (8 hours). Try again tomorrow or use a paid API key." | — |

---

## 14. File Structure — Final State

```
NeoynGPT-video-to-code/
├── src/
│   ├── extension.ts                          (UPDATED - remove Chrome ext refs)
│   ├── api/
│   │   ├── index.ts
│   │   ├── providers/
│   │   │   ├── gemini.ts                     (UPDATED - new SDK)
│   │   │   ├── anthropic.ts
│   │   │   ├── openai.ts
│   │   │   ├── openrouter.ts
│   │   │   ├── bedrock.ts
│   │   │   ├── vertex.ts
│   │   │   ├── ollama.ts
│   │   │   ├── lmstudio.ts
│   │   │   └── openai-native.ts
│   │   └── transform/
│   │       ├── gemini-format.ts              (UPDATED - new SDK)
│   │       ├── openai-format.ts
│   │       └── stream.ts
│   ├── core/
│   │   └── webview/
│   │       └── ClineProvider.ts              (UPDATED - video message handling)
│   ├── integrations/
│   │   ├── video/
│   │   │   ├── VideoManager.ts               (REWRITTEN - new SDK + features)
│   │   │   └── YouTubeHandler.ts             (NEW)
│   │   └── editor/
│   │       └── DiffViewProvider.ts
│   ├── services/
│   │   ├── mcp/
│   │   └── browser/
│   ├── shared/
│   │   └── api.ts                            (UPDATED - new models + ModelInfo)
│   ├── exports/
│   ├── utils/
│   └── test/
├── webview-ui/
│   └── src/
│       ├── components/
│       │   ├── chat/
│       │   │   ├── ChatView.tsx              (UPDATED - video messages)
│       │   │   ├── ChatTextArea.tsx           (UPDATED - video button + YT detect)
│       │   │   ├── VideoUploadButton.tsx      (NEW)
│       │   │   ├── VideoPreview.tsx           (NEW)
│       │   │   ├── ChatRow.tsx
│       │   │   └── ...
│       │   ├── settings/
│       │   │   ├── ApiOptions.tsx             (UPDATED - video settings)
│       │   │   └── ...
│       │   └── ...
│       ├── context/
│       │   └── ExtensionStateContext.tsx      (UPDATED - video state)
│       └── ...
├── docs/
│   ├── PRD.md                                (NEW)
│   └── TRD.md                                (NEW)
├── package.json                              (UPDATED - SDK + commands)
├── tsconfig.json
├── esbuild.js
├── CHANGELOG.md
├── README.md                                 (TO UPDATE)
├── LICENSE
│
├── popup.html                                (DELETE)
├── popup.js                                  (DELETE)
├── styles.css                                (DELETE)
└── manifest.json                             (DELETE)
```

---

## 15. Implementation Plan — Step by Step

### Step 1: Cleanup (Day 1)
- [ ] Delete `popup.html`, `popup.js`, `styles.css`, `manifest.json`
- [ ] Remove any Chrome extension references from `extension.ts`
- [ ] Verify extension still builds and runs: `npm run compile`

### Step 2: SDK Migration (Day 2-3)
- [ ] `npm uninstall @google/generative-ai`
- [ ] `npm install @google/genai`
- [ ] Update `src/api/providers/gemini.ts` imports and API calls
- [ ] Update `src/api/transform/gemini-format.ts` if needed
- [ ] Test chat functionality with Gemini still works

### Step 3: Model Registry Update (Day 3)
- [ ] Update `src/shared/api.ts` — add `supportsVideo`, update model list
- [ ] Update `ModelInfo` interface
- [ ] Set default model to `gemini-2.5-flash`
- [ ] Update pricing info

### Step 4: VideoManager Rewrite (Day 4-6)
- [ ] Rewrite `src/integrations/video/VideoManager.ts` with new SDK
- [ ] Add progress callbacks
- [ ] Add YouTube support in analyzer
- [ ] Add resolution and FPS options
- [ ] Add token estimation utility
- [ ] Unit test VideoManager

### Step 5: YouTubeHandler (Day 6-7)
- [ ] Create `src/integrations/video/YouTubeHandler.ts`
- [ ] URL validation and normalization
- [ ] Unit test URL patterns

### Step 6: ClineProvider Integration (Day 7-9)
- [ ] Add new message types for video features
- [ ] Implement `uploadVideo` handler with file picker
- [ ] Implement `analyzeYouTubeUrl` handler
- [ ] Implement `analyzeUploadedVideo` handler
- [ ] Wire up progress callbacks to webview messages
- [ ] Implement streaming response forwarding

### Step 7: Webview UI — Video Upload (Day 10-12)
- [ ] Create `VideoUploadButton.tsx` component
- [ ] Create `VideoPreview.tsx` component
- [ ] Update `ChatTextArea.tsx` — add video button to toolbar
- [ ] Update `ChatView.tsx` — handle video message types
- [ ] Upload progress bar UI
- [ ] Processing status spinner

### Step 8: Webview UI — YouTube (Day 12-13)
- [ ] Add YouTube URL detection in `ChatTextArea.tsx`
- [ ] YouTube video preview card component
- [ ] Auto-suggest analysis prompt on URL detection

### Step 9: Settings UI (Day 14)
- [ ] Update `ApiOptions.tsx` — video model selector
- [ ] Add resolution toggle (Default / Low)
- [ ] Add FPS slider
- [ ] Token usage estimator display
- [ ] Update `ExtensionStateContext.tsx` with video state

### Step 10: Prompt Engineering (Day 15)
- [ ] Implement system prompts for different use cases
- [ ] Add prompt templates: Bug Analysis, Tutorial Code Gen, App Feedback
- [ ] Context-aware prompting (include workspace info)

### Step 11: Error Handling (Day 16)
- [ ] Implement all error scenarios from Section 13
- [ ] Add retry logic for transient failures
- [ ] User-friendly error messages in UI

### Step 12: Testing (Day 17-19)
- [ ] Unit tests for VideoManager
- [ ] Unit tests for YouTubeHandler
- [ ] Integration tests for ClineProvider video handlers
- [ ] Manual testing with various video formats
- [ ] Manual testing with YouTube URLs
- [ ] Edge cases: large files, long videos, bad URLs

### Step 13: Documentation & Polish (Day 20)
- [ ] Update `README.md` with new features
- [ ] Update `CHANGELOG.md`
- [ ] Update `package.json` description and keywords
- [ ] Final build test: `npm run package`

---

## 16. Dependencies — Final package.json Updates

### Add
```json
"@google/genai": "^1.x.x"
```

### Remove
```json
"@google/generative-ai": "^0.18.0"
```

### Keep (unchanged)
```json
"@anthropic-ai/sdk": "^0.26.0"
"@anthropic-ai/bedrock-sdk": "^0.10.2"
"@anthropic-ai/vertex-sdk": "^0.4.1"
"openai": "^4.61.0"
"@modelcontextprotocol/sdk": "^1.0.1"
```

---

## 17. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Video analysis engine | Google Gemini only (for now) | Best-in-class video understanding, native frame sampling |
| Frame analysis method | Gemini auto-sampling (1 FPS) | No need to extract frames manually; Gemini handles it |
| YouTube handling | Direct URL to Gemini API | Gemini supports YouTube natively, no need to download |
| SDK | `@google/genai` (new unified) | Replaces `@google/generative-ai`, cleaner API, built-in File API |
| Default model | `gemini-2.5-flash` | Best price-performance, supports 10 videos, 1M context |
| Streaming | Yes, for all analysis | Better UX, results appear progressively |
| Chrome extension | Removed | Out of scope, focus on VS Code extension only |
| Transcript analysis | NOT used | Vision-first approach — analyze what the model SEES, not just hears |
