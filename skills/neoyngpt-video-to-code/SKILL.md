---
name: neoyngpt-video-to-code
description: Use when the user pastes a YouTube URL, attaches a screen recording or .mp4/.webm/.mov, or asks about on-screen UI, motion, layout, color, mascots, widgets, or visual bugs captions cannot answer. Also use when they type /neoyngpt-video-to-code. Do not use for transcript-only summaries.
license: MIT
compatibility: Requires Node 18+, npm, @google/genai, GEMINI_API_KEY, and network access to the Gemini API. YouTube input is public videos only. Local files are uploaded to the Gemini File API.
---

# NeoynGPT:video-to-code

Paste a **public** YouTube link **or** a **screen recording** (`.mp4` / `.webm` / `.mov`) and ask about **what is on screen**. Gemini samples the video. This does not play YouTube inside the editor.

**Host / harness:** any Agent Skills harness (Cursor, Claude Code, Codex, Antigravity CLI `agy`, or another host that loads this `SKILL.md`). It must be allowed to run Node. Ask / Chat / read-only modes cannot call Gemini.

Never claim you watched the video unless `scripts/analyze.mjs` ran. Never answer visual questions from a transcript alone.

`GEMINI_API_KEY` may live in the environment or a project `.env`. The script loads `.env` itself.

## When not to use

- “Summarize what they said” → captions/transcript, not this skill
- Private/unlisted YouTube → fail; ask for a local recording instead
- Download this video → not the feature

## Workflow

1. Parse input + question.
   - YouTube URL → `--url`
   - Chat attachment or path to a recording → `--file` (absolute path)
   - Speech-only question → stop; do not run the script
2. Skill root = the folder that contains this `SKILL.md`.
3. If `node_modules` is missing: `npm install` in the skill root (or the plugin repo root).
4. Run the script (never invent a new pipeline):

```bash
node scripts/analyze.mjs --url "YOUTUBE_URL" --question "USER_QUESTION"
node scripts/analyze.mjs --file "/abs/path/recording.mp4" --question "USER_QUESTION"
```

Optional: `--t 75 --window 180 --model gemini-3.8-flash`. `t=` on the YouTube link is picked up automatically. Prefer a timestamp on long videos.

5. Treat stdout as **ground truth for pixels**, not as code. stderr is diagnostics.
6. Answer with **timestamps + what is visible** (motion, spacing, icons, jank).
7. If a repo is open:
   - YouTube demo → 3 concrete UI/motion takeaways for **existing** components
   - Their screen recording → name the broken motion/layout, then **fix this codebase**. Do not invent a new design system unless they ask.

Needs `GEMINI_API_KEY` (https://aistudio.google.com/apikey). Missing key: tell them to export it; do not guess the UI.

## Output shape

1. Visual facts (timestamps)
2. Design principles
3. How to apply or fix **here**

Honesty: sampled video (~1 fps typical), not frame-perfect. You can say a tab slides with a bounce; you cannot guarantee `damping: 0.82` unless that is on screen.

## Errors

- Private/unlisted YouTube → public URL or `--file`
- Quota / 8h free YouTube cap → shorter `--window` or wait
- Huge recording → ask for a 1–3 minute clip (no ffmpeg in this skill)

Details: [references/prompts.md](references/prompts.md), [references/providers.md](references/providers.md).
