const LEAKAGE = [
  { label: "as requested", re: /\bas requested\b/i },
  { label: "per the guidelines", re: /\bper (the|our) guidelines\b/i },
  { label: "as instructed", re: /\bas instructed\b/i },
  { label: "following the instructions", re: /\bfollowing (the |our )?(instructions|rule)\b/i },
  { label: "rule number", re: /§\s*\d+/ },
  { label: "the user wanted", re: /\bthe user wanted\b/i },
  { label: "because the user", re: /\bbecause the user\b/i },
  { label: "this conversation", re: /\b(this|our) conversation\b/i },
];

const SECRET_RULES = [
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "GitHub token", re: /\b(?:ghp_|gho_|github_pat_)[A-Za-z0-9_]{20,}\b/g },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: "API key", re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  {
    name: "assigned secret",
    re: /\b(?:api[_-]?key|secret|password|passwd|token)\b\s*[:=]\s*['"]([^'"]{8,})['"]/gi,
    valueGroup: 1,
  },
];

const SHARED_EXT = new Set([".md", ".mdx", ".astro", ".html", ".htm", ".tsx", ".jsx", ".vue", ".svelte"]);
const HASH_COMMENT_EXT = new Set([".py", ".sh", ".bash", ".yml", ".yaml", ".rb", ".toml"]);
const SKIP_BASENAMES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);

export function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => {
      let text = Buffer.concat(chunks).toString("utf8");
      // Cursor's hook input on Windows starts with a byte order mark, which JSON.parse rejects.
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      resolve(text);
    });
    process.stdin.on("error", reject);
  });
}

export function isGitCommit(command) {
  return /(?:^|[|&;]\s*)git(?:\.exe)?(?:\s+\S+)*\s+commit\b/.test(command);
}

export function commitsAllTracked(command) {
  return /(?:^|\s)--all(?:\s|=|$)|(?:^|\s)-[a-zA-Z]*a[a-zA-Z]*(?:\s|$)/.test(command);
}

function baseName(filePath) {
  const norm = filePath.replace(/\\/g, "/");
  return norm.split("/").pop() ?? "";
}

function extOf(filePath) {
  const match = baseName(filePath).match(/(\.[^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

export function isCursorPrivate(filePath) {
  return /[/\\]\.cursor([/\\]|$)/i.test(filePath);
}

export function skipSecrets(filePath) {
  if (!filePath) return false;
  const norm = filePath.replace(/\\/g, "/");
  if (norm.includes("/node_modules/") || norm.includes("/dist/")) return true;
  return SKIP_BASENAMES.has(baseName(filePath).toLowerCase());
}

export function isSharedArtifact(filePath) {
  if (!filePath || isCursorPrivate(filePath)) return false;
  const norm = filePath.replace(/\\/g, "/");
  if (norm.includes("/node_modules/") || norm.includes("/dist/")) return false;
  const base = baseName(norm);
  if (/^(readme|changelog|changes)(\.|$)/i.test(base)) return true;
  if (/\/(docs|content)\//i.test(norm)) return true;
  if (/\.(test|spec)\.[cm]?[jt]sx?$/i.test(base)) return true;
  return SHARED_EXT.has(extOf(norm));
}

export function commentText(filePath, source) {
  const parts = [];
  for (const match of source.matchAll(/\/\*[\s\S]*?\*\//g)) parts.push(match[0]);
  for (const match of source.matchAll(/(^|[^\w:])\/\/[^\n]*/gm)) parts.push(match[0]);
  for (const match of source.matchAll(/<!--[\s\S]*?-->/g)) parts.push(match[0]);
  if (HASH_COMMENT_EXT.has(extOf(filePath ?? ""))) {
    for (const match of source.matchAll(/(^|\s)#[^\n]*/g)) parts.push(match[0]);
  }
  return parts.join("\n");
}

export function leakageLabels(text) {
  if (!text) return [];
  const found = [];
  for (const rule of LEAKAGE) {
    if (rule.re.test(text)) found.push(rule.label);
  }
  return found;
}

function isPlaceholder(value) {
  const trimmed = value.trim();
  return /^(x+|\*+|your[-_a-z0-9]*|changeme|placeholder|todo|redacted|example.*|dummy|fake|sample|<[^>]+>|\$\{[^}]+\}|process\.env\.[A-Za-z0-9_.]+|undefined|null|true|false|\.{3,})$/i.test(trimmed);
}

export function secretLabels(text) {
  if (!text) return [];
  const found = [];
  for (const rule of SECRET_RULES) {
    rule.re.lastIndex = 0;
    let match = rule.re.exec(text);
    while (match) {
      const value = rule.valueGroup ? match[rule.valueGroup] : match[0];
      if (!isPlaceholder(value)) found.push(rule.name);
      if (!rule.re.global) break;
      match = rule.re.exec(text);
    }
  }
  return [...new Set(found)];
}

export function leakageText(filePath, text) {
  if (isCursorPrivate(filePath)) return "";
  if (isSharedArtifact(filePath)) return text;
  return commentText(filePath, text);
}
