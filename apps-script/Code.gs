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
 *     title | date | intro | total | terms |
 *     signature | signed_name | signed_date
 *
 *  "Line Items" tab — one row per line item. Headers (row 1):
 *     proposal_id | item | description | price
 *  (Match proposal_id to the proposal's id. Description is optional.)
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

/** Build the line items array for a given proposal id, from the Line Items tab. */
function _itemsFor(id) {
  var t = _table(ITEMS_SHEET_NAME);
  if (!t.sh) return [];
  var c = function (name) { return t.headers.indexOf(name); };
  var pidCol = c("proposal_id"), nameCol = c("item"), descCol = c("description"), priceCol = c("price");
  var out = [];
  for (var i = 0; i < t.values.length; i++) {
    if (String(t.values[i][pidCol]).trim() === String(id).trim()) {
      out.push({
        name: nameCol > -1 ? t.values[i][nameCol] : "",
        desc: descCol > -1 ? t.values[i][descCol] : "",
        price: priceCol > -1 ? t.values[i][priceCol] : ""
      });
    }
  }
  return out;
}

/** GET ?id=xxx  → returns the proposal (with its items) as JSON. */
function doGet(e) {
  try {
    var id = e && e.parameter ? String(e.parameter.id || "") : "";
    if (!id) return _json({ error: "missing id" });

    var t = _table(SHEET_NAME, 0);
    var idCol = t.headers.indexOf("id");
    for (var i = 0; i < t.values.length; i++) {
      if (String(t.values[i][idCol]).trim() === id) {
        var row = t.values[i];
        var obj = {};
        t.headers.forEach(function (h, c) { obj[h] = row[c]; });
        return _json({
          status: obj.status || "Sent",
          title: obj.title || "Proposal",
          client_name: obj.client_name || "",
          client_company: obj.client_company || "",
          date: obj.date || "",
          intro: obj.intro || "",
          items: _itemsFor(id),
          total: obj.total || "",
          terms: obj.terms || "",
          signature: (String(obj.status).toLowerCase() === "signed") ? (obj.signature || "") : "",
          signed_name: obj.signed_name || "",
          signed_date: obj.signed_date || ""
        });
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
