/**
 * s2works — Proposal + Invoice backend (Google Apps Script)
 * ---------------------------------------------------------
 * Serves proposal AND invoice rows from this Google Sheet to the website,
 * records proposal signatures back into the sheet, emails a notification,
 * and can generate deposit + balance invoices from a signed proposal.
 *
 * SETUP: see PROPOSAL-SETUP.md / INVOICE-SETUP.md. In short:
 *   1. Open your Google Sheet.
 *   2. Extensions → Apps Script. Paste this whole file in. Save.
 *   3. Deploy → Manage deployments → edit (pencil) → Version: New version.
 *      (Keeps the same URL, so nothing on the site needs changing.)
 *
 * FOUR TABS:
 *  "Proposals"     — id | status | client_name | client_company | client_email |
 *                    title | date | intro | subtotal | discount_label | discount |
 *                    total | terms | signature | signed_name | signed_date
 *  "Line Items"    — proposal_id | item | description | original_price | price
 *  "Invoices"      — id | status | invoice_number | client_name | client_company |
 *                    client_email | title | issue_date | due_date | terms_short |
 *                    intro | subtotal | tax_label | tax | total | notes |
 *                    payment_note | paid_date | proposal_id
 *  "Invoice Items" — invoice_id | item | description | price
 *
 * Optional columns stay hidden on the page when left blank (tax, discount, etc).
 */

var NOTIFY_EMAIL = "info@s2works.ca";  // where "signed" alerts are sent
var ETRANSFER_EMAIL = "info@s2works.ca"; // shown on invoices

/* Document types the web app can serve. Add another entry here to support a
   new document type — no page changes needed beyond a new front-end. */
var DOC_TYPES = {
  proposal: { sheet: "Proposals", items: "Line Items",    itemKey: "proposal_id" },
  invoice:  { sheet: "Invoices",  items: "Invoice Items", itemKey: "invoice_id"  }
};

function _ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

function _table(name, fallbackIndex) {
  var sh = _ss().getSheetByName(name) || (fallbackIndex != null ? _ss().getSheets()[fallbackIndex] : null);
  if (!sh) return { sh: null, headers: [], values: [] };
  var values = sh.getDataRange().getValues();
  var headers = values.shift().map(function (h) { return String(h).trim(); });
  return { sh: sh, headers: headers, values: values };
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Items belonging to a document id. Returns every column in the items tab,
 *  plus name/desc aliases the pages use. */
function _itemsFor(cfg, id) {
  var t = _table(cfg.items);
  if (!t.sh) return [];
  var keyCol = t.headers.indexOf(cfg.itemKey);
  if (keyCol < 0) return [];
  var out = [];
  for (var i = 0; i < t.values.length; i++) {
    if (String(t.values[i][keyCol]).trim() === String(id).trim()) {
      var it = {};
      t.headers.forEach(function (h, c) { it[h] = t.values[i][c]; });
      it.name = it.item;
      it.desc = it.description;
      out.push(it);
    }
  }
  return out;
}

/** GET ?id=xxx            → a proposal (default type)
 *  GET ?type=invoice&id=x → an invoice
 *  Returns every column by name, so new columns need no script change. */
function doGet(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var id = String(p.id || "");
    var type = String(p.type || "proposal").toLowerCase();
    var cfg = DOC_TYPES[type];
    if (!cfg) return _json({ error: "unknown type" });
    if (!id) return _json({ error: "missing id" });

    var t = _table(cfg.sheet, type === "proposal" ? 0 : null);
    if (!t.sh) return _json({ error: "missing tab: " + cfg.sheet });

    var idCol = t.headers.indexOf("id");
    for (var i = 0; i < t.values.length; i++) {
      if (String(t.values[i][idCol]).trim() === id) {
        var obj = {};
        t.headers.forEach(function (h, c) { obj[h] = t.values[i][c]; });
        obj.status = obj.status || (type === "invoice" ? "Unpaid" : "Sent");
        obj.items = _itemsFor(cfg, id);
        // never expose the stored signature image before it's signed
        if (type === "proposal" && String(obj.status).toLowerCase() !== "signed") obj.signature = "";
        return _json(obj);
      }
    }
    return _json({ error: "not found" });
  } catch (err) {
    return _json({ error: String(err) });
  }
}

/** POST {id, name, date, signature} → records a proposal signature + notifies. */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var id = String(body.id || "").trim();
    if (!id) return _json({ error: "missing id" });

    var cfg = DOC_TYPES.proposal;
    var t = _table(cfg.sheet, 0);
    var idCol = t.headers.indexOf("id");
    var col = function (name) { return t.headers.indexOf(name); };

    for (var i = 0; i < t.values.length; i++) {
      if (String(t.values[i][idCol]).trim() === id) {
        var rowNum = i + 2;
        var sh = t.sh;
        if (col("status") > -1)      sh.getRange(rowNum, col("status") + 1).setValue("Signed");
        if (col("signed_name") > -1) sh.getRange(rowNum, col("signed_name") + 1).setValue(body.name || "");
        if (col("signed_date") > -1) sh.getRange(rowNum, col("signed_date") + 1).setValue(body.date || "");
        if (col("signature") > -1)   sh.getRange(rowNum, col("signature") + 1).setValue(body.signature || "");

        var company = col("client_company") > -1 ? t.values[i][col("client_company")] : "";
        try {
          MailApp.sendEmail({
            to: NOTIFY_EMAIL,
            subject: "✅ Proposal signed — " + (body.name || "") + (company ? " (" + company + ")" : ""),
            body: "A proposal has been signed.\n\n" +
                  "Name: " + (body.name || "") + "\n" +
                  "Company: " + company + "\n" +
                  "Date: " + (body.date || "") + "\n" +
                  "Proposal ID: " + id + "\n\n" +
                  "Tip: open the Proposals tab, select this row, then use the\n" +
                  "s2works menu → \"Create deposit + balance invoices\".\n"
          });
        } catch (mailErr) { /* signing still succeeds if email fails */ }

        return _json({ ok: true });
      }
    }
    return _json({ error: "not found" });
  } catch (err) {
    return _json({ error: String(err) });
  }
}

/* ============================================================
   Invoice generator — adds an "s2works" menu to the spreadsheet
   ============================================================ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("s2works")
    .addItem("Create deposit + balance invoices", "createInvoicesFromProposal")
    .addToUi();
}

function _randomId() {
  var chars = "abcdefghijkmnpqrstuvwxyz23456789";
  var out = "";
  for (var i = 0; i < 8; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

/** Next INV-#### based on what's already in the Invoices tab. */
function _nextInvoiceNumber() {
  var t = _table("Invoices");
  var col = t.headers.indexOf("invoice_number");
  var max = 0;
  if (t.sh && col > -1) {
    t.values.forEach(function (r) {
      var m = String(r[col] || "").match(/(\d+)\s*$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
  }
  return "INV-" + ("0000" + (max + 1)).slice(-4);
}

/** Append a row to a tab, filling by header name. */
function _appendByHeader(tabName, obj) {
  var t = _table(tabName);
  if (!t.sh) throw new Error('Missing tab: "' + tabName + '"');
  var row = t.headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ""; });
  t.sh.appendRow(row);
}

/**
 * Select a row on the Proposals tab, then run this from the s2works menu.
 * Creates a 50% deposit invoice and a 50% balance invoice, plus their items.
 */
function createInvoicesFromProposal() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();

  if (sheet.getName() !== DOC_TYPES.proposal.sheet) {
    ui.alert('Open the "Proposals" tab and click the row you want to invoice, then run this again.');
    return;
  }

  var t = _table(DOC_TYPES.proposal.sheet, 0);
  var rowIndex = sheet.getActiveRange().getRow() - 2; // -1 header, -1 zero-based
  if (rowIndex < 0 || rowIndex >= t.values.length) {
    ui.alert("Click any cell on the proposal row you want to invoice, then run this again.");
    return;
  }

  var p = {};
  t.headers.forEach(function (h, c) { p[h] = t.values[rowIndex][c]; });

  // Ask for the one-time amount to split (totals are free text like "$750 + $150/mo")
  var guess = String(p.total || p.subtotal || "").replace(/[^0-9.]/g, "").split(".")[0];
  var resp = ui.prompt(
    "Create invoices for " + (p.client_name || "this client"),
    'One-time project total to split 50/50 (numbers only, e.g. 750):',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var amount = Number(String(resp.getResponseText() || guess).replace(/[^0-9.]/g, ""));
  if (!amount || isNaN(amount)) { ui.alert("That didn't look like a number — nothing was created."); return; }

  var half = Math.round((amount / 2) * 100) / 100;
  var balance = Math.round((amount - half) * 100) / 100;
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM d, yyyy");

  var made = [];
  [
    { label: "Deposit", amt: half, terms: "Due on receipt",
      intro: "Thank you for accepting the proposal. This is the 50% deposit to get started — the balance will be invoiced at launch.",
      item: "Deposit — 50% of project total",
      notes: "Balance of $" + balance + " due at launch." },
    { label: "Balance", amt: balance, terms: "Due at launch",
      intro: "Your project is complete. This is the remaining 50% balance.",
      item: "Balance — remaining 50% of project total",
      notes: "Thank you for your business." }
  ].forEach(function (spec) {
    var id = _randomId();
    var number = _nextInvoiceNumber();
    _appendByHeader("Invoices", {
      id: id,
      status: "Unpaid",
      invoice_number: number,
      client_name: p.client_name,
      client_company: p.client_company,
      client_email: p.client_email,
      title: spec.label + " — " + (p.title || "Project"),
      issue_date: today,
      due_date: spec.label === "Deposit" ? today : "",
      terms_short: spec.terms,
      intro: spec.intro,
      subtotal: spec.amt,
      total: spec.amt,
      notes: spec.notes,
      proposal_id: p.id
    });
    _appendByHeader("Invoice Items", {
      invoice_id: id,
      item: spec.item,
      description: (p.title || "Project") + " — project total $" + amount + ".",
      price: spec.amt
    });
    made.push(spec.label + " (" + number + "): https://www.s2works.ca/invoice?id=" + id);
  });

  ui.alert("Invoices created\n\n" + made.join("\n\n") +
           "\n\nBoth rows are on the Invoices tab — edit anything before sending.");
}
