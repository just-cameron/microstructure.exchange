import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const args = new Set(process.argv.slice(2));
const isLocal = args.has("--local");
const outputPath = getArg("--output") || "generated/assessment-results.csv";

const query = `
  SELECT
    assessment_papers.paper_number,
    assessment_papers.title AS paper_title,
    assessment_ratings.rating,
    assessment_reviewers.reviewer_code,
    assessment_reviewers.name AS reviewer_name,
    assessment_reviewers.email AS reviewer_email,
    assessment_reviewers.overall_comments,
    assessment_ratings.submitted_at
  FROM assessment_ratings
  JOIN assessment_reviewers ON assessment_reviewers.id = assessment_ratings.reviewer_id
  JOIN assessment_papers ON assessment_papers.id = assessment_ratings.paper_id
  ORDER BY assessment_papers.paper_number ASC, assessment_reviewers.name ASC;
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
  "paper_number",
  "paper_title",
  "rating",
  "reviewer_name",
  "reviewer_email",
  "reviewer_code",
  "overall_comments",
  "submitted_at"
];

await mkdir("generated", { recursive: true });
await writeFile(outputPath, toCsv(headers, rows));

console.log(`Wrote ${rows.length} assessment rows to ${outputPath}`);

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
