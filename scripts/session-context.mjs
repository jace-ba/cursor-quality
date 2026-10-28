import path from "node:path";
import { fileURLToPath } from "node:url";
import { collabStatus } from "./collab.mjs";
import { readStdin } from "./patterns.mjs";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rulePath = path.join(pluginRoot, "rules", "quality-collaboration.mdc");

function contextFor(root) {
  const status = collabStatus(root);
  if (!status.collaborative) return "";
  return [
    `${root} is a collaborative repository (${status.reason}).`,
    `Read ${rulePath} and follow it.`,
    "Check remote branches and owners before changing behavior outside files the user clearly owns.",
    "Use a branch, not the default branch.",
    "After pushing, verify CI.",
    "To turn this off in this clone: git config quality.collaborative false",
  ].join(" ");
}

try {
  const raw = await readStdin();
  const input = JSON.parse(raw || "{}");
  const roots = Array.isArray(input.workspace_roots) ? input.workspace_roots : [];
  const parts = [];
  for (const root of roots) {
    if (typeof root !== "string" || root.trim() === "") continue;
    const text = contextFor(root);
    if (text) parts.push(text);
  }
  if (parts.length === 0) {
    process.stdout.write("{}\n");
  } else {
    process.stdout.write(`${JSON.stringify({ additional_context: parts.join("\n\n") })}\n`);
  }
} catch {
  process.stdout.write("{}\n");
}
