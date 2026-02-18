const API_BASE = (window.__API_BASE__ || "").replace(/\/$/, "");
const HOME_HASH = "#/";
const RESULTS_ROUTE = "#/results";

const onboardingView = document.getElementById("onboarding-view");
const resultsView = document.getElementById("results-view");
const lookupForm = document.getElementById("lookup-form");
const lookupBtn = document.getElementById("lookup-btn");
const runBtn = document.getElementById("run-btn");
const newRunBtn = document.getElementById("new-run-btn");
const accountInput = document.getElementById("account");
const realmSelect = document.getElementById("realm");
const characterSelect = document.getElementById("character-select");
const characterMeta = document.getElementById("character-meta");
const characterPanel = document.getElementById("character-panel");
const runMeta = document.getElementById("run-meta");

const statusEl = document.getElementById("status");
const resultsStatusEl = document.getElementById("results-status");
const resultsEl = document.getElementById("results");
const postsView = document.getElementById("posts-view");
const holdingsList = document.getElementById("holdings-list");
const cardView = document.getElementById("card-view");
const summaryCards = document.getElementById("summary-cards");
const interestForm = document.getElementById("interest-form");
const interestBtn = document.getElementById("interest-btn");
const interestMeta = document.getElementById("interest-meta");
const contactInput = document.getElementById("contact");

let activeRunId = null;

function setStatus(message, kind = "info") {
  statusEl.className = `status ${kind}`;
  statusEl.textContent = message;
}

function hideStatus() {
  statusEl.className = "status hidden";
  statusEl.textContent = "";
}

function setResultsStatus(message, kind = "info") {
  resultsStatusEl.className = `status ${kind}`;
  resultsStatusEl.textContent = message;
}

function hideResultsStatus() {
  resultsStatusEl.className = "status hidden";
  resultsStatusEl.textContent = "";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetCharacters() {
  characterSelect.innerHTML = '<option value="">Auto-select newest character</option>';
}

function parseHashState() {
  const raw = window.location.hash || HOME_HASH;
  if (!raw.startsWith(RESULTS_ROUTE)) {
    return { route: "home", runId: null };
  }

  const parts = raw.split("?");
  const params = new URLSearchParams(parts[1] || "");
  const runId = params.get("run_id");
  return { route: "results", runId };
}

function setRoute(route, runId = null) {
  if (route === "results" && runId) {
    window.location.hash = `${RESULTS_ROUTE}?run_id=${encodeURIComponent(runId)}`;
    return;
  }
  window.location.hash = HOME_HASH;
}

function clearResults() {
  summaryCards.innerHTML = "";
  postsView.textContent = "";
  holdingsList.innerHTML = "";
  cardView.innerHTML = "";
  runMeta.textContent = "Loading run...";
  interestMeta.textContent = "No contact submitted yet.";
  contactInput.value = "";
  hideResultsStatus();
  resultsEl.classList.add("hidden");
}

function showView(route) {
  if (route === "results") {
    onboardingView.classList.add("hidden");
    resultsView.classList.remove("hidden");
    return;
  }
  onboardingView.classList.remove("hidden");
  resultsView.classList.add("hidden");
}

function renderSummary(data, runId) {
  const c = data.character_summary || {};
  const p = data.pricing_summary || {};
  runMeta.textContent = `Run ${runId} | ${c.name || "Unknown"} | ${c.league || "Unknown league"} | ${c.realm || "unknown realm"}`;

  summaryCards.innerHTML = `
    <div class="card"><div class="k">Character</div><div class="v">${escapeHtml(c.name || "Unknown")}</div></div>
    <div class="card"><div class="k">Known Value</div><div class="v">${escapeHtml(p.known_value_chaos || 0)} chaos</div></div>
    <div class="card"><div class="k">Coverage</div><div class="v">${escapeHtml(p.priced_items || 0)}/${escapeHtml(p.total_items || 0)}</div></div>
  `;

  postsView.textContent = (data.posts || []).join("\n") || "No posts generated.";

  const holdings = p.top_holdings || [];
  holdingsList.innerHTML = holdings.length
    ? holdings
        .map((h) => `<li>${escapeHtml(h.label)} x${escapeHtml(h.quantity)} (~${escapeHtml(h.chaos_value)}c)</li>`)
        .join("")
    : "<li>No priced holdings found.</li>";

  const card = data.build_card || {};
  const fields = card.fields || [];
  cardView.innerHTML = `
    <h3>${escapeHtml(card.title || "Build Intelligence")}</h3>
    <p>${escapeHtml(card.description || "")}</p>
    ${fields
      .map((f) => `<section><strong>${escapeHtml(f.name)}</strong><p>${escapeHtml(f.value)}</p></section>`)
      .join("")}
  `;
  resultsEl.classList.remove("hidden");
}

async function loadResultsRun(runId) {
  clearResults();
  activeRunId = runId;

  if (!runId) {
    setResultsStatus("Missing run_id in URL.", "error");
    return;
  }

  setResultsStatus("Loading stored run from backend...");
  try {
    const resp = await fetch(`${API_BASE}/api/onboard/run/${encodeURIComponent(runId)}`);
    const payload = await resp.json();

    if (!resp.ok) {
      throw new Error(payload.detail || "Failed to load run");
    }

    const result = payload.result || {};
    if (result.status === "error") {
      const note = (result.notes || ["Run failed"])[0];
      runMeta.textContent = `Run ${runId} | failed`;
      setResultsStatus(note, "error");
      return;
    }

    renderSummary(result, runId);
    setResultsStatus("Preview loaded.");
  } catch (err) {
    setResultsStatus(`Could not load run: ${err.message}`, "error");
  }
}

async function syncViewToHash() {
  const state = parseHashState();
  showView(state.route);

  if (state.route === "results") {
    await loadResultsRun(state.runId);
    return;
  }

  hideStatus();
}

lookupForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  hideStatus();
  resetCharacters();

  const account = accountInput.value.trim();
  const realm = realmSelect.value;
  if (account.length < 3) {
    setStatus("Enter a valid account name.", "error");
    return;
  }

  lookupBtn.disabled = true;
  runBtn.disabled = true;
  characterMeta.textContent = "Loading characters...";

  try {
    const resp = await fetch(
      `${API_BASE}/api/onboard/characters?account=${encodeURIComponent(account)}&realm=${encodeURIComponent(realm)}`
    );
    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.detail || "character lookup failed");
    }

    const chars = Array.isArray(data.characters) ? data.characters : [];
    for (const ch of chars) {
      const name = String(ch.name || "").trim();
      if (!name) {
        continue;
      }
      const parts = [];
      if (typeof ch.level === "number") {
        parts.push(`lvl ${ch.level}`);
      }
      if (ch.class) {
        parts.push(String(ch.class));
      }
      if (ch.league) {
        parts.push(String(ch.league));
      }
      const label = parts.length ? `${name} (${parts.join(" | ")})` : name;
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = label;
      characterSelect.appendChild(opt);
    }

    if (chars.length === 0) {
      characterMeta.textContent = "No public characters found for this account/realm.";
      characterPanel.classList.remove("hidden");
      runBtn.disabled = false;
      return;
    }

    if (characterSelect.options.length > 1) {
      characterSelect.value = characterSelect.options[1].value;
    }

    const sortText = data.sort_hint === "created_at" ? "creation time" : "best available signal";
    characterMeta.textContent = `Loaded ${chars.length} characters, ordered by ${sortText}.`;
    characterPanel.classList.remove("hidden");
    runBtn.disabled = false;
    setStatus("Characters loaded. Choose one and run preview.");
  } catch (err) {
    characterMeta.textContent = "Lookup failed.";
    setStatus(`Could not load characters: ${err.message}`, "error");
  } finally {
    lookupBtn.disabled = false;
  }
});

runBtn.addEventListener("click", async () => {
  hideStatus();

  const payload = {
    account: accountInput.value.trim(),
    realm: realmSelect.value,
    character: characterSelect.value || null,
    contact: null,
    intent: null,
  };

  runBtn.disabled = true;
  try {
    setStatus("Running market sync and build preview...");
    const resp = await fetch(`${API_BASE}/api/onboard/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.detail || "Request failed");
    }
    if (!data.run_id) {
      throw new Error("Backend response missing run_id");
    }
    setRoute("results", data.run_id);
  } catch (err) {
    setStatus(`Could not generate preview: ${err.message}`, "error");
  } finally {
    runBtn.disabled = false;
  }
});

newRunBtn.addEventListener("click", () => {
  setRoute("home");
});

interestForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  hideResultsStatus();

  if (!activeRunId) {
    setResultsStatus("No run selected for follow-up.", "error");
    return;
  }

  interestBtn.disabled = true;
  try {
    const resp = await fetch(`${API_BASE}/api/onboard/interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        run_id: activeRunId,
        contact: contactInput.value.trim() || null,
        intent: "maybe",
      }),
    });
    const payload = await resp.json();
    if (!resp.ok || payload.saved !== true) {
      throw new Error(payload.detail || "Failed to save interest");
    }
    interestMeta.textContent = "Thanks. Follow-up details were recorded.";
    setResultsStatus("Follow-up saved.");
  } catch (err) {
    setResultsStatus(`Could not save follow-up: ${err.message}`, "error");
  } finally {
    interestBtn.disabled = false;
  }
});

window.addEventListener("hashchange", () => {
  syncViewToHash();
});

if (!window.location.hash) {
  window.location.hash = HOME_HASH;
}
syncViewToHash();
