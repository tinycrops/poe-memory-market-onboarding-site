const API_BASE = (window.__API_BASE__ || "").replace(/\/$/, "");

const form = document.getElementById("onboard-form");
const interestForm = document.getElementById("interest-form");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const postsView = document.getElementById("posts-view");
const holdingsList = document.getElementById("holdings-list");
const cardView = document.getElementById("card-view");
const summaryCards = document.getElementById("summary-cards");
const submitBtn = document.getElementById("submit-btn");
const accountInput = document.getElementById("account");
const realmSelect = document.getElementById("realm");
const characterSelect = document.getElementById("character-select");
const characterManualInput = document.getElementById("character-manual");
const characterMeta = document.getElementById("character-meta");
const characterLoading = document.getElementById("character-loading");

let latestRun = null;
let characterLoadToken = 0;
let characterDebounceTimer = null;
let lastCharacterLookupKey = "";

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

function setCharacterMeta(text) {
  characterMeta.textContent = text;
}

function resetCharacterDropdown() {
  characterSelect.innerHTML = '<option value="">Auto-select newest character</option>';
}

function setCharacterLoading(isLoading) {
  characterSelect.disabled = isLoading;
  characterLoading.classList.toggle("hidden", !isLoading);
}

function scheduleCharacterLookup() {
  if (characterDebounceTimer) {
    clearTimeout(characterDebounceTimer);
  }
  characterDebounceTimer = setTimeout(() => {
    void loadCharacters();
  }, 450);
}

async function loadCharacters(force = false) {
  const account = accountInput.value.trim();
  const realm = realmSelect.value;

  if (account.length < 3) {
    setCharacterLoading(false);
    resetCharacterDropdown();
    setCharacterMeta("Enter account + realm to auto-load characters. Newest created characters are listed first when available.");
    lastCharacterLookupKey = "";
    return;
  }

  const lookupKey = `${account}|${realm}`;
  if (!force && lookupKey === lastCharacterLookupKey) {
    return;
  }

  setCharacterLoading(true);
  setCharacterMeta("Loading characters from Path of Exile...");
  const token = ++characterLoadToken;

  try {
    const resp = await fetch(
      `${API_BASE}/api/onboard/characters?account=${encodeURIComponent(account)}&realm=${encodeURIComponent(realm)}`
    );
    const data = await resp.json();

    if (token !== characterLoadToken) {
      return;
    }

    if (!resp.ok) {
      const detail = data.detail || "lookup failed";
      throw new Error(detail);
    }

    resetCharacterDropdown();
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

    if (chars.length > 0 && characterSelect.options.length > 1) {
      characterSelect.value = characterSelect.options[1].value;
    }

    lastCharacterLookupKey = lookupKey;
    if (chars.length === 0) {
      setCharacterMeta("No public characters found for this account/realm.");
    } else {
      const sortText = data.sort_hint === "created_at" ? "sorted by creation timestamp" : "sorted using best available order";
      setCharacterMeta(`Loaded ${chars.length} character${chars.length === 1 ? "" : "s"}; ${sortText}.`);
    }
  } catch (err) {
    resetCharacterDropdown();
    setCharacterMeta(`Could not load characters automatically: ${err.message}`);
    lastCharacterLookupKey = "";
  } finally {
    setCharacterLoading(false);
  }
}

accountInput.addEventListener("input", scheduleCharacterLookup);
accountInput.addEventListener("blur", () => {
  void loadCharacters();
});
realmSelect.addEventListener("change", () => {
  lastCharacterLookupKey = "";
  void loadCharacters(true);
});

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  hideStatus();
  resultsEl.classList.add("hidden");
  submitBtn.disabled = true;

  const manualCharacter = characterManualInput.value.trim();
  const selectedCharacter = characterSelect.value.trim();

  const payload = {
    account: accountInput.value.trim(),
    realm: realmSelect.value,
    character: manualCharacter || selectedCharacter || null,
    contact: document.getElementById("contact").value.trim() || null,
    intent: document.getElementById("intent").value || null,
  };

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

    latestRun = { run_id: data.run_id, contact: payload.contact || null };
    renderSummary(data);
    setStatus("Preview complete. Review your output below.");
    resultsEl.classList.remove("hidden");
  } catch (err) {
    setStatus(`Could not generate preview: ${err.message}`, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

interestForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!latestRun) {
    setStatus("Run a preview first.", "error");
    return;
  }

  const payload = {
    run_id: latestRun.run_id,
    contact: latestRun.contact || null,
    rating: document.getElementById("rating").value ? Number(document.getElementById("rating").value) : null,
    intent: document.getElementById("intent-followup").value || null,
    notes: document.getElementById("notes").value || null,
  };

  try {
    const resp = await fetch(`${API_BASE}/api/onboard/interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error("interest save failed");
    }
    setStatus("Interest saved. We will follow up shortly.");
  } catch (err) {
    setStatus(`Could not save interest: ${err.message}`, "error");
  }
});
