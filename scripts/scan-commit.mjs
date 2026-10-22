import { spawnSync } from "node:child_process";
import {
  commitsAllTracked,
  isCursorPrivate,
  isGitCommit,
  leakageLabels,
  leakageText,
  readStdin,
  secretLabels,
  skipSecrets,
} from "./patterns.mjs";

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd: cwd || process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return "";
  return result.stdout ?? "";
}

function parseDiff(diff) {
  const files = [];
  let current = null;
  for (const line of diff.split("\n")) {
    const header = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (header) {
      current = { path: header[2], added: [] };
      files.push(current);
      continue;
    }
    if (!current || line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) continue;
    if (line.startsWith("+")) current.added.push(line.slice(1));
  }
  return files;
}

function scanFiles(files) {
  const leakage = [];
  const secrets = [];
  for (const file of files) {
    const text = file.added.join("\n");
    if (!isCursorPrivate(file.path)) {
      const labels = leakageLabels(leakageText(file.path, text));
      if (labels.length > 0) leakage.push(`${file.path}: ${labels.join(", ")}`);
    }
    if (!skipSecrets(file.path)) {
      const labels = secretLabels(text);
      if (labels.length > 0) secrets.push(`${file.path}: ${labels.join(", ")}`);
    }
  }
  return { leakage, secrets };
}

function agentMessage(commandLeakage, commandSecrets, fileLeakage, fileSecrets) {
  const lines = ["This commit was flagged. Remove the problem text, then commit again."];
  if (commandLeakage.length > 0) {
    lines.push(`Commit message has private-context wording (${commandLeakage.join(", ")}).`);
  }
  if (commandSecrets.length > 0) {
    lines.push(`Commit message looks like it contains a secret (${commandSecrets.join(", ")}).`);
  }
  if (fileLeakage.length > 0) {
    lines.push(`Shared artifact text: ${fileLeakage.join("; ")}.`);
  }
  if (fileSecrets.length > 0) {
    lines.push(`Possible secrets: ${fileSecrets.join("; ")}.`);
  }
  return lines.join(" ");
}

function scan(input) {
  const command = typeof input.command === "string" ? input.command : "";
  if (!isGitCommit(command)) return { permission: "allow" };

  const commandLeakage = leakageLabels(command);
  const commandSecrets = secretLabels(command);
  const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
  const cached = git(cwd, ["diff", "--cached", "--no-ext-diff", "--unified=0"]);
  const unstaged = commitsAllTracked(command) ? git(cwd, ["diff", "--no-ext-diff", "--unified=0"]) : "";
  const files = scanFiles([...parseDiff(cached), ...parseDiff(unstaged)]);

  if (commandLeakage.length + commandSecrets.length + files.leakage.length + files.secrets.length === 0) {
    return { permission: "allow" };
  }

  return {
    permission: "ask",
    user_message: "Commit text looks like it includes private-context wording or a secret. Review it before continuing.",
    agent_message: agentMessage(commandLeakage, commandSecrets, files.leakage, files.secrets),
  };
}

const raw = await readStdin();
try {
  const input = raw.trim() ? JSON.parse(raw) : {};
  process.stdout.write(JSON.stringify(scan(input)));
} catch {
  process.stdout.write(JSON.stringify({ permission: "allow" }));
}
