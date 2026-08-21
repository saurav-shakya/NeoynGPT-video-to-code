import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function parseEnvText(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function applyEnvFile(filePath, env = process.env) {
  if (!existsSync(filePath)) return false;
  const parsed = parseEnvText(readFileSync(filePath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (env[key] == null || env[key] === "") env[key] = value;
  }
  return true;
}

export function loadDotEnv({ cwd = process.cwd(), skillRoot, env = process.env } = {}) {
  if (env.YVI_NO_DOTENV === "1") return;
  const files = [
    cwd ? path.join(cwd, ".env") : null,
    skillRoot ? path.join(skillRoot, ".env") : null,
    skillRoot ? path.join(skillRoot, "..", "..", ".env") : null,
  ].filter(Boolean);

  const seen = new Set();
  for (const file of files) {
    const resolved = path.resolve(file);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    applyEnvFile(resolved, env);
  }
}
