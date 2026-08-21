# NeoynGPT:video-to-code

Paste a **public** YouTube link **or** drop a **screen recording** of your app, and ask about **what is on screen** (UI, motion, layout, mascots, widgets, visual bugs). Needs a Gemini API key. Does not work on private/unlisted YouTube. Prefer a timestamp. This is sampled video, not frame-perfect. For “what did they say?”, use a transcript instead.

This is a recipe + script for Cursor, Claude Code, Codex, and other Agent Skills hosts. It does **not** play YouTube inside the editor.

## Install

```bash
# Any agent (Cursor, Claude Code, Codex, Gemini CLI, …)
npx skills add <your-github>/neoyngpt-video-to-code -g
```

Then in the copied skill folder:

```bash
cd ~/.cursor/skills/neoyngpt-video-to-code   # or ~/.claude/skills / ~/.agents/skills
npm install
export GEMINI_API_KEY=your_key               # https://aistudio.google.com/apikey
```

**Claude Code plugin:** `/plugin marketplace add <your-github>/neoyngpt-video-to-code` then install the plugin.

**Manual:** copy `skills/neoyngpt-video-to-code` into `~/.cursor/skills/`, `~/.claude/skills/`, or `~/.agents/skills/`.

**CLI from this repo:**

```bash
npm install
export GEMINI_API_KEY=your_key
npx neoyngpt-video-to-code --url "https://www.youtube.com/watch?v=…" --question "How does the tab animate?"
npx neoyngpt-video-to-code --file ./recording.mp4 --question "The tab transition stutters. What is on screen?"
```

## Use in Cursor

This skill **cannot** run in Ask / Chat (read-only) mode. Switch to **Agent**, start a **new** chat, then type `/neoyngpt-video-to-code` or paste a YouTube URL.

Cursor loads skills from `.cursor/skills/` and `~/.cursor/skills/`. This repo already links the skill there. Confirm under **Customize → Skills**.

The CLI reads `GEMINI_API_KEY` from the environment **or** from a project `.env` file (gitignored).

`/neoyngpt-video-to-code` or just paste:

> https://www.youtube.com/watch?v=jSWuepkuFrU&t=75s
> How does the calorie tracker UI feel? What’s moving on the right?

Screen recording of **your** app:

> [attach bug.mp4]
> At 0:08 the tab janks. What’s on screen, and how do we fix it in this repo?

The agent **must** run `scripts/analyze.mjs` before answering visual questions.

## Limits

| Limit | Reality |
| --- | --- |
| Public YouTube only | Unlisted/private/age-gated usually fail — use `--file` |
| Local mp4 | Chat attach or a path; uploaded to Gemini File API, not our servers |
| Sampling | ~1 fps typical. Fast 200ms motion can be missed |
| Length / cost | Prefer `--t` and `--window` (default 3 minutes if a start time exists) |
| No download default | YouTube URL is passed as-is. No yt-dlp |

## Develop

```bash
npm test
node skills/neoyngpt-video-to-code/scripts/analyze.mjs --help
```
