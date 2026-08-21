#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "../lib/env.mjs";
import {
  designerPrompt,
  FALLBACK_MODEL,
  HELP,
  MAX_BYTES,
  WARN_BYTES,
  mimeFromPath,
  parseCli,
  resolveRequest,
} from "../lib/parse.mjs";

const EXIT = {
  usage: 1,
  missingKey: 2,
  badInput: 3,
  api: 4,
};

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function apiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

async function loadGenAI() {
  try {
    return await import("@google/genai");
  } catch {
    fail(
      EXIT.badInput,
      `Missing @google/genai. From the skill folder run:\n  npm install\nSkill folder: ${skillRoot}`
    );
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isActive(state) {
  const value = String(state || "").toUpperCase();
  return value === "ACTIVE" || value.endsWith("ACTIVE");
}

function isFailed(state) {
  const value = String(state || "").toUpperCase();
  return value === "FAILED" || value.endsWith("FAILED");
}

function isProcessing(state) {
  const value = String(state || "").toUpperCase();
  return value.includes("PROCESSING") || value.includes("STATE_UNSPECIFIED") || value === "";
}

async function waitUntilActive(ai, uploaded, timeoutMs = 5 * 60 * 1000) {
  const started = Date.now();
  let file = uploaded;
  while (!isActive(file.state)) {
    if (isFailed(file.state)) {
      throw new Error(
        `Gemini finished processing this file with state ${file.state}. Try a shorter clip (mp4/webm).`
      );
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for Gemini to process the uploaded video.");
    }
    if (!isProcessing(file.state) && !isActive(file.state) && !isFailed(file.state)) {
      // Unknown state: keep polling a bit, then treat as active if uri exists.
      if (file.uri && Date.now() - started > 8000) break;
    }
    process.stderr.write(`Uploading/processing… (${file.state || "waiting"})\n`);
    await sleep(2000);
    file = await ai.files.get({ name: file.name });
  }
  return file;
}

function videoPart({ fileUri, mimeType, videoMetadata }) {
  const part = {
    fileData: {
      fileUri,
      mimeType: mimeType || "video/*",
    },
  };
  if (videoMetadata) part.videoMetadata = videoMetadata;
  return part;
}

function looksLikeMissingModel(error) {
  const text = String(error?.message || error);
  return /not found|NOT_FOUND|is not found|unknown model|invalid model/i.test(text);
}

function explainApiError(error) {
  const text = String(error?.message || error);
  if (/unlisted|private|not publicly|PERMISSION_DENIED|failed to fetch the video/i.test(text)) {
    return "Gemini could not read that YouTube video. It must be public (not private, unlisted, age-gated, or region-blocked). For a private recording, use --file with a local mp4.";
  }
  if (/quota|rate limit|resource exhausted|8 hours/i.test(text)) {
    return "Gemini quota or YouTube processing cap hit (free tier docs cite 8 hours of YouTube per day). Wait, use a shorter --window, or a paid key.";
  }
  if (/API key|api.?key|UNAUTHENTICATED|invalid x-goog-api-key/i.test(text)) {
    return "Gemini rejected the API key. Set GEMINI_API_KEY from https://aistudio.google.com/apikey";
  }
  return text;
}

async function generate(ai, { model, parts }) {
  const tryModel = async (name) => {
    const response = await ai.models.generateContent({
      model: name,
      contents: [{ role: "user", parts }],
    });
    const text = response?.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }
    return { text, model: name };
  };

  try {
    return await tryModel(model);
  } catch (error) {
    if (model !== FALLBACK_MODEL && looksLikeMissingModel(error)) {
      process.stderr.write(`Model ${model} unavailable, retrying ${FALLBACK_MODEL}…\n`);
      return tryModel(FALLBACK_MODEL);
    }
    throw error;
  }
}

async function analyzeYouTube(ai, request) {
  if (request.fullVideo) {
    process.stderr.write("No timestamp given — sending the full public video. A --t / --window is cheaper.\n");
  }
  return generate(ai, {
    model: request.model,
    parts: [
      videoPart({
        fileUri: request.youtubeUrl,
        mimeType: "video/*",
        videoMetadata: request.videoMetadata,
      }),
      { text: designerPrompt(request.question) },
    ],
  });
}

async function analyzeFile(ai, request) {
  const filePath = path.resolve(request.filePath);
  const mime = mimeFromPath(filePath);
  if (!mime) {
    fail(
      EXIT.badInput,
      "Unsupported file type. Use a screen recording: .mp4, .webm, .mov, .mpeg, .mpg, .avi, or .mkv."
    );
  }

  let info;
  try {
    info = await stat(filePath);
  } catch {
    fail(EXIT.badInput, `File not found: ${filePath}`);
  }
  if (!info.isFile()) fail(EXIT.badInput, `Not a file: ${filePath}`);
  if (info.size > MAX_BYTES) {
    fail(
      EXIT.badInput,
      `File is ${(info.size / (1024 * 1024)).toFixed(0)} MB. Gemini File API free cap is 2 GB — record a shorter clip. This tool does not transcode.`
    );
  }
  if (info.size > WARN_BYTES) {
    process.stderr.write(
      `Warning: ${(info.size / (1024 * 1024)).toFixed(0)} MB recording. Uploads are slow and costly; a 1–3 minute clip is better.\n`
    );
  }

  process.stderr.write(`Uploading ${path.basename(filePath)} to Gemini File API…\n`);
  let uploaded;
  try {
    uploaded = await ai.files.upload({
      file: filePath,
      config: { mimeType: mime },
    });
  } catch {
    uploaded = await ai.files.upload({
      file: createReadStream(filePath),
      config: { mimeType: mime },
    });
  }

  const ready = await waitUntilActive(ai, uploaded);
  const uri = ready.uri || ready.fileUri;
  if (!uri) fail(EXIT.api, "Upload succeeded but Gemini did not return a file URI.");

  return generate(ai, {
    model: request.model,
    parts: [
      videoPart({
        fileUri: uri,
        mimeType: ready.mimeType || mime,
        videoMetadata: request.videoMetadata,
      }),
      { text: designerPrompt(request.question) },
    ],
  });
}

async function main() {
  loadDotEnv({ cwd: process.cwd(), skillRoot });

  let args;
  try {
    args = parseCli(process.argv.slice(2));
  } catch (error) {
    fail(EXIT.usage, `${error.message}\n\n${HELP}`);
  }

  if (args.help || process.argv.length <= 2) {
    process.stdout.write(HELP);
    process.exit(args.help ? 0 : EXIT.usage);
  }

  if (!apiKey()) {
    fail(
      EXIT.missingKey,
      "Missing GEMINI_API_KEY. Create one at https://aistudio.google.com/apikey then:\n  export GEMINI_API_KEY=your_key"
    );
  }

  let request;
  try {
    request = resolveRequest(args);
  } catch (error) {
    fail(EXIT.badInput, error.message);
  }

  const { GoogleGenAI } = await loadGenAI();
  const ai = new GoogleGenAI({ apiKey: apiKey() });

  try {
    const result =
      request.kind === "youtube" ? await analyzeYouTube(ai, request) : await analyzeFile(ai, request);
    process.stdout.write(`${result.text.trim()}\n`);
  } catch (error) {
    fail(EXIT.api, explainApiError(error));
  }
}

main();
