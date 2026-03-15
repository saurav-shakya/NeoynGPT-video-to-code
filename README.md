# NeoynGPT Video to Code

A VS Code extension that lets you upload screen recordings or paste YouTube links, analyzes them frame-by-frame using Google Gemini's vision AI, and then uses an AI coding agent to directly fix, implement, or improve code in your project.

## How It Works

**Two-phase pipeline:**

1. **Video Analysis (Gemini)** - Upload a local video or paste a YouTube URL. Gemini analyzes the video frame-by-frame (not transcript) at 1 FPS, identifying UI issues, code on screen, errors, and user interactions.

2. **Codebase Action (Cline Agent)** - The analysis is fed into the Cline coding agent, which has full access to your workspace. It reads files, searches code, writes fixes, and runs commands - all with your approval at every step.

## Features

- **Local Video Upload** - MP4, WebM, MOV, AVI, and more. Up to 2GB (free) / 20GB (paid)
- **YouTube Video Links** - Paste any YouTube URL, auto-detected in chat
- **Frame-by-Frame Analysis** - Gemini sees every frame, not just transcripts
- **Smart Analysis Modes** - Auto-detects: bug analysis, tutorial code gen, app feedback
- **Direct Codebase Integration** - Agent reads/writes your actual project files
- **Timestamp Segments** - Say "check from 01:30 to 03:00" to analyze specific parts
- **@ Mentions + Video** - Combine file references with video for targeted fixes
- **Multiple Gemini Models** - 2.5 Pro, 2.5 Flash, 2.5 Flash-Lite, 2.0 Flash
- **Resolution Control** - Default (best quality) or Low (3x longer videos)
- **Multi-Provider Chat** - Claude, GPT, Gemini, OpenRouter, Ollama, and more for coding

## Quick Start

1. Install the extension in VS Code
2. Open Settings and add your **Gemini API Key** (get one at [ai.google.dev](https://ai.google.dev/))
3. Click the video icon in the chat toolbar to upload a screen recording
4. Or paste a YouTube URL directly in the chat
5. Type your request (e.g. "Fix the navbar bug" or "Build what's shown in this tutorial")
6. The AI analyzes the video and makes changes to your codebase
7. Review and approve each change

## Use Cases

### Bug Fix from Screen Recording
Record your app showing the bug, upload it, and say "fix this". The AI sees the visual issue, finds the relevant code, and writes the fix.

### Code from YouTube Tutorial
Paste a tutorial link and say "implement this in my project". The AI watches the tutorial, transcribes the code, and adapts it to your project structure.

### App UX Review
Record your app's flow, upload it, and say "review the UX". The AI gives feedback on design, accessibility, and performance with specific code fixes.

## Video Specifications

| | Free Tier | Paid Tier |
|---|---|---|
| Max file size | 2 GB | 20 GB |
| Max duration (default res) | ~1 hour | ~1 hour |
| Max duration (low res) | ~3 hours | ~3 hours |
| YouTube daily limit | 8 hours | Unlimited |

Supported formats: MP4, WebM, MOV, AVI, MPEG, FLV, MPG, WMV, 3GP

## Token Costs (gemini-2.5-flash)

| Video Length | Default Res | Low Res |
|---|---|---|
| 1 minute | ~17K tokens (~$0.003) | ~6K tokens (~$0.001) |
| 5 minutes | ~87K tokens (~$0.013) | ~29K tokens (~$0.004) |
| 30 minutes | ~522K tokens (~$0.078) | ~176K tokens (~$0.026) |
| 1 hour | ~1M tokens (~$0.156) | ~353K tokens (~$0.053) |

## Settings

| Setting | Default | Description |
|---|---|---|
| Gemini API Key | - | Required for video analysis |
| Video Analysis Model | gemini-2.5-flash | Model used for video analysis |
| Video Resolution | default | default (better quality) or low (longer videos) |

## Credits

Based on [Cline](https://github.com/cline/cline). Extended with video analysis capabilities using Google Gemini API.

## License

Apache-2.0 License
