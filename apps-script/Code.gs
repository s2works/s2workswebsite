/**
 * s2works — Proposal backend (Google Apps Script)
 * ------------------------------------------------
 * Serves proposal rows from a Google Sheet to the /proposal page and
 * records signatures back into the sheet + emails a notification.
 *
 * SETUP: see PROPOSAL-SETUP.md. In short:
 *   1. Open your proposals Google Sheet.
 *   2. Extensions → Apps Script. Paste this file in.
 *   3. Set the SHEET/EMAIL names below if you changed them.
 *   4. Deploy → New deployment → Web app →
 *        Execute as: Me,  Who has access: Anyone.
 *   5. Copy the Web app URL and paste it into proposal/proposal.js
 *      (the APPS_SCRIPT_URL constant).
 *
 * TWO TABS:
 *  "Proposals" tab — one row per proposal. Headers (row 1, exact names):
 *     id | status | client_name | client_company | client_email |
 *     title | date | intro | subtotal | discount_label | discount |
 *     total | terms | signature | signed_name | signed_date
 *   (subtotal, discount_label, discount are OPTIONAL — for the summary block.)
 *
 *  "Line Items" tab — one row per line item. Headers (row 1):
 *     proposal_id | item | description | original_price | price
 *   (Match proposal_id to the proposal's id. description and original_price
 *    are OPTIONAL. original_price shows struck through next to price.)
 */

var SHEET_NAME = "Proposals";        // proposals tab
var ITEMS_SHEET_NAME = "Line Items"; // line items tab
var NOTIFY_EMAIL = "info@s2works.ca"; // where signed alerts are sent

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

/** Build the line items array for a given proposal id, from the Line Items tab.
 *  Returns every column in the tab (so new columns like original_price flow
 *  through automatically), plus name/desc aliases the page uses. */
function _itemsFor(id) {
  var t = _table(ITEMS_SHEET_NAME);
  if (!t.sh) return [];
  var pidCol = t.headers.indexOf("proposal_id");
  var out = [];
  for (var i = 0; i < t.values.length; i++) {
    if (String(t.values[i][pidCol]).trim() === String(id).trim()) {
      var it = {};
      t.headers.forEach(function (h, c) { it[h] = t.values[i][c]; });
      it.name = it.item;        // alias for the page
      it.desc = it.description; // alias for the page
      out.push(it);
    }
  }
  return out;
}

/** GET ?id=xxx  → returns the proposal (all columns) plus its items, as JSON.
 *  Returns every column by name, so adding new columns to the Proposals tab
 *  (e.g. subtotal, discount) needs no further script changes. */
function doGet(e) {
  try {
    var id = e && e.parameter ? String(e.parameter.id || "") : "";
    if (!id) return _json({ error: "missing id" });

    var t = _table(SHEET_NAME, 0);
    var idCol = t.headers.indexOf("id");
    for (var i = 0; i < t.values.length; i++) {
      if (String(t.values[i][idCol]).trim() === id) {
        var obj = {};
        t.headers.forEach(function (h, c) { obj[h] = t.values[i][c]; });
        obj.status = obj.status || "Sent";
        obj.title = obj.title || "Proposal";
        obj.items = _itemsFor(id);
        // Only expose the stored signature image once the proposal is signed.
        if (String(obj.status).toLowerCase() !== "signed") obj.signature = "";
        return _json(obj);
      }
    }
    return _json({ error: "not found" });
  } catch (err) {
    return _json({ error: String(err) });
  }
}

/** POST {id, name, date, signature}  → records the signature + notifies. */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var id = String(body.id || "").trim();
    if (!id) return _json({ error: "missing id" });

    var t = _table(SHEET_NAME, 0);
    var idCol = t.headers.indexOf("id");
    var col = function (name) { return t.headers.indexOf(name); };

    for (var i = 0; i < t.values.length; i++) {
      if (String(t.values[i][idCol]).trim() === id) {
        var rowNum = i + 2; // +1 header, +1 to 1-based
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
                  "Proposal ID: " + id + "\n"
          });
        } catch (mailErr) { /* signing still succeeds even if email fails */ }

        return _json({ ok: true });
      }
    }
    return _json({ error: "not found" });
  } catch (err) {
    return _json({ error: String(err) });
  }
}
