import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(
  root,
  "skills/neoyngpt-video-to-code/scripts/analyze.mjs"
);

function run(args, env = {}, cwd = root) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    cwd,
    env: { ...process.env, ...env },
  });
}

describe("analyze CLI", () => {
  it("loads GEMINI_API_KEY from a cwd .env file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "yvi-env-"));
    writeFileSync(path.join(dir, ".env"), "GEMINI_API_KEY=from-dotenv-file\n");
    const env = { ...process.env, YVI_NO_DOTENV: "" };
    delete env.GEMINI_API_KEY;
    delete env.GOOGLE_API_KEY;
    delete env.YVI_NO_DOTENV;
    const result = spawnSync(
      process.execPath,
      [
        script,
        "--url",
        "https://youtu.be/jSWuepkuFrU",
        "--file",
        "clip.mp4",
        "--question",
        "x",
      ],
      { encoding: "utf8", cwd: dir, env }
    );
    assert.equal(result.status, 3);
    assert.match(result.stderr, /exactly one/);
  });

  it("prints help", () => {
    const result = run(["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /--url/);
    assert.match(result.stdout, /--file/);
  });

  it("exits 2 when the Gemini key is missing", () => {
    const result = run(
      ["--url", "https://youtu.be/jSWuepkuFrU", "--question", "What is on screen?"],
      { GEMINI_API_KEY: "", GOOGLE_API_KEY: "", YVI_NO_DOTENV: "1" }
    );
    assert.equal(result.status, 2);
    assert.match(result.stderr, /GEMINI_API_KEY/);
  });

  it("exits 3 when the local recording is missing", () => {
    const result = run(
      ["--file", "/tmp/neoyngpt-video-to-code-missing.mp4", "--question", "What is on screen?"],
      { GEMINI_API_KEY: "dummy", GOOGLE_API_KEY: "" }
    );
    assert.equal(result.status, 3);
    assert.match(result.stderr, /File not found/);
  });

  it("exits 3 for both --url and --file", () => {
    const result = run(
      [
        "--url",
        "https://youtu.be/jSWuepkuFrU",
        "--file",
        "clip.mp4",
        "--question",
        "x",
      ],
      { GEMINI_API_KEY: "dummy", GOOGLE_API_KEY: "" }
    );
    assert.equal(result.status, 3);
    assert.match(result.stderr, /exactly one/);
  });
});
