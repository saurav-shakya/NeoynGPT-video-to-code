# Provider limits (Gemini only)

This skill uses **Gemini** only. No Qwen, Grok, yt-dlp, or ffmpeg.

## YouTube URL (`--url`)

- Public videos only. Private, unlisted, members-only, age-gated, or some region-blocked videos fail.
- Preview feature: Google may change pricing. Docs have cited **8 hours/day** of YouTube processing on the free tier.
- Pass the URL as `fileData.fileUri`. Do not download the video.
- Prefer `https://www.youtube.com/watch?v=ID`. `youtu.be` / Shorts are normalized to that.
- Live streams and premieres are unreliable until a public VOD exists.

## Local recording (`--file`)

- Screen recordings of the user's app: `.mp4`, `.webm`, `.mov`, and similar.
- Uploaded to the **Gemini File API** (temporary Google storage). This repo does not host video.
- Free File API docs cite ~2 GB per file. Prefer a 1–3 minute clip. This skill does not transcode.
- Chat attachments: use the absolute path the host gives you.

## Sampling

- Typical File API processing is about **1 fps** plus audio. Fast 200ms micro-interactions can be missed.
- YouTube compression is weak for 1px borders and exact fonts; fine for layout and motion.

## Models

- Default: `gemini-3.8-flash` (override with `--model` or `GEMINI_MODEL`).
- On “model not found”, the script retries `gemini-3.6-flash`.
- Newer models: up to 10 videos per request. This skill sends **one**.

## Cost

- A 40-minute talk with “analyze all UI” is slow and expensive. Use `--t` and `--window`.
- Talking-head footage wastes tokens; force a chapter.

## What this cannot do

- Play the video in the editor
- True 30 fps every-frame inspection
- Private YouTube via the URL path
- Perfect recreation of shaders from a compressed encode
- Read haptics unless they are shown or spoken on screen
