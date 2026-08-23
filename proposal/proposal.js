/* ============================================================
   s2works — Proposal page logic
   ============================================================ */

/* CONFIG — after you deploy the Google Apps Script web app,
   paste its /exec URL between the quotes below. Until then, the
   page runs in demo mode. */
const APPS_SCRIPT_URL = "";

/* Demo proposal shown when ?id=demo (or no backend configured). */
const DEMO = {
  status: "Sent",
  title: "Website + Lead Capture Proposal",
  client_name: "Jane Doe",
  client_company: "Doe Plumbing Co.",
  date: "August 23, 2026",
  intro: "Thank you for the opportunity to put this together. Below is a clear breakdown of exactly what we'll build, what it costs, and the terms. Everything is designed to bring in more leads and make sure none of them slip through the cracks — with no extra work on your end.",
  items: [
    { name: "High-Converting Website", desc: "Custom 5-page website, mobile-ready and built to turn visitors into calls.", price: "$2,500" },
    { name: "Lead Capture & Routing", desc: "Every form, email, and call captured and sent straight to you, instantly.", price: "$500" },
    { name: "Management & Support", desc: "Hosting, security, updates, and changes handled for you.", price: "$99/mo" }
  ],
  total: "$3,000 + $99/mo",
  terms: "50% deposit due on acceptance, balance due on launch. Monthly support billed on the 1st and cancellable any time with 30 days' notice. This proposal is valid for 30 days from the date above."
};

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const proposalId = params.get("id") || "";

/* ---------- Load ---------- */
function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

async function load() {
  const demoMode = !APPS_SCRIPT_URL || proposalId === "demo" || proposalId === "";
  if (demoMode) {
    render(DEMO, true);
    return;
  }
  try {
    const res = await fetch(APPS_SCRIPT_URL + "?id=" + encodeURIComponent(proposalId), { redirect: "follow" });
    const data = await res.json();
    if (!data || data.error || !data.client_name) throw new Error("not found");
    render(data, false);
  } catch (err) {
    hide($("state-loading"));
    show($("state-error"));
  }
}

/* ---------- Render ---------- */
function render(data, isDemo) {
  $("p-title").textContent = data.title || "Proposal";
  $("p-client").textContent = data.client_name || "";
  $("p-company").textContent = data.client_company || "";
  $("p-date").textContent = data.date || "";

  if (data.intro) $("p-intro").textContent = data.intro;
  else hide($("p-intro-section"));

  // Line items — accept an array, or a newline string "Name | Desc | Price"
  const items = Array.isArray(data.items) ? data.items : parseItems(data.line_items || data.items || "");
  const wrap = $("p-items");
  wrap.innerHTML = "";
  items.forEach((it) => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML =
      '<span class="item-name"></span>' +
      '<span class="item-price"></span>' +
      (it.desc ? '<span class="item-desc"></span>' : "");
    row.querySelector(".item-name").textContent = it.name || "";
    row.querySelector(".item-price").textContent = it.price || "";
    if (it.desc) row.querySelector(".item-desc").textContent = it.desc;
    wrap.appendChild(row);
  });
  $("p-total").textContent = data.total || "";

  if (data.terms) {
    $("p-terms").innerHTML = "";
    String(data.terms).split(/\n{1,}/).forEach((para) => {
      if (!para.trim()) return;
      const p = document.createElement("p");
      p.textContent = para.trim();
      $("p-terms").appendChild(p);
    });
  } else {
    hide($("p-terms-section"));
  }

  // Date field default
  $("sign-date").value = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  hide($("state-loading"));
  show($("proposal"));

  // Already signed? lock into signed state.
  if (data.status && String(data.status).toLowerCase() === "signed" && data.signature) {
    showSigned(data.signature, data.signed_name || data.client_name, data.signed_date || "");
  } else {
    initSignaturePad();
  }
  window.__isDemo = isDemo;
}

function parseItems(str) {
  return String(str)
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((s) => s.trim());
      if (parts.length >= 3) return { name: parts[0], desc: parts[1], price: parts[2] };
      if (parts.length === 2) return { name: parts[0], price: parts[1] };
      return { name: parts[0], price: "" };
    });
}

/* ---------- Signature pad ---------- */
let sigCtx, sigHasInk = false;

function initSignaturePad() {
  const canvas = $("sig-pad");
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  sigCtx = canvas.getContext("2d");
  sigCtx.scale(ratio, ratio);
  sigCtx.lineWidth = 2.2;
  sigCtx.lineCap = "round";
  sigCtx.lineJoin = "round";
  sigCtx.strokeStyle = "#111";

  let drawing = false;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const start = (e) => { drawing = true; const p = pos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); e.preventDefault(); };
  const move = (e) => {
    if (!drawing) return;
    const p = pos(e);
    sigCtx.lineTo(p.x, p.y); sigCtx.stroke();
    if (!sigHasInk) { sigHasInk = true; $("sig-placeholder").style.display = "none"; }
    e.preventDefault();
  };
  const end = () => { drawing = false; };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);

  $("sig-clear").addEventListener("click", () => {
    sigCtx.clearRect(0, 0, canvas.width, canvas.height);
    sigHasInk = false;
    $("sig-placeholder").style.display = "";
  });

  $("btn-sign").addEventListener("click", sign);
}

/* ---------- Sign ---------- */
async function sign() {
  const name = $("sign-name").value.trim();
  const status = $("sign-status");
  if (!name) { status.textContent = "Please type your full name."; return; }
  if (!sigHasInk) { status.textContent = "Please draw your signature above."; return; }
  status.textContent = "";

  const dataUrl = $("sig-pad").toDataURL("image/png");
  const dateStr = $("sign-date").value;
  const btn = $("btn-sign");
  btn.disabled = true; btn.textContent = "Submitting…";

  if (window.__isDemo) {
    setTimeout(() => showSigned(dataUrl, name, dateStr + "  (demo — not saved)"), 500);
    return;
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ id: proposalId, name: name, date: dateStr, signature: dataUrl })
    });
    const out = await res.json();
    if (out && out.error) throw new Error(out.error);
    showSigned(dataUrl, name, dateStr);
  } catch (err) {
    status.textContent = "Could not submit — please email us at info@s2works.ca.";
    btn.disabled = false; btn.textContent = "Accept & Sign";
  }
}

function showSigned(imgData, name, dateStr) {
  $("signed-img").src = imgData;
  $("signed-name").textContent = name;
  $("signed-date").textContent = dateStr;
  hide($("sign-unsigned"));
  show($("sign-signed"));
}

/* ---------- PDF export ---------- */
$("btn-pdf").addEventListener("click", () => {
  const doc = $("proposal-doc");
  document.body.classList.add("exporting");
  const client = ($("p-client").textContent || "Proposal").replace(/[^a-z0-9]+/gi, "-");
  html2pdf().set({
    margin: 0,
    filename: "Proposal-" + client + ".pdf",
    image: { type: "jpeg", quality: 0.96 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
    jsPDF: { unit: "pt", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] }
  }).from(doc).save().then(() => {
    document.body.classList.remove("exporting");
  }).catch(() => {
    document.body.classList.remove("exporting");
  });
});

load();
