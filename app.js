const API_BASE = (window.__API_BASE__ || "").replace(/\/$/, "");

const lookupForm = document.getElementById("lookup-form");
const lookupBtn = document.getElementById("lookup-btn");
const runBtn = document.getElementById("run-btn");
const accountInput = document.getElementById("account");
const realmSelect = document.getElementById("realm");
const characterSelect = document.getElementById("character-select");
const characterMeta = document.getElementById("character-meta");
const characterPanel = document.getElementById("character-panel");

const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const postsView = document.getElementById("posts-view");
const holdingsList = document.getElementById("holdings-list");
const cardView = document.getElementById("card-view");
const summaryCards = document.getElementById("summary-cards");

function setStatus(message, kind = "info") {
  statusEl.className = `status ${kind}`;
  statusEl.textContent = message;
}

function hideStatus() {
  statusEl.className = "status hidden";
  statusEl.textContent = "";
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

function renderSummary(data) {
  const c = data.character_summary || {};
  const p = data.pricing_summary || {};

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
}

lookupForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  hideStatus();
  resultsEl.classList.add("hidden");
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
  resultsEl.classList.add("hidden");

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
    if (!resp.ok || data.status === "error") {
      const note = (data.notes || ["Request failed"])[0];
      throw new Error(note);
    }

    renderSummary(data);
    resultsEl.classList.remove("hidden");
    setStatus("Preview complete.");
  } catch (err) {
    setStatus(`Could not generate preview: ${err.message}`, "error");
  } finally {
    runBtn.disabled = false;
  }
});
