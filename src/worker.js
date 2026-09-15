const VOTE_ROUTE_PREFIX = "/tme-best-paper-vote-2026";
const ASSESSMENT_ROUTE_PREFIX = "/tme-paper-assessment-2026";
const SUBMISSION_ROUTE_PREFIX = "/tme-paper-submission";
const SUBMISSION_CALL_ID = "winter2027";
const SUBMISSION_R2_PREFIX = "submissions/winter2027";
const MAX_SUBMISSION_BYTES = 10 * 1024 * 1024;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    try {
      if (url.pathname === VOTE_ROUTE_PREFIX || url.pathname === ASSESSMENT_ROUTE_PREFIX || url.pathname === SUBMISSION_ROUTE_PREFIX) {
        url.pathname = `${url.pathname}/`;
        return Response.redirect(url.toString(), 302);
      }

      if (path === "/api/vote/status" && request.method === "GET") {
        return handleStatus(request, env);
      }

      if (path === "/api/vote" && request.method === "POST") {
        return handleVote(request, env);
      }

      if (path === "/api/admin/export.csv" && request.method === "GET") {
        return handleExport(request, env);
      }

      if (path === "/api/assessment/status" && request.method === "GET") {
        return handleAssessmentStatus(request, env);
      }

      if (path === "/api/assessment" && request.method === "POST") {
        return handleAssessmentSubmit(request, env);
      }

      if (path === "/api/admin/assessment-export.csv" && request.method === "GET") {
        return handleAssessmentExport(request, env);
      }

      if (path === "/api/submission" && request.method === "POST") {
        return handlePaperSubmission(request, env);
      }

      if (path === "/api/admin/submissions-export.csv" && request.method === "GET") {
        return handleSubmissionsExport(request, env);
      }

      if (url.pathname.startsWith(`${ASSESSMENT_ROUTE_PREFIX}/papers/`) && request.method === "GET") {
        return handleAssessmentPaper(request, env, path);
      }

      if (path.startsWith("/api/")) {
        return json({ error: "Not found" }, 404);
      }

      if (url.pathname.startsWith(`${VOTE_ROUTE_PREFIX}/`)) {
        return fetchPrefixedAsset(request, env, path);
      }

      if (url.pathname.startsWith(`${ASSESSMENT_ROUTE_PREFIX}/`)) {
        return fetchAssessmentAsset(request, env, path);
      }

      if (url.pathname.startsWith(`${SUBMISSION_ROUTE_PREFIX}/`)) {
        return fetchSubmissionAsset(request, env, path);
      }

      if (url.pathname === "/best-paper-vote" || url.pathname === "/best-paper-vote/") {
        const assetUrl = new URL(request.url);
        assetUrl.pathname = "/";
        return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: "Unexpected server error" }, 500);
    }
  }
};

function normalizePath(pathname) {
  for (const prefix of [VOTE_ROUTE_PREFIX, ASSESSMENT_ROUTE_PREFIX, SUBMISSION_ROUTE_PREFIX]) {
    if (pathname === prefix) {
      return "/";
    }

    if (pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length) || "/";
    }
  }

  return pathname;
}

function fetchPrefixedAsset(request, env, path) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = path === "/" ? "/" : path;
  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

function fetchAssessmentAsset(request, env, path) {
  const assetUrl = new URL(request.url);
  const assetMap = new Map([
    ["/", "/assessment"],
    ["/assessment", "/assessment"],
    ["/assessment.html", "/assessment"],
    ["/assessment.css", "/assessment.css"],
    ["/assessment.js", "/assessment.js"]
  ]);
  assetUrl.pathname = assetMap.get(path) || path;
  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

function fetchSubmissionAsset(request, env, path) {
  const assetUrl = new URL(request.url);
  const assetMap = new Map([
    ["/", "/submission"],
    ["/submission", "/submission"],
    ["/submission.html", "/submission"],
    ["/submission.css", "/submission.css"],
    ["/submission.js", "/submission.js"]
  ]);
  assetUrl.pathname = assetMap.get(path) || path;
  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

async function handleStatus(request, env) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const voter = await findVoter(env.DB, token);

  if (!voter) {
    return json({ error: "Invalid voting link" }, 401);
  }

  const papers = await listPapers(env.DB);

  return json({
    hasVoted: Boolean(voter.voted_at),
    voter: {
      name: voter.name,
      reviewer: Boolean(voter.reviewer),
      attendee: Boolean(voter.attendee)
    },
    papers
  });
}

async function handleVote(request, env) {
  const body = await readJson(request);
  const voter = await findVoter(env.DB, body.token || "");

  if (!voter) {
    return json({ error: "Invalid voting link" }, 401);
  }

  if (voter.voted_at) {
    return json({ error: "This voting link has already been used" }, 409);
  }

  const choices = [
    body.firstChoice,
    body.secondChoice || null,
    body.thirdChoice || null
  ].filter(Boolean);

  if (!body.firstChoice) {
    return json({ error: "A first choice is required" }, 400);
  }

  if (new Set(choices).size !== choices.length) {
    return json({ error: "Ranked choices must be distinct" }, 400);
  }

  const validPaperIds = new Set((await listPapers(env.DB)).map((paper) => paper.id));
  for (const choice of choices) {
    if (!validPaperIds.has(choice)) {
      return json({ error: "One or more selected papers are invalid" }, 400);
    }
  }

  const comments = String(body.comments || "").slice(0, 1000);
  const userAgent = request.headers.get("User-Agent") || "";
  const ipHash = await hashIp(request.headers.get("CF-Connecting-IP") || "", env.IP_HASH_SALT || "");

  const submittedAt = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO votes (
        voter_id,
        first_choice_paper_id,
        second_choice_paper_id,
        third_choice_paper_id,
        comments,
        submitted_at,
        user_agent,
        ip_hash
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      voter.id,
      body.firstChoice,
      body.secondChoice || null,
      body.thirdChoice || null,
      comments,
      submittedAt,
      userAgent.slice(0, 300),
      ipHash
    ),
    env.DB.prepare("UPDATE voters SET voted_at = ? WHERE id = ? AND voted_at IS NULL").bind(submittedAt, voter.id)
  ]);

  return json({ ok: true });
}

async function handleExport(request, env) {
  if (!authorizeAdmin(request, env)) {
    return new Response("Unauthorized\n", { status: 401 });
  }

  const { results } = await env.DB.prepare(`
    SELECT
      voters.name,
      voters.email,
      voters.reviewer,
      voters.attendee,
      voters.sessions_attended,
      voters.session_dates,
      votes.first_choice_paper_id,
      first_paper.presenter AS first_choice_presenter,
      first_paper.title AS first_choice_title,
      votes.second_choice_paper_id,
      second_paper.presenter AS second_choice_presenter,
      second_paper.title AS second_choice_title,
      votes.third_choice_paper_id,
      third_paper.presenter AS third_choice_presenter,
      third_paper.title AS third_choice_title,
      votes.comments,
      votes.submitted_at
    FROM votes
    JOIN voters ON voters.id = votes.voter_id
    JOIN papers AS first_paper ON first_paper.id = votes.first_choice_paper_id
    LEFT JOIN papers AS second_paper ON second_paper.id = votes.second_choice_paper_id
    LEFT JOIN papers AS third_paper ON third_paper.id = votes.third_choice_paper_id
    ORDER BY votes.submitted_at ASC
  `).all();

  return csvResponse(results, "tme-best-paper-votes.csv", [
    "name",
    "email",
    "reviewer",
    "attendee",
    "sessions_attended",
    "session_dates",
    "first_choice_paper_id",
    "first_choice_presenter",
    "first_choice_title",
    "second_choice_paper_id",
    "second_choice_presenter",
    "second_choice_title",
    "third_choice_paper_id",
    "third_choice_presenter",
    "third_choice_title",
    "comments",
    "submitted_at"
  ]);
}

async function handleAssessmentStatus(request, env) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const reviewer = await findAssessmentReviewer(env.DB, token);

  if (!reviewer) {
    return json({ error: "Invalid review link" }, 401);
  }

  const papers = await listAssessmentPapers(env.DB, reviewer.id);

  return json({
    submitted: Boolean(reviewer.submitted_at),
    reviewer: {
      name: reviewer.name,
      firstName: reviewer.first_name,
      lastName: reviewer.last_name,
      email: reviewer.email
    },
    papers
  });
}

async function handleAssessmentPaper(request, env, path) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const reviewer = await findAssessmentReviewer(env.DB, token);

  if (!reviewer) {
    return json({ error: "Invalid review link" }, 401);
  }

  const paperNumber = Number(path.split("/").filter(Boolean).at(1));
  if (!Number.isInteger(paperNumber)) {
    return json({ error: "Invalid paper link" }, 400);
  }

  const paper = await env.DB.prepare(`
    SELECT assessment_papers.*
    FROM assessment_assignments
    JOIN assessment_papers ON assessment_papers.id = assessment_assignments.paper_id
    WHERE assessment_assignments.reviewer_id = ?
      AND assessment_papers.paper_number = ?
      AND assessment_papers.active = 1
  `).bind(reviewer.id, paperNumber).first();

  if (!paper) {
    return json({ error: "Paper is not assigned to this reviewer" }, 403);
  }

  if (!env.PAPERS) {
    return json({ error: "Paper storage is not configured" }, 500);
  }

  const object = await env.PAPERS.get(paper.r2_key);
  if (!object) {
    return json({ error: "Paper file was not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", paper.content_type || headers.get("Content-Type") || "application/octet-stream");
  headers.set("Content-Disposition", `inline; filename="${paper.filename.replaceAll('"', "")}"`);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(object.body, { headers });
}

async function handleAssessmentSubmit(request, env) {
  const body = await readJson(request);
  const reviewer = await findAssessmentReviewer(env.DB, body.token || "");

  if (!reviewer) {
    return json({ error: "Invalid review link" }, 401);
  }

  if (reviewer.submitted_at) {
    return json({ error: "This review link has already been submitted" }, 409);
  }

  const assignedPapers = await listAssessmentPapers(env.DB, reviewer.id);
  const assignedIds = new Set(assignedPapers.map((paper) => paper.id));
  const ratings = Array.isArray(body.ratings) ? body.ratings : [];

  if (ratings.length !== assignedIds.size) {
    return json({ error: "Please rate every assigned paper before submitting" }, 400);
  }

  const seen = new Set();
  for (const rating of ratings) {
    if (!assignedIds.has(rating.paperId) || seen.has(rating.paperId)) {
      return json({ error: "Ratings include an invalid paper" }, 400);
    }
    seen.add(rating.paperId);

    if (!Number.isInteger(rating.rating) || rating.rating < 1 || rating.rating > 5) {
      return json({ error: "Ratings must be between 1 and 5" }, 400);
    }
  }

  const submittedAt = new Date().toISOString();
  const userAgent = request.headers.get("User-Agent") || "";
  const ipHash = await hashIp(request.headers.get("CF-Connecting-IP") || "", env.IP_HASH_SALT || "");
  const overallComments = String(body.comments || "").slice(0, 1000);
  const statements = ratings.map((rating) => env.DB.prepare(`
    INSERT INTO assessment_ratings (
      reviewer_id,
      paper_id,
      rating,
      comments,
      submitted_at,
      user_agent,
      ip_hash
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    reviewer.id,
    rating.paperId,
    rating.rating,
    "",
    submittedAt,
    userAgent.slice(0, 300),
    ipHash
  ));

  statements.push(
    env.DB.prepare("UPDATE assessment_reviewers SET submitted_at = ?, overall_comments = ? WHERE id = ? AND submitted_at IS NULL").bind(submittedAt, overallComments, reviewer.id)
  );

  await env.DB.batch(statements);

  return json({ ok: true });
}

async function handleAssessmentExport(request, env) {
  if (!authorizeAdmin(request, env)) {
    return new Response("Unauthorized\n", { status: 401 });
  }

  const headers = [
    "paper_number",
    "paper_title",
    "rating",
    "reviewer_name",
    "reviewer_email",
    "reviewer_code",
    "overall_comments",
    "rating_submitted_at"
  ];
  const { results } = await env.DB.prepare(`
    SELECT
      assessment_papers.paper_number,
      assessment_papers.title AS paper_title,
      assessment_ratings.rating,
      assessment_reviewers.name AS reviewer_name,
      assessment_reviewers.email AS reviewer_email,
      assessment_reviewers.reviewer_code,
      assessment_reviewers.overall_comments,
      assessment_ratings.submitted_at AS rating_submitted_at
    FROM assessment_ratings
    JOIN assessment_reviewers ON assessment_reviewers.id = assessment_ratings.reviewer_id
    JOIN assessment_papers ON assessment_papers.id = assessment_ratings.paper_id
    ORDER BY assessment_papers.paper_number ASC, assessment_reviewers.name ASC
  `).all();

  return csvResponse(results, "tme-paper-assessment-results.csv", headers);
}

async function handlePaperSubmission(request, env) {
  if (!env.PAPERS) {
    return json({ error: "Paper storage is not configured" }, 500);
  }

  const form = await request.formData();
  const title = cleanText(form.get("title"), 300);
  const abstract = cleanText(form.get("abstract"), 3500);
  const submitterName = cleanText(form.get("submitterName"), 160);
  const submitterEmail = cleanEmail(form.get("submitterEmail"));
  const file = form.get("paper");
  const coauthors = parseCoauthors(form.get("coauthorsJson"));

  if (!title) {
    return json({ error: "Paper title is required" }, 400);
  }

  if (!abstract) {
    return json({ error: "Paper abstract is required" }, 400);
  }

  if (!submitterName || !submitterEmail) {
    return json({ error: "Submitting author name and email are required" }, 400);
  }

  if (!(file instanceof File) || !file.name || file.size === 0) {
    return json({ error: "A paper file is required" }, 400);
  }

  if (file.size > MAX_SUBMISSION_BYTES) {
    return json({ error: "The uploaded paper is larger than 10MB" }, 400);
  }

  const extension = extensionFor(file.name, file.type);
  if (!extension) {
    return json({ error: "Please upload an anonymous PDF file" }, 400);
  }

  for (const coauthor of coauthors) {
    if (!coauthor.name || !coauthor.email) {
      return json({ error: "Each co-author needs both a name and an email address" }, 400);
    }
  }

  const submittedAt = new Date().toISOString();
  const confirmationToken = crypto.randomUUID();
  const allAuthors = [
    { name: submitterName, email: submitterEmail, role: "submitter" },
    ...coauthors.map((author) => ({ ...author, role: "coauthor" }))
  ];
  const authorNames = allAuthors.map((author) => author.name).join("; ");
  const authorEmails = allAuthors.map((author) => author.email).join("; ");
  const userAgent = request.headers.get("User-Agent") || "";
  const ipHash = await hashIp(request.headers.get("CF-Connecting-IP") || "", env.IP_HASH_SALT || "");

  const inserted = await env.DB.prepare(`
    INSERT INTO paper_submissions (
      call_id,
      submission_number,
      title,
      abstract,
      submitter_name,
      submitter_email,
      coauthors_json,
      author_names,
      author_emails,
      original_filename,
      content_type,
      size_bytes,
      confirmation_token,
      submitted_at,
      user_agent,
      ip_hash
    )
    VALUES (
      ?,
      (SELECT COALESCE(MAX(submission_number), 0) + 1 FROM paper_submissions WHERE call_id = ?),
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    RETURNING id, submission_number
  `).bind(
    SUBMISSION_CALL_ID,
    SUBMISSION_CALL_ID,
    title,
    abstract,
    submitterName,
    submitterEmail,
    JSON.stringify(coauthors),
    authorNames,
    authorEmails,
    file.name.slice(0, 240),
    contentTypeForUpload(file.type, extension),
    file.size,
    confirmationToken,
    submittedAt,
    userAgent.slice(0, 300),
    ipHash
  ).first();

  const submissionNumber = inserted.submission_number;
  const storedFilename = `TME_${SUBMISSION_CALL_ID}_submission_${submissionNumber}.${extension}`;
  const r2Key = `${SUBMISSION_R2_PREFIX}/${storedFilename}`;

  await env.PAPERS.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: contentTypeForUpload(file.type, extension)
    },
    customMetadata: {
      callId: SUBMISSION_CALL_ID,
      submissionNumber: String(submissionNumber),
      originalFilename: file.name.slice(0, 240)
    }
  });

  await env.DB.prepare(`
    UPDATE paper_submissions
    SET stored_filename = ?, r2_key = ?, status = 'received'
    WHERE id = ?
  `).bind(storedFilename, r2Key, inserted.id).run();

  return json({
    ok: true,
    submissionNumber,
    title,
    message: "Submission received"
  });
}

async function handleSubmissionsExport(request, env) {
  if (!authorizeAdmin(request, env)) {
    return new Response("Unauthorized\n", { status: 401 });
  }

  const headers = [
    "call_id",
    "submission_number",
    "title",
    "abstract",
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
  const { results } = await env.DB.prepare(`
    SELECT
      call_id,
      submission_number,
      title,
      abstract,
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
    ORDER BY call_id ASC, submission_number ASC
  `).all();

  return csvResponse(results, "tme-paper-submissions.csv", headers);
}

async function findVoter(db, token) {
  if (!token || token.length < 24) {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  return db.prepare("SELECT * FROM voters WHERE token_hash = ?").bind(tokenHash).first();
}

async function findAssessmentReviewer(db, token) {
  if (!token || token.length < 24) {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  return db.prepare("SELECT * FROM assessment_reviewers WHERE token_hash = ?").bind(tokenHash).first();
}

async function listPapers(db) {
  const { results } = await db.prepare(`
    SELECT id, presenter, title, url
    FROM papers
    WHERE active = 1
    ORDER BY sort_order ASC, presenter ASC
  `).all();

  return results;
}

async function listAssessmentPapers(db, reviewerId) {
  const { results } = await db.prepare(`
    SELECT
      assessment_papers.id,
      assessment_papers.paper_number AS paperNumber,
      assessment_papers.title
    FROM assessment_assignments
    JOIN assessment_papers ON assessment_papers.id = assessment_assignments.paper_id
    WHERE assessment_assignments.reviewer_id = ?
      AND assessment_papers.active = 1
    ORDER BY assessment_assignments.assignment_order ASC
  `).bind(reviewerId).all();

  return results;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS
  });
}

function authorizeAdmin(request, env) {
  const adminKey = env.ADMIN_KEY || "";
  const authorization = request.headers.get("Authorization") || "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : new URL(request.url).searchParams.get("key") || "";

  return Boolean(adminKey && provided === adminKey);
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashIp(ip, salt) {
  if (!ip || !salt) {
    return "";
  }

  return sha256Hex(`${salt}:${ip}`);
}

function cleanText(value, maxLength) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanEmail(value) {
  const email = cleanText(value, 200).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function parseCoauthors(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.slice(0, 20).map((author) => ({
      name: cleanText(author.name, 160),
      email: cleanEmail(author.email)
    })).filter((author) => author.name || author.email);
  } catch (error) {
    return [];
  }
}

function extensionFor(filename, contentType) {
  const name = String(filename || "").toLowerCase();
  const type = String(contentType || "").toLowerCase();
  if (name.endsWith(".pdf") && (!type || type === "application/pdf")) {
    return "pdf";
  }
  return "";
}

function contentTypeForUpload(contentType, extension) {
  return "application/pdf";
}

function csvResponse(rows, filename, headers) {
  const csv = toCsv(rows, headers);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}

function toCsv(rows, headers = null) {
  const csvHeaders = headers || (rows.length ? Object.keys(rows[0]) : []);
  if (!csvHeaders.length) {
    return "\n";
  }

  const lines = [csvHeaders.join(",")];

  for (const row of rows) {
    lines.push(csvHeaders.map((header) => csvCell(row[header])).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
