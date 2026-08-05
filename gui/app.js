const TOTAL_STEPS = 3;

const el = {
  inputDir: document.getElementById("inputDir"),
  outputDir: document.getElementById("outputDir"),
  modelSelect: document.getElementById("modelSelect"),
  modelNote: document.getElementById("modelNote"),
  statFound: document.getElementById("statFound"),
  statProcessed: document.getElementById("statProcessed"),
  statRemaining: document.getElementById("statRemaining"),
  rescanBtn: document.getElementById("rescanBtn"),
  startBtn: document.getElementById("startBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  browseInput: document.getElementById("browseInput"),
  browseOutput: document.getElementById("browseOutput"),
  addPapersBtn: document.getElementById("addPapersBtn"),
  paperLabel: document.getElementById("paperLabel"),
  paperCount: document.getElementById("paperCount"),
  etaLabel: document.getElementById("etaLabel"),
  stepLabel: document.getElementById("stepLabel"),
  console: document.getElementById("console"),
  statusPill: document.getElementById("statusPill"),
  statusText: document.getElementById("statusText"),
  progressTrack: document.querySelector(".progress-bar-track"),
  envelopeInput: document.getElementById("envelopeInput"),
  synthModelSelect: document.getElementById("synthModelSelect"),
  runSynthBtn: document.getElementById("runSynthBtn"),
  synthNote: document.getElementById("synthNote"),
  openBriefBtn: document.getElementById("openBriefBtn"),
  themeToggle: document.getElementById("themeToggle"),
  themeIcon: document.getElementById("themeIcon"),
};

let lastMarkdownPath = null;

// ---------------------------------------------------------------------
// Theme (persisted in localStorage -- pure UI preference)
// ---------------------------------------------------------------------

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  el.themeIcon.innerHTML = theme === "light" ? "&#9788;" : "&#9789;";
  localStorage.setItem("theme", theme);
}

el.themeToggle.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  applyTheme(current === "light" ? "dark" : "light");
});

// ---------------------------------------------------------------------
// Progress segments
// ---------------------------------------------------------------------

let segments = [];

function buildSegments() {
  el.progressTrack.innerHTML = "";
  segments = [];
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const seg = document.createElement("div");
    seg.className = "segment";
    el.progressTrack.appendChild(seg);
    segments.push(seg);
  }
}

function setSegments(currentStep) {
  segments.forEach((seg, i) => {
    seg.classList.remove("active", "complete");
    if (i < currentStep - 1) seg.classList.add("complete");
    else if (i === currentStep - 1) seg.classList.add("active");
  });
}

function completeAllSegments() {
  segments.forEach((seg) => {
    seg.classList.remove("active");
    seg.classList.add("complete");
  });
}

function resetSegments() {
  segments.forEach((seg) => seg.classList.remove("active", "complete"));
}

function log(message, cls = "") {
  const line = document.createElement("div");
  line.className = "line" + (cls ? " " + cls : "");
  const time = new Date().toLocaleTimeString([], { hour12: false });
  line.textContent = `[${time}] ${message}`;
  el.console.appendChild(line);
  el.console.scrollTop = el.console.scrollHeight;
}

function setStatus(state, text) {
  el.statusPill.className = "status-pill" + (state ? " " + state : "");
  el.statusText.textContent = text;
}

function fmtETA(seconds) {
  if (seconds == null || isNaN(seconds)) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `ETA ${m}:${String(s).padStart(2, "0")}`;
}

function setRunningUI(running) {
  el.startBtn.disabled = running;
  el.cancelBtn.disabled = !running;
  el.rescanBtn.disabled = running;
  el.browseInput.disabled = running;
  el.browseOutput.disabled = running;
  el.modelSelect.disabled = running;
  el.runSynthBtn.disabled = running;
}

// ---------------------------------------------------------------------
// Events pushed live from the Python worker thread -- extraction and
// synthesis share this one console/status area rather than separate
// panels, since only one runs at a time (mutually disabled).
// ---------------------------------------------------------------------

window.onPipelineEvent = function (event, payload) {
  switch (event) {
    case "scan":
      el.statFound.textContent = payload.found;
      el.statProcessed.textContent = payload.processed;
      el.statRemaining.textContent = payload.remaining;
      break;

    case "model_fallback":
      el.modelNote.textContent =
        `Auto-switched: "${payload.requested.replace("models/", "")}" ` +
        `unavailable (${payload.reason}) -> using "${payload.used.replace("models/", "")}"`;
      log(
        `MODEL SWITCH: ${payload.requested} unavailable -- ` +
        `now using ${payload.used} instead`,
        "accent"
      );
      break;

    case "paper_start":
      el.paperLabel.textContent = payload.filename;
      el.paperCount.textContent = `Paper ${payload.index} / ${payload.total}`;
      el.stepLabel.textContent = "Starting...";
      resetSegments();
      log(`Processing ${payload.filename}`, "hd");
      break;

    case "step":
      el.stepLabel.textContent = `[${payload.step}/${payload.step_total}] ${payload.label}`;
      setSegments(payload.step);
      log(`  [${payload.step}/${payload.step_total}] ${payload.label}`);
      break;

    case "paper_done":
      completeAllSegments();
      el.etaLabel.textContent = payload.eta_seconds > 0 ? fmtETA(payload.eta_seconds) : "";
      log(`Done in ${payload.seconds}s -> ${payload.filename}`, "ok");
      break;

    case "paper_error":
      log(`FAILED: ${payload.filename} -- ${payload.message}`, "err");
      break;

    case "cancelled":
      setStatus("", "Cancelled");
      setRunningUI(false);
      log(payload.message, "err");
      break;

    case "error":
      setStatus("error", "Error");
      setRunningUI(false);
      log(payload.message, "err");
      break;

    case "done":
      setStatus("done", "Completed");
      setRunningUI(false);
      el.stepLabel.textContent = "Idle";
      el.etaLabel.textContent = "";
      log(payload.message, "accent");
      scan();
      break;

    case "papers_added":
      if (payload.copied?.length) log(`Added: ${payload.copied.join(", ")}`, "ok");
      if (payload.skipped?.length) log(`Skipped: ${payload.skipped.join(", ")}`, "err");
      scan();
      break;

    case "synthesis_start":
      el.startBtn.disabled = true;
      el.paperLabel.textContent = "Building Knowledge Base";
      el.paperCount.textContent = "";
      el.stepLabel.textContent = `Running (${payload.model_key})...`;
      resetSegments();
      el.openBriefBtn.style.display = "none";
      el.synthNote.style.color = "var(--accent)";
      el.synthNote.textContent = `Running (${payload.model_key})... this can take a few minutes, especially for "pro".`;
      log(`Knowledge base synthesis started (${payload.model_key}).`, "hd");
      break;

    case "synthesis_done": {
      el.runSynthBtn.disabled = false;
      el.startBtn.disabled = false;
      el.stepLabel.textContent = "Idle";
      completeAllSegments();
      const warn = payload.unverified_count > 0
        ? ` -- ${payload.unverified_count} unverified, check log`
        : "";
      el.synthNote.style.color = payload.unverified_count > 0 ? "var(--error)" : "var(--success)";
      el.synthNote.textContent =
        `${payload.model_used.replace("models/", "")}: ${payload.ranked_count} material(s) ranked, ` +
        `${payload.contradiction_count} contradiction(s), ${payload.gap_count} gap(s)${warn}`;
      log(`Knowledge base built -> ${payload.markdown_path}`, "ok");
      if (payload.unverified_count > 0) {
        log(`${payload.unverified_count} recommendation(s) failed the citation grounding check -- review before trusting.`, "err");
      }
      lastMarkdownPath = payload.markdown_path;
      el.openBriefBtn.style.display = "block";
      break;
    }

    case "synthesis_error":
      el.runSynthBtn.disabled = false;
      el.startBtn.disabled = false;
      el.stepLabel.textContent = "Idle";
      el.synthNote.style.color = "var(--error)";
      el.synthNote.textContent = "Failed: " + payload.message;
      log(`Knowledge base synthesis failed: ${payload.message}`, "err");
      break;
  }
};

// ---------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------

async function scan() {
  const result = await pywebview.api.scan(el.inputDir.value, el.outputDir.value);
  if (result.error) {
    log(result.error, "err");
    el.statFound.textContent = "--";
    el.statProcessed.textContent = "--";
    el.statRemaining.textContent = "--";
    return;
  }
  el.statFound.textContent = result.found;
  el.statProcessed.textContent = result.processed;
  el.statRemaining.textContent = result.remaining;
}

async function persistSettings() {
  await pywebview.api.save_settings(el.inputDir.value, el.outputDir.value, el.modelSelect.value);
}

async function persistSynthSettings() {
  await pywebview.api.save_settings(
    el.inputDir.value, el.outputDir.value, el.modelSelect.value,
    el.synthModelSelect.value, el.envelopeInput.value
  );
}

el.browseInput.addEventListener("click", async () => {
  const chosen = await pywebview.api.browse_folder(el.inputDir.value);
  if (chosen) {
    el.inputDir.value = chosen;
    await persistSettings();
    scan();
  }
});

el.browseOutput.addEventListener("click", async () => {
  const chosen = await pywebview.api.browse_folder(el.outputDir.value);
  if (chosen) {
    el.outputDir.value = chosen;
    await persistSettings();
    scan();
  }
});

el.modelSelect.addEventListener("change", persistSettings);

el.rescanBtn.addEventListener("click", scan);

el.addPapersBtn.addEventListener("click", async () => {
  const paths = await pywebview.api.pick_papers();
  if (!paths || paths.length === 0) return;
  await copyPapersIn(paths);
});

async function copyPapersIn(paths) {
  log(`Copying ${paths.length} file(s) into input folder...`, "hd");
  const result = await pywebview.api.upload_papers(el.inputDir.value, paths);
  if (result.copied?.length) log(`Added: ${result.copied.join(", ")}`, "ok");
  if (result.skipped?.length) log(`Skipped (not PDF or copy failed): ${result.skipped.join(", ")}`, "err");
  scan();
}

el.synthModelSelect.addEventListener("change", persistSynthSettings);
el.envelopeInput.addEventListener("blur", persistSynthSettings);

el.runSynthBtn.addEventListener("click", async () => {
  await persistSynthSettings();
  el.runSynthBtn.disabled = true;
  el.startBtn.disabled = true;
  el.openBriefBtn.style.display = "none";
  el.synthNote.style.color = "var(--text-muted)";
  el.synthNote.textContent = "Starting...";
  const result = await pywebview.api.run_synthesis(
    el.outputDir.value, el.synthModelSelect.value, el.envelopeInput.value
  );
  if (result.error) {
    el.runSynthBtn.disabled = false;
    el.startBtn.disabled = false;
    el.synthNote.style.color = "var(--error)";
    el.synthNote.textContent = "Failed: " + result.error;
  }
});

el.openBriefBtn.addEventListener("click", () => {
  if (lastMarkdownPath) pywebview.api.open_folder(lastMarkdownPath);
});

el.startBtn.addEventListener("click", async () => {
  await persistSettings();
  el.console.innerHTML = "";
  el.modelNote.textContent = "";
  setStatus("running", "Running");
  setRunningUI(true);
  const result = await pywebview.api.start_pipeline(el.inputDir.value, el.outputDir.value, el.modelSelect.value);
  if (result.error) {
    log(result.error, "err");
    setStatus("error", "Error");
    setRunningUI(false);
  } else {
    log("Pipeline started.", "hd");
  }
});

el.cancelBtn.addEventListener("click", async () => {
  el.cancelBtn.disabled = true;
  log("Cancelling after current paper finishes its step...", "accent");
  await pywebview.api.cancel_pipeline();
});

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------

applyTheme(localStorage.getItem("theme") || "dark");

window.addEventListener("pywebviewready", async () => {
  buildSegments();
  const settings = await pywebview.api.load_settings();
  el.inputDir.value = settings.input_dir;
  el.outputDir.value = settings.output_dir;

  const models = await pywebview.api.get_models();
  el.modelSelect.innerHTML = models
    .map((m) => `<option value="${m}">${m.replace("models/", "")}</option>`)
    .join("");
  el.modelSelect.value = settings.model || models[0];

  const synthModels = await pywebview.api.get_synthesis_models();
  el.synthModelSelect.innerHTML = synthModels
    .map((m) => `<option value="${m.key}">${m.label}</option>`)
    .join("");
  el.synthModelSelect.value = settings.synthesis_model || synthModels[0].key;
  el.envelopeInput.value = settings.envelope || "";

  setStatus("", "Idle");
  log("Ready. Scanning folders...", "hd");
  scan();
});
