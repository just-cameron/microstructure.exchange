const basePath = getBasePath();

const state = {
  token: new URLSearchParams(window.location.search).get("token") || "",
  reviewer: null,
  papers: [],
  submitted: false
};

const els = {
  statusPanel: document.querySelector("#statusPanel"),
  statusText: document.querySelector("#statusText"),
  reviewerText: document.querySelector("#reviewerText"),
  paperCount: document.querySelector("#paperCount"),
  form: document.querySelector("#assessmentForm"),
  papers: document.querySelector("#papers"),
  overallComments: document.querySelector("#overallComments"),
  clearButton: document.querySelector("#clearButton"),
  submitButton: document.querySelector("#submitButton"),
  formMessage: document.querySelector("#formMessage")
};

init();

async function init() {
  setFormEnabled(false);

  if (!state.token) {
    setStatus("warn", "Private review link required.");
    setMessage("Please open the personalized assessment link sent by the organizers.", true);
    return;
  }

  await loadStatus();
}

async function loadStatus() {
  try {
    const response = await fetch(`${basePath}/api/assessment/status?token=${encodeURIComponent(state.token)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Review link could not be verified.");
    }

    state.reviewer = data.reviewer;
    state.papers = data.papers || [];
    state.submitted = Boolean(data.submitted);

    renderPapers();
    setFormEnabled(!state.submitted);

    const name = state.reviewer?.firstName || state.reviewer?.name || "";
    els.reviewerText.textContent = name
      ? `Welcome, ${name}.`
      : "Welcome.";
    els.paperCount.textContent = `${state.papers.length} assigned papers`;

    if (state.submitted) {
      setStatus("ready", "Ratings already submitted.");
      setMessage("Thank you. The organizers have received your ratings.");
    } else {
      setStatus("ready", "Private review link verified.");
      setMessage("Please rate each assigned paper before submitting.");
    }
  } catch (error) {
    setStatus("warn", "Review link not recognized.");
    setMessage(error.message, true);
  }
}

function renderPapers() {
  els.papers.innerHTML = state.papers.map((paper) => {
    const safeId = escapeHtml(paper.id);
    const paperUrl = `${basePath}/papers/${encodeURIComponent(paper.paperNumber)}?token=${encodeURIComponent(state.token)}`;

    return `
      <article class="paper" data-paper-id="${safeId}">
        <div>
          <p class="paper-meta">Paper ${escapeHtml(paper.paperNumber)}</p>
          <h3 class="paper-title">${escapeHtml(paper.title)}</h3>
          <a class="paper-link" href="${escapeHtml(paperUrl)}" target="_blank" rel="noopener">Open paper</a>
        </div>

        <div class="rating-block">
          <p class="rating-label">Rating</p>
          <div class="rating-options" role="radiogroup" aria-label="Rating for paper ${escapeHtml(paper.paperNumber)}">
            ${[1, 2, 3, 4, 5].map((rating) => `
              <label class="rating-option">
                <input type="radio" name="rating-${safeId}" value="${rating}" required>
                <span>${rating}</span>
              </label>
            `).join("")}
          </div>
          <div class="scale" aria-hidden="true">
            <span>Reject</span>
            <span>Definitely include</span>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const ratings = [];
  for (const paper of state.papers) {
    const selected = document.querySelector(`input[name="rating-${cssEscape(paper.id)}"]:checked`);
    if (!selected) {
      setMessage(`Please add a rating for paper ${paper.paperNumber}.`, true);
      return;
    }

    ratings.push({
      paperId: paper.id,
      rating: Number(selected.value)
    });
  }

  setMessage("Submitting...");
  els.submitButton.disabled = true;

  try {
    const response = await fetch(`${basePath}/api/assessment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: state.token,
        ratings,
        comments: els.overallComments.value.trim()
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Ratings could not be submitted.");
    }

    state.submitted = true;
    setFormEnabled(false);
    setStatus("ready", "Ratings submitted.");
    setMessage("Thank you. Your ratings have been recorded.");
  } catch (error) {
    els.submitButton.disabled = false;
    setMessage(error.message, true);
  }
});

els.clearButton.addEventListener("click", () => {
  els.form.reset();
  setMessage(state.submitted ? "" : "Please rate each assigned paper before submitting.");
});

function setStatus(kind, text) {
  els.statusPanel.classList.remove("ready", "warn");
  if (kind) {
    els.statusPanel.classList.add(kind);
  }
  els.statusText.textContent = text;
}

function setFormEnabled(enabled) {
  els.clearButton.disabled = !enabled;
  els.submitButton.disabled = !enabled;
  for (const input of els.form.querySelectorAll("input, textarea")) {
    input.disabled = !enabled;
  }
}

function setMessage(text, isError = false) {
  els.formMessage.textContent = text;
  els.formMessage.classList.toggle("error", isError);
}

function getBasePath() {
  const prefix = "/tme-paper-assessment-2026";
  return window.location.pathname.startsWith(prefix) ? prefix : "";
}

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
