const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
]);

const VIDEO_MIME = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
};

export const DEFAULT_WINDOW_SECONDS = 180;
export const WARN_BYTES = 100 * 1024 * 1024;
export const MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const DEFAULT_MODEL = "gemini-3.8-flash";
export const FALLBACK_MODEL = "gemini-3.6-flash";

// Gemini 4 family. Short aliases so `--model hydrogen` works.
export const MODEL_ALIASES = {
  hydrogen: "gemini-4-hydrogen", // fast, low cost — good for most clips
  argon: "gemini-4-argon", // frontier default — dense or long UI walkthroughs
  carbon: "gemini-4-carbon", // strongest — hardest motion / layout questions
};

export function resolveModel(raw) {
  if (raw == null || String(raw).trim() === "") return DEFAULT_MODEL;
  const name = String(raw).trim();
  const key = name.toLowerCase().replace(/^gemini-4-/, "");
  return MODEL_ALIASES[key] || name;
}

export function parseTimestamp(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().replace(/,$/, "");

  if (/^\d+(\.\d+)?$/.test(s)) return Math.floor(Number(s));
  if (/^\d+(\.\d+)?s$/i.test(s)) return Math.floor(Number(s.slice(0, -1)));

  const youtubeClock = /^(\d+)h(\d+)m(\d+)s$/i.exec(s);
  if (youtubeClock) {
    return (
      Number(youtubeClock[1]) * 3600 +
      Number(youtubeClock[2]) * 60 +
      Number(youtubeClock[3])
    );
  }

  const hms = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(s);
  if (hms && s.length > 0 && (hms[1] || hms[2] || hms[3])) {
    return (
      Number(hms[1] || 0) * 3600 +
      Number(hms[2] || 0) * 60 +
      Number(hms[3] || 0)
    );
  }

  const parts = s.split(":");
  if (parts.length >= 2 && parts.length <= 3 && parts.every((p) => /^\d+$/.test(p))) {
    if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  }

  throw new Error(`Cannot parse timestamp: ${raw}`);
}

export function formatOffset(seconds) {
  return `${Math.max(0, Math.floor(Number(seconds)))}s`;
}

function hostname(url) {
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

export function parseYouTubeUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Not a valid URL. Pass a YouTube link with --url or a local video with --file.");
  }

  const host = hostname(url);
  if (!YOUTUBE_HOSTS.has(host)) {
    throw new Error(
      "Not a YouTube URL. Use --url for youtube.com / youtu.be, or --file for a local screen recording."
    );
  }

  let id = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] || null;
  } else {
    id = url.searchParams.get("v");
    if (!id) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live", "v", "watch"].includes(parts[0])) {
        id = parts[0] === "watch" ? parts[1] : parts[1];
      }
    }
  }

  if (id) id = id.replace(/[^A-Za-z0-9_-].*$/, "");
  if (!id || !YOUTUBE_ID.test(id)) {
    throw new Error("Could not find a YouTube video ID in that URL.");
  }

  let t =
    url.searchParams.get("t") ||
    url.searchParams.get("start") ||
    url.searchParams.get("time_continue");
  if (!t && url.hash) {
    const match = /(?:^|[&#?])t=([^&]+)/.exec(url.hash);
    if (match) t = decodeURIComponent(match[1]);
  }

  const startSeconds = t ? parseTimestamp(t) : null;
  return {
    id,
    canonical: `https://www.youtube.com/watch?v=${id}`,
    startSeconds,
  };
}

export function mimeFromPath(filePath) {
  const dot = filePath.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = filePath.slice(dot).toLowerCase();
  return VIDEO_MIME[ext] || null;
}

export function parseCli(argv) {
  const args = {
    url: null,
    file: null,
    question: null,
    t: null,
    window: null,
    model: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value == null || value.startsWith("--")) {
        throw new Error(`Missing value for ${token}`);
      }
      i += 1;
      return value;
    };

    if (token === "--help" || token === "-h") args.help = true;
    else if (token === "--url") args.url = next();
    else if (token === "--file") args.file = next();
    else if (token === "--question" || token === "-q") args.question = next();
    else if (token === "--t") args.t = next();
    else if (token === "--window") args.window = next();
    else if (token === "--model") args.model = next();
    else throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

export function resolveRequest(args) {
  if (!args.question || !String(args.question).trim()) {
    throw new Error("Missing --question. Ask about what is on screen (UI, motion, layout), not a transcript recap.");
  }

  const hasUrl = Boolean(args.url);
  const hasFile = Boolean(args.file);
  if (hasUrl === hasFile) {
    throw new Error("Pass exactly one of --url (YouTube) or --file (local screen recording).");
  }

  let youtube = null;
  if (hasUrl) youtube = parseYouTubeUrl(args.url);

  let startSeconds = args.t != null ? parseTimestamp(args.t) : youtube?.startSeconds ?? null;
  let windowSeconds = null;
  if (args.window != null) {
    windowSeconds = parseTimestamp(String(args.window));
  } else if (startSeconds != null) {
    windowSeconds = DEFAULT_WINDOW_SECONDS;
  }

  let endSeconds = null;
  if (startSeconds != null && windowSeconds != null) {
    endSeconds = startSeconds + windowSeconds;
  } else if (startSeconds == null && windowSeconds != null) {
    startSeconds = 0;
    endSeconds = windowSeconds;
  }

  const videoMetadata =
    startSeconds != null || endSeconds != null
      ? {
          ...(startSeconds != null ? { startOffset: formatOffset(startSeconds) } : {}),
          ...(endSeconds != null ? { endOffset: formatOffset(endSeconds) } : {}),
        }
      : null;

  return {
    kind: hasUrl ? "youtube" : "file",
    question: String(args.question).trim(),
    youtubeUrl: youtube?.canonical ?? null,
    filePath: args.file,
    mime: hasFile ? mimeFromPath(args.file) : "video/*",
    startSeconds,
    endSeconds,
    videoMetadata,
    model: args.model || process.env.GEMINI_MODEL || DEFAULT_MODEL,
    fullVideo: videoMetadata == null,
  };
}

export function designerPrompt(question) {
  return `You are a product designer watching the VIDEO, not the captions.

Question: ${question}

Rules:
- Describe what is ON SCREEN: layout, motion, timing, typography, icons, mascots, widgets, jank, clipping, spacing.
- Cite timestamps as MM:SS.
- If you cannot see it, say so. Do not use speech as a substitute for UI.
- Separate: (1) visual facts (2) design principles (3) how to apply or fix this in a mobile/web app.
- Watch the pixels. Ignore filler speech.
- If a timestamp window was given, stay in that chapter unless the question needs more.`;
}

export const HELP = `NeoynGPT:video-to-code — Gemini watches pixels (YouTube or a local recording)

Usage:
  node scripts/analyze.mjs --url <youtube-url> --question "<visual question>"
  node scripts/analyze.mjs --file <recording.mp4> --question "<visual question>"

Options:
  --url       Public YouTube URL (watch, youtu.be, shorts, embed)
  --file      Local screen recording (.mp4, .webm, .mov, …)
  --question  What to look at on screen (required)
  --t         Start time in seconds or MM:SS (default: t= from the URL)
  --window    Seconds to analyze from start (default: 180 if a start time exists)
  --model     Gemini model (default: GEMINI_MODEL or ${DEFAULT_MODEL})
  -h, --help  Show this help

Needs GEMINI_API_KEY (or GOOGLE_API_KEY). Public YouTube only. Local files are
uploaded to the Gemini File API. This does not play video in the editor.
`;
