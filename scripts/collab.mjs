import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTHOR_WINDOW_MS = 60 * DAY_MS;
const GH_TIMEOUT_MS = 4000;

const TRUE_VALUE = /^(1|true|yes|on)$/i;
const FALSE_VALUE = /^(0|false|no|off)$/i;

function git(cwd, args) {
  try {
    const result = spawnSync("git", args, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      timeout: 8000,
    });
    if (result.error || result.status !== 0) return null;
    return result.stdout ?? "";
  } catch {
    return null;
  }
}

function configValue(cwd, key) {
  const out = git(cwd, ["config", "--get", key]);
  if (out == null) return null;
  const value = out.trim();
  return value === "" ? null : value;
}

export function flag(cwd, key) {
  const value = configValue(cwd, key);
  return value != null && TRUE_VALUE.test(value);
}

function override(cwd) {
  const value = configValue(cwd, "quality.collaborative");
  if (value == null) return null;
  if (TRUE_VALUE.test(value)) return true;
  if (FALSE_VALUE.test(value)) return false;
  return null;
}

function defaultBranchRef(cwd) {
  const symbolic = git(cwd, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
  if (symbolic) {
    const ref = symbolic.trim();
    if (ref.startsWith("refs/remotes/")) return ref.slice("refs/remotes/".length);
  }
  for (const name of ["main", "master"]) {
    const verified = git(cwd, ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${name}`]);
    if (verified) return `origin/${name}`;
  }
  return null;
}

export function defaultBranchName(cwd) {
  const ref = defaultBranchRef(cwd);
  if (!ref) return null;
  const slash = ref.lastIndexOf("/");
  return slash === -1 ? ref : ref.slice(slash + 1);
}

function codeownersReason(cwd) {
  const candidates = ["CODEOWNERS", path.join(".github", "CODEOWNERS"), path.join("docs", "CODEOWNERS")];
  for (const relative of candidates) {
    try {
      if (fs.existsSync(path.join(cwd, relative))) return "a CODEOWNERS file is present";
    } catch {
      return null;
    }
  }
  return null;
}

function otherAuthorsReason(cwd) {
  const email = configValue(cwd, "user.email");
  if (!email) return null;
  const branch = defaultBranchRef(cwd);
  if (!branch) return null;
  const since = new Date(Date.now() - AUTHOR_WINDOW_MS).toISOString();
  const log = git(cwd, ["log", branch, `--since=${since}`, "--format=%ae"]);
  if (log == null) return null;
  const others = new Set();
  for (const line of log.split(/\r?\n/)) {
    const author = line.trim().toLowerCase();
    if (!author || author === email.toLowerCase()) continue;
    others.add(author);
  }
  if (others.size === 0) return null;
  const noun = others.size === 1 ? "author" : "authors";
  return `${others.size} other ${noun} on ${branch} in the last 60 days`;
}

function githubRepo(cwd) {
  const url = git(cwd, ["remote", "get-url", "origin"]);
  if (!url) return null;
  const trimmed = url.trim().replace(/\.git$/, "");
  const ssh = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (ssh) return { owner: ssh[1], repo: ssh[2] };
  const https = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
  if (https) return { owner: https[1], repo: https[2] };
  return null;
}

function protectedBranchReason(cwd) {
  const branch = defaultBranchName(cwd);
  const repo = githubRepo(cwd);
  if (!branch || !repo) return null;
  try {
    const result = spawnSync(
      "gh",
      ["api", "--silent", `repos/${repo.owner}/${repo.repo}/branches/${branch}/protection`],
      {
        cwd,
        encoding: "utf8",
        windowsHide: true,
        timeout: GH_TIMEOUT_MS,
        env: { ...process.env, GH_PROMPT_DISABLED: "1", GIT_TERMINAL_PROMPT: "0" },
      },
    );
    if (result.error || result.status !== 0) return null;
    return `${branch} is a protected branch`;
  } catch {
    return null;
  }
}

export function collabStatus(cwd) {
  try {
    const forced = override(cwd);
    if (forced === true) return { collaborative: true, reason: "quality.collaborative is true" };
    if (forced === false) return { collaborative: false, reason: "quality.collaborative is false" };
    const reason = codeownersReason(cwd) ?? otherAuthorsReason(cwd) ?? protectedBranchReason(cwd);
    if (reason) return { collaborative: true, reason };
    return { collaborative: false, reason: "" };
  } catch {
    return { collaborative: false, reason: "" };
  }
}

function ranDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
}

if (ranDirectly()) {
  const roots = process.argv.slice(2).filter(Boolean);
  const targets = roots.length > 0 ? roots : [process.cwd()];
  const results = targets.map((root) => ({ root, ...collabStatus(root) }));
  process.stdout.write(`${JSON.stringify(results.length === 1 ? results[0] : results)}\n`);
}
