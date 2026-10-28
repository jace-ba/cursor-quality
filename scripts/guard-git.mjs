import { spawnSync } from "node:child_process";
import { collabStatus, defaultBranchName, flag } from "./collab.mjs";
import { readStdin } from "./patterns.mjs";

const TRAILER = /co-authored-by:\s*cursor\b|made-with:\s*cursor\b|cursoragent@cursor\.com/i;
const GLOBAL_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix"]);
const PUSH_WITH_VALUE = new Set(["-o", "--push-option", "--receive-pack", "--exec", "--repo"]);

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

function tokenize(command) {
  const tokens = [];
  let current = "";
  let quote = null;
  for (const char of command) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function invocation(tokens) {
  if (tokens.length === 0) return null;
  const program = tokens[0].replace(/^.*[\\/]/, "").toLowerCase();
  if (program !== "git" && program !== "git.exe") return null;
  let index = 1;
  while (index < tokens.length && tokens[index].startsWith("-")) {
    const token = tokens[index];
    index += 1;
    if (!token.includes("=") && GLOBAL_WITH_VALUE.has(token)) index += 1;
  }
  if (index >= tokens.length) return null;
  return { subcommand: tokens[index], rest: tokens.slice(index + 1) };
}

function currentBranch(cwd) {
  const name = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!name) return null;
  const trimmed = name.trim();
  return trimmed === "" || trimmed === "HEAD" ? null : trimmed;
}

function remotes(cwd) {
  const out = git(cwd, ["remote"]);
  if (!out) return new Set();
  return new Set(out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
}

function branchOf(refspec, head) {
  let spec = refspec.startsWith("+") ? refspec.slice(1) : refspec;
  const colon = spec.lastIndexOf(":");
  let dest = colon === -1 ? spec : spec.slice(colon + 1);
  if (dest === "HEAD") dest = head ?? "";
  dest = dest.replace(/^refs\/heads\//, "");
  return dest;
}

function pushTargets(cwd, rest) {
  const positionals = [];
  let allBranches = false;
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--") {
      positionals.push(...rest.slice(index + 1));
      break;
    }
    if (token === "--all" || token === "--mirror") {
      allBranches = true;
      continue;
    }
    if (token.startsWith("-")) {
      if (!token.includes("=") && PUSH_WITH_VALUE.has(token)) index += 1;
      continue;
    }
    positionals.push(token);
  }
  const head = currentBranch(cwd);
  const names = remotes(cwd);
  let specs = positionals;
  if (specs.length > 0 && names.has(specs[0])) specs = specs.slice(1);
  const targets = specs.map((spec) => branchOf(spec, head)).filter(Boolean);
  if (targets.length === 0 && head) targets.push(head);
  if (allBranches) {
    const fallback = defaultBranchName(cwd);
    if (fallback) targets.push(fallback);
  }
  return targets;
}

function sameBranch(left, right) {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}

function deny(userMessage, agentMessage) {
  return { permission: "deny", user_message: userMessage, agent_message: agentMessage };
}

function decide(input) {
  const command = typeof input.command === "string" ? input.command : "";
  const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  const parsed = invocation(tokenize(command));
  if (!parsed) return { permission: "allow" };

  if (parsed.subcommand === "commit" && TRAILER.test(command) && !flag(cwd, "quality.allowAgentTrailer")) {
    return deny(
      "Commit blocked: it adds a Cursor attribution trailer.",
      "Retry the commit without a Cursor co-author or Made-with trailer. To allow it in this clone: git config quality.allowAgentTrailer true",
    );
  }

  if (parsed.subcommand !== "push" || flag(cwd, "quality.allowDefaultBranchPush")) {
    return { permission: "allow" };
  }
  const status = collabStatus(cwd);
  if (!status.collaborative) return { permission: "allow" };

  const defaults = defaultBranchName(cwd);
  const protectedNames = defaults ? [defaults] : ["main", "master"];
  const targets = pushTargets(cwd, parsed.rest);
  const hitsDefault = targets.some((target) => protectedNames.some((name) => sameBranch(target, name)));
  if (!hitsDefault) return { permission: "allow" };

  const branch = defaults ?? protectedNames.join(" or ");
  return deny(
    `Push blocked: ${branch} is the default branch in a collaborative repository.`,
    `Push a feature branch and open a pull request instead of ${branch}. Trunk-based teams can set: git config quality.allowDefaultBranchPush true`,
  );
}

try {
  const raw = await readStdin();
  const input = JSON.parse(raw || "{}");
  process.stdout.write(`${JSON.stringify(decide(input))}\n`);
} catch {
  process.stdout.write(`${JSON.stringify({ permission: "allow" })}\n`);
}
