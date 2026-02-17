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

let latestRun = null;

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
  holdingsList.innerHTML = holdings
    .map((h) => `<li>${escapeHtml(h.label)} x${escapeHtml(h.quantity)} (~${escapeHtml(h.chaos_value)}c)</li>`)
    .join("");

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

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  hideStatus();
  resultsEl.classList.add("hidden");
  submitBtn.disabled = true;

  const payload = {
    account: document.getElementById("account").value,
    realm: document.getElementById("realm").value,
    character: document.getElementById("character").value || null,
    contact: document.getElementById("contact").value,
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

    latestRun = { run_id: data.run_id, contact: payload.contact };
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
    contact: latestRun.contact,
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
