const MAX_BYTES = 10 * 1024 * 1024;
const basePath = getBasePath();

const els = {
  form: document.querySelector("#submissionForm"),
  coauthors: document.querySelector("#coauthors"),
  addCoauthorButton: document.querySelector("#addCoauthorButton"),
  dropzone: document.querySelector("#paperDropzone"),
  paperInput: document.querySelector("#paper"),
  paperFileName: document.querySelector("#paperFileName"),
  submitButton: document.querySelector("#submitButton"),
  formMessage: document.querySelector("#formMessage"),
  statusPanel: document.querySelector("#statusPanel"),
  statusText: document.querySelector("#statusText"),
  confirmation: document.querySelector("#confirmation"),
  confirmationText: document.querySelector("#confirmationText")
};

els.addCoauthorButton.addEventListener("click", () => addCoauthor());
els.dropzone.addEventListener("click", (event) => {
  if (event.target !== els.paperInput) {
    els.paperInput.click();
  }
});
els.dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    els.paperInput.click();
  }
});
els.paperInput.addEventListener("change", () => updateSelectedFile());

for (const eventName of ["dragenter", "dragover"]) {
  els.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropzone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  els.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropzone.classList.remove("dragging");
  });
}

els.dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) return;

  if (!isPdf(file)) {
    els.paperInput.value = "";
    updateSelectedFile();
    setMessage("Please upload an anonymous PDF file. Other file types are not accepted.", true);
    return;
  }

  const files = new DataTransfer();
  files.items.add(file);
  els.paperInput.files = files.files;
  updateSelectedFile();
  setMessage("");
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = els.form.paper.files[0];
  if (!file) {
    setMessage("Please choose a paper file.", true);
    return;
  }

  if (file.size > MAX_BYTES) {
    setMessage("The uploaded paper is larger than 10MB. Please upload a smaller file.", true);
    return;
  }

  if (!isPdf(file)) {
    setMessage("Please upload an anonymous PDF file. Other file types are not accepted.", true);
    return;
  }

  const formData = new FormData(els.form);
  formData.set("coauthorsJson", JSON.stringify(readCoauthors()));

  setMessage("Uploading submission...");
  setStatus("ready", "Uploading");
  setEnabled(false);

  try {
    const response = await fetch(`${basePath}/api/submission`, {
      method: "POST",
      body: formData
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Submission could not be saved.");
    }

    els.form.hidden = true;
    els.confirmation.hidden = false;
    els.confirmationText.textContent = `Your paper has been submitted successfully. Your confirmation number is ${data.submissionNumber}.`;
    setStatus("ready", "Submission received");
  } catch (error) {
    setEnabled(true);
    setStatus("warn", "Submission problem");
    setMessage(error.message, true);
  }
});

function addCoauthor(author = {}) {
  const index = els.coauthors.children.length + 1;
  const row = document.createElement("div");
  row.className = "coauthor-row";
  row.innerHTML = `
    <div>
      <label for="coauthorName${index}">Co-author name</label>
      <input id="coauthorName${index}" data-field="name" type="text" maxlength="160" value="${escapeAttribute(author.name || "")}">
    </div>
    <div>
      <label for="coauthorEmail${index}">Co-author email</label>
      <input id="coauthorEmail${index}" data-field="email" type="email" maxlength="200" value="${escapeAttribute(author.email || "")}">
    </div>
    <button class="icon-button" type="button" aria-label="Remove co-author">Remove</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  els.coauthors.append(row);
}

function isPdf(file) {
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  return name.endsWith(".pdf") && (!type || type === "application/pdf");
}

function updateSelectedFile() {
  const file = els.paperInput.files[0];
  els.paperFileName.textContent = file ? file.name : "No file selected";
}

function readCoauthors() {
  return [...els.coauthors.querySelectorAll(".coauthor-row")]
    .map((row) => ({
      name: row.querySelector('[data-field="name"]').value.trim(),
      email: row.querySelector('[data-field="email"]').value.trim()
    }))
    .filter((author) => author.name || author.email);
}

function setEnabled(enabled) {
  for (const input of els.form.querySelectorAll("input, textarea, button")) {
    input.disabled = !enabled;
  }
}

function setMessage(text, isError = false) {
  els.formMessage.textContent = text;
  els.formMessage.classList.toggle("error", isError);
}

function setStatus(kind, text) {
  els.statusPanel.classList.remove("ready", "warn");
  if (kind) {
    els.statusPanel.classList.add(kind);
  }
  els.statusText.textContent = text;
}

function getBasePath() {
  const prefix = "/tme-paper-submission";
  return window.location.pathname.startsWith(prefix) ? prefix : "";
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
