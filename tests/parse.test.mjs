import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_WINDOW_SECONDS,
  formatOffset,
  mimeFromPath,
  parseCli,
  parseTimestamp,
  parseYouTubeUrl,
  resolveModel,
  resolveRequest,
} from "../skills/neoyngpt-video-to-code/lib/parse.mjs";

describe("parseTimestamp", () => {
  it("parses seconds, clocks, and YouTube t= forms", () => {
    assert.equal(parseTimestamp("75"), 75);
    assert.equal(parseTimestamp("75s"), 75);
    assert.equal(parseTimestamp("1m15s"), 75);
    assert.equal(parseTimestamp("1h2m3s"), 3723);
    assert.equal(parseTimestamp("1:15"), 75);
    assert.equal(parseTimestamp("00:01:15"), 75);
    assert.equal(parseTimestamp(null), null);
  });

  it("rejects junk", () => {
    assert.throws(() => parseTimestamp("nope"), /Cannot parse timestamp/);
  });
});

describe("parseYouTubeUrl", () => {
  it("normalizes watch, short, and embed URLs", () => {
    const id = "jSWuepkuFrU";
    const canonical = `https://www.youtube.com/watch?v=${id}`;
    assert.deepEqual(parseYouTubeUrl(`https://www.youtube.com/watch?v=${id}`), {
      id,
      canonical,
      startSeconds: null,
    });
    assert.equal(parseYouTubeUrl(`https://youtu.be/${id}`).canonical, canonical);
    assert.equal(parseYouTubeUrl(`https://www.youtube.com/shorts/${id}`).id, id);
    assert.equal(parseYouTubeUrl(`https://www.youtube.com/embed/${id}`).id, id);
  });

  it("reads t= from query", () => {
    const parsed = parseYouTubeUrl(
      "https://www.youtube.com/watch?v=jSWuepkuFrU&t=75s"
    );
    assert.equal(parsed.startSeconds, 75);
  });

  it("rejects non-YouTube URLs", () => {
    assert.throws(
      () => parseYouTubeUrl("https://example.com/clip.mp4"),
      /Not a YouTube URL/
    );
  });
});

describe("mimeFromPath", () => {
  it("maps screen-recording extensions", () => {
    assert.equal(mimeFromPath("/tmp/bug.mp4"), "video/mp4");
    assert.equal(mimeFromPath("/tmp/bug.webm"), "video/webm");
    assert.equal(mimeFromPath("/tmp/bug.MOV"), "video/quicktime");
    assert.equal(mimeFromPath("/tmp/shot.png"), null);
  });
});

describe("resolveRequest", () => {
  it("requires exactly one of url or file", () => {
    assert.throws(
      () => resolveRequest(parseCli(["--question", "x"])),
      /exactly one/
    );
    assert.throws(
      () =>
        resolveRequest(
          parseCli([
            "--url",
            "https://youtu.be/jSWuepkuFrU",
            "--file",
            "a.mp4",
            "--question",
            "x",
          ])
        ),
      /exactly one/
    );
  });

  it("defaults a 3-minute window when t= is present", () => {
    const request = resolveRequest(
      parseCli([
        "--url",
        "https://www.youtube.com/watch?v=jSWuepkuFrU&t=75",
        "--question",
        "How does the tab move?",
      ])
    );
    assert.equal(request.kind, "youtube");
    assert.equal(request.startSeconds, 75);
    assert.equal(request.endSeconds, 75 + DEFAULT_WINDOW_SECONDS);
    assert.deepEqual(request.videoMetadata, {
      startOffset: "75s",
      endOffset: formatOffset(75 + DEFAULT_WINDOW_SECONDS),
    });
  });

  it("sends the full video when there is no timestamp", () => {
    const request = resolveRequest(
      parseCli([
        "--url",
        "https://youtu.be/jSWuepkuFrU",
        "--question",
        "What mascot is on the empty state?",
      ])
    );
    assert.equal(request.fullVideo, true);
    assert.equal(request.videoMetadata, null);
  });

  it("accepts a local recording path", () => {
    const request = resolveRequest(
      parseCli(["--file", "./rec.mp4", "--question", "Why does the tab stutter?"])
    );
    assert.equal(request.kind, "file");
    assert.equal(request.filePath, "./rec.mp4");
    assert.equal(request.mime, "video/mp4");
  });
});

describe("resolveModel", () => {
  it("maps Gemini 4 aliases to model ids", () => {
    assert.equal(resolveModel("hydrogen"), "gemini-4-hydrogen");
    assert.equal(resolveModel("Argon"), "gemini-4-argon");
    assert.equal(resolveModel(" carbon "), "gemini-4-carbon");
    assert.equal(resolveModel("gemini-4-carbon"), "gemini-4-carbon");
  });

  it("passes other ids through and defaults when empty", () => {
    assert.equal(resolveModel("gemini-3.6-flash"), "gemini-3.6-flash");
    assert.equal(resolveModel(""), "gemini-3.8-flash");
    assert.equal(resolveModel(undefined), "gemini-3.8-flash");
  });

  it("resolveRequest applies aliases from --model", () => {
    const req = resolveRequest({
      url: "https://youtu.be/jSWuepkuFrU",
      question: "What is on screen?",
      model: "argon",
    });
    assert.equal(req.model, "gemini-4-argon");
  });
});
