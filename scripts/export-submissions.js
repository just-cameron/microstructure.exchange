import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const args = new Set(process.argv.slice(2));
const isLocal = args.has("--local");
const outputPath = getArg("--output") || "generated/paper-submissions.csv";

const query = `
  SELECT
    call_id,
    submission_number,
    title,
    submitter_name,
    submitter_email,
    author_names,
    author_emails,
    coauthors_json,
    original_filename,
    stored_filename,
    r2_key,
    content_type,
    size_bytes,
    status,
    submitted_at
  FROM paper_submissions
  ORDER BY call_id ASC, submission_number ASC;
`;

const wranglerArgs = [
  "wrangler",
  "d1",
  "execute",
  "tme-best-paper",
  isLocal ? "--local" : "--remote",
  "--json",
  "--command",
  query
];

const { stdout } = await execFileAsync("npx", wranglerArgs, {
  maxBuffer: 1024 * 1024 * 10
});

const response = JSON.parse(stdout);
const rows = response.flatMap((item) => item.results || []);
const headers = [
  "call_id",
  "submission_number",
  "title",
  "submitter_name",
  "submitter_email",
  "author_names",
  "author_emails",
  "coauthors_json",
  "original_filename",
  "stored_filename",
  "r2_key",
  "content_type",
  "size_bytes",
  "status",
  "submitted_at"
];

await mkdir("generated", { recursive: true });
await writeFile(outputPath, toCsv(headers, rows));

console.log(`Wrote ${rows.length} submission rows to ${outputPath}`);

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] || "";
}

function toCsv(headers, rows) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n") + "\n";
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
