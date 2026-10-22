import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = path.dirname(fileURLToPath(import.meta.url));
const home = process.env.USERPROFILE;
if (!home) {
  console.error("USERPROFILE is not set, so the plugin cannot be installed.");
  process.exit(1);
}

const dest = path.join(home, ".cursor", "plugins", "local", "quality-guardrails");

function included(src) {
  const rel = path.relative(source, src);
  if (rel === "") return true;
  const top = rel.split(path.sep)[0];
  return top !== ".git" && top !== "install.mjs";
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(path.dirname(dest), { recursive: true });
cpSync(source, dest, { recursive: true, filter: included });
console.log(`Installed to ${dest}`);
