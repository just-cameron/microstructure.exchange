import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_INPUT = "generated/long_assignments_cloudflare_ready.csv";
const inputPath = getArg("--input") || DEFAULT_INPUT;
const outputDir = getArg("--outputDir") || "generated";
const baseUrl = stripTrailingSlash(getArg("--baseUrl") || process.env.TME_REVIEW_BASE_URL || "https://microstructure.exchange/tme-paper-assessment-2026");
const seedPath = path.join(outputDir, "seed-assessment-fall2026.sql");
const linksPath = path.join(outputDir, "assessment-reviewer-links-fall2026.csv");

const source = await readFile(inputPath, "utf8");
const assignments = parseCsv(source);

if (!assignments.length) {
  throw new Error(`No assignments found in ${inputPath}`);
}

const papers = new Map();
const reviewers = new Map();

for (const row of assignments) {
  const paperNumber = Number(row.paperNumber);
  if (!Number.isInteger(paperNumber)) {
    throw new Error(`Invalid paperNumber for row: ${JSON.stringify(row)}`);
  }

  const paperId = row.paperId || `P${String(paperNumber).padStart(3, "0")}`;
  if (!papers.has(paperId)) {
    papers.set(paperId, {
      id: paperId,
      paperNumber,
      title: row.paperTitle,
      filename: row.numberedFilename,
      r2Key: row.r2Key,
      contentType: contentTypeFor(row.numberedFilename),
      sortOrder: paperNumber
    });
  }

  const reviewerKey = normalizedEmail(row.reviewerEmail) || row.reviewerId || row.reviewerName;
  if (!reviewerKey) {
    throw new Error(`Reviewer without email, id, or name: ${JSON.stringify(row)}`);
  }

  if (!reviewers.has(reviewerKey)) {
    reviewers.set(reviewerKey, {
      dbId: reviewers.size + 1,
      reviewerCode: row.reviewerId,
      name: row.reviewerName,
      firstName: row.reviewerFirstName,
      lastName: row.reviewerLastName,
      email: normalizedEmail(row.reviewerEmail),
      token: randomBytes(32).toString("base64url"),
      assignments: []
    });
  }

  reviewers.get(reviewerKey).assignments.push(paperId);
}

for (const reviewer of reviewers.values()) {
  const uniqueAssignments = [...new Set(reviewer.assignments)];
  if (uniqueAssignments.length !== reviewer.assignments.length) {
    throw new Error(`Duplicate assignment for ${reviewer.email || reviewer.name}`);
  }
  reviewer.assignments = uniqueAssignments;
}

await mkdir(outputDir, { recursive: true });
await writeFile(seedPath, buildSql([...papers.values()], [...reviewers.values()]));
await writeFile(linksPath, buildLinksCsv([...reviewers.values()]));

console.log(`Wrote ${papers.size} papers and ${reviewers.size} reviewers to ${seedPath}`);
console.log(`Wrote reviewer links to ${linksPath}`);

function buildSql(papersList, reviewersList) {
  const lines = [
    "PRAGMA foreign_keys = OFF;",
    "DELETE FROM assessment_ratings;",
    "DELETE FROM assessment_assignments;",
    "DELETE FROM assessment_reviewers;",
    "DELETE FROM assessment_papers;",
    "PRAGMA foreign_keys = ON;",
    ""
  ];

  for (const paper of papersList.sort((a, b) => a.paperNumber - b.paperNumber)) {
    lines.push(
      `INSERT INTO assessment_papers (id, paper_number, title, filename, r2_key, content_type, sort_order, active) VALUES (${sql(paper.id)}, ${paper.paperNumber}, ${sql(paper.title)}, ${sql(paper.filename)}, ${sql(paper.r2Key)}, ${sql(paper.contentType)}, ${paper.sortOrder}, 1);`
    );
  }

  lines.push("");

  for (const reviewer of reviewersList) {
    lines.push(
      `INSERT INTO assessment_reviewers (id, reviewer_code, token_hash, name, first_name, last_name, email) VALUES (${reviewer.dbId}, ${sql(reviewer.reviewerCode)}, ${sql(sha256Hex(reviewer.token))}, ${sql(reviewer.name)}, ${sql(reviewer.firstName)}, ${sql(reviewer.lastName)}, ${sql(reviewer.email)});`
    );

    reviewer.assignments.forEach((paperId, index) => {
      lines.push(
        `INSERT INTO assessment_assignments (reviewer_id, paper_id, assignment_order) VALUES (${reviewer.dbId}, ${sql(paperId)}, ${index + 1});`
      );
    });
  }

  return `${lines.join("\n")}\n`;
}

function buildLinksCsv(reviewersList) {
  const headers = [
    "reviewerCode",
    "name",
    "firstName",
    "lastName",
    "email",
    "assessmentLink",
    "paperCount",
    "paperNumbers",
    "paperTitles"
  ];

  const rows = reviewersList.map((reviewer) => {
    const assignedPapers = reviewer.assignments.map((paperId) => papers.get(paperId));
    return {
      reviewerCode: reviewer.reviewerCode,
      name: reviewer.name,
      firstName: reviewer.firstName,
      lastName: reviewer.lastName,
      email: reviewer.email,
      assessmentLink: `${baseUrl}/?token=${encodeURIComponent(reviewer.token)}`,
      paperCount: assignedPapers.length,
      paperNumbers: assignedPapers.map((paper) => paper.paperNumber).join("; "),
      paperTitles: assignedPapers.map((paper) => paper.title).join(" | ")
    };
  });

  return toCsv(headers, rows);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] || ""])));
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

function sql(value) {
  if (value === undefined || value === null || value === "") {
    return "NULL";
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function contentTypeFor(filename) {
  return String(filename || "").toLowerCase().endsWith(".docx")
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/pdf";
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] || "";
}
