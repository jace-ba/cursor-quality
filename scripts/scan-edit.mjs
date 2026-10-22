import { isCursorPrivate, leakageLabels, leakageText, readStdin, secretLabels, skipSecrets } from "./patterns.mjs";

function summarize(leakage, secrets) {
  const parts = [];
  if (leakage.length > 0) {
    parts.push(
      `This edit adds private-context wording (${leakage.join(", ")}). Remove it. Shared artifacts must make sense to a reader who has not seen the conversation or any instruction file.`,
    );
  }
  if (secrets.length > 0) {
    parts.push(`This edit looks like it contains a secret (${secrets.join(", ")}). Remove it from code and logs.`);
  }
  return parts.join(" ");
}

function scan(input) {
  const filePath = typeof input.file_path === "string" ? input.file_path : "";
  const edits = Array.isArray(input.edits) ? input.edits : [];
  const added = edits.map((edit) => (typeof edit?.new_string === "string" ? edit.new_string : "")).join("\n");
  if (!added.trim()) return {};

  const leakage = isCursorPrivate(filePath) ? [] : leakageLabels(leakageText(filePath, added));
  const secrets = skipSecrets(filePath) ? [] : secretLabels(added);
  if (leakage.length === 0 && secrets.length === 0) return {};
  return { additional_context: summarize(leakage, secrets) };
}

const raw = await readStdin();
try {
  const input = raw.trim() ? JSON.parse(raw) : {};
  process.stdout.write(JSON.stringify(scan(input)));
} catch {
  process.stdout.write("{}");
}
