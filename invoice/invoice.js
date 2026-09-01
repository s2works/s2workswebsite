/* ============================================================
   s2works — Invoice page logic
   ============================================================ */

/* CONFIG — same Apps Script web app as the proposal page.
   The ?type=invoice parameter tells it to read the Invoices tabs. */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz9H-xwWCLAh1lnYYi57yGgMVmFvEzaTtn-berv8xGWLMrXZkgXinZAxVQikZ3vIcA/exec";

/* Where clients send the e-Transfer. */
const ETRANSFER_EMAIL = "info@s2works.ca";

/* Demo invoice shown when ?id=demo (or no backend configured). */
const DEMO = {
  status: "Unpaid",
  invoice_number: "INV-0001",
  title: "Deposit — Website & Lead Management System",
  client_name: "Cedric Leblanc",
  client_company: "Cedric Leblanc Realtor",
  issue_date: "August 25, 2026",
  due_date: "September 1, 2026",
  terms_short: "Due on receipt",
  intro: "Thank you for accepting the proposal. This is the 50% deposit to get started — the balance will be invoiced at launch.",
  items: [
    { name: "Deposit — 50% of project total", desc: "Website, lead capture system, and lead database. Project total $750.", price: "$375" }
  ],
  subtotal: "$375",
  total: "$375",
  notes: "Balance of $375 due at launch. Monthly hosting and support ($150/mo) begins on the launch date and is billed on the 1st."
};

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const invoiceId = params.get("id") || "";

function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

/* ---------- Load ---------- */
async function load() {
  const demoMode = !APPS_SCRIPT_URL || invoiceId === "demo" || invoiceId === "";
  if (demoMode) { render(DEMO, true); return; }
  try {
    const res = await fetch(
      APPS_SCRIPT_URL + "?type=invoice&id=" + encodeURIComponent(invoiceId),
      { redirect: "follow" }
    );
    const data = await res.json();
    if (!data || data.error || !data.client_name) throw new Error("not found");
    render(data, false);
  } catch (err) {
    hide($("state-loading"));
    show($("state-error"));
  }
}

/* ---------- Render ---------- */
function render(data) {
  const number = data.invoice_number || "";
  $("i-title").textContent = data.title || ("Invoice " + number);
  $("i-client").textContent = data.client_name || "";
  $("i-company").textContent = data.client_company || "";
  $("i-number").textContent = number;
  $("i-issued").textContent = data.issue_date ? "Issued " + formatDate(data.issue_date) : "";
  $("i-due").textContent = formatDate(data.due_date);
  $("i-terms-short").textContent = data.terms_short || "";

  if (data.intro) $("i-intro").textContent = data.intro;
  else hide($("i-intro-section"));

  // Line items
  const items = Array.isArray(data.items) ? data.items : [];
  const wrap = $("i-items");
  wrap.innerHTML = "";
  items.forEach((it) => wrap.appendChild(buildItemRow(it)));

  // Subtotal / optional tax / total
  if (data.subtotal) { $("i-subtotal").textContent = formatPrice(data.subtotal); show($("row-subtotal")); }
  else hide($("row-subtotal"));

  if (data.tax) {
    $("i-tax-label").textContent = data.tax_label || "Tax";
    $("i-tax").textContent = formatPrice(data.tax);
    show($("row-tax"));
  } else hide($("row-tax"));

  const isPaid = String(data.status || "").toLowerCase() === "paid";
  $("i-total-label").textContent = isPaid ? "Total" : "Amount due";
  $("i-total").textContent = formatPrice(data.total);

  // Paid vs unpaid
  if (isPaid) {
    show($("paid-badge"));
    hide($("pay-section"));
    $("paid-date").textContent = data.paid_date ? "Received " + formatDate(data.paid_date) : "";
    show($("paid-section"));
  } else {
    $("pay-email").textContent = ETRANSFER_EMAIL;
    $("pay-ref").textContent = number || "Your name";
    $("pay-amount").textContent = formatPrice(data.total);
    if (data.payment_note) $("pay-note").textContent = data.payment_note;
  }

  if (data.notes) {
    $("i-notes").innerHTML = "";
    String(data.notes).split(/\n{1,}/).forEach((para) => {
      if (!para.trim()) return;
      const p = document.createElement("p");
      p.textContent = para.trim();
      $("i-notes").appendChild(p);
    });
  } else {
    hide($("i-notes-section"));
  }

  hide($("state-loading"));
  show($("invoice"));
}

/* ---------- Item row (matches the proposal's rows) ---------- */
function buildItemRow(it) {
  const row = document.createElement("div");
  row.className = "item";
  row.innerHTML =
    '<span class="item-name"></span>' +
    '<span class="item-price"></span>' +
    (it.desc ? '<span class="item-desc"></span>' : "");
  row.querySelector(".item-name").textContent = it.name || "";
  const priceCell = row.querySelector(".item-price");
  priceCell.textContent = "";
  if (it.original_price) {
    const was = document.createElement("s");
    was.className = "item-was";
    was.textContent = formatPrice(it.original_price);
    priceCell.appendChild(was);
    priceCell.appendChild(document.createTextNode(" "));
  }
  priceCell.appendChild(document.createTextNode(formatPrice(it.price)));
  if (it.desc) row.querySelector(".item-desc").textContent = it.desc;
  return row;
}

/* ---------- Formatting ---------- */
function formatDate(v) {
  if (!v) return "";
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T/); // ISO from a Sheets date cell
  if (m) {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return months[parseInt(m[2], 10) - 1] + " " + parseInt(m[3], 10) + ", " + m[1];
  }
  return s;
}

function formatPrice(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const s = String(v).trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return "$" + Number(s).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return s;
}

/* ---------- PDF export ---------- */
$("btn-pdf").addEventListener("click", () => {
  const doc = $("invoice-doc");
  document.body.classList.add("exporting");
  const who = ($("i-number").textContent || $("i-client").textContent || "Invoice").replace(/[^a-z0-9]+/gi, "-");
  html2pdf().set({
    margin: 0,
    filename: "Invoice-" + who + ".pdf",
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
