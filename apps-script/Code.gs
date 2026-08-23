/**
 * s2works — Proposal backend (Google Apps Script)
 * ------------------------------------------------
 * Serves proposal rows from a Google Sheet to the /proposal page and
 * records signatures back into the sheet + emails a notification.
 *
 * SETUP: see PROPOSAL-SETUP.md. In short:
 *   1. Open your proposals Google Sheet.
 *   2. Extensions → Apps Script. Paste this file in.
 *   3. Set SHEET_NAME + NOTIFY_EMAIL below if needed.
 *   4. Deploy → New deployment → Web app →
 *        Execute as: Me,  Who has access: Anyone.
 *   5. Copy the Web app URL and paste it into proposal/proposal.js
 *      (the APPS_SCRIPT_URL constant).
 *
 * Expected columns (row 1 = headers, exact names):
 *   id | status | client_name | client_company | client_email |
 *   title | date | intro | line_items | total | terms |
 *   signature | signed_name | signed_date
 *
 * line_items cell: one item per line, "Name | Description | Price"
 *   e.g.  High-Converting Website | Custom 5-page site | $2,500
 */

var SHEET_NAME = "Proposals";        // tab name in your spreadsheet
var NOTIFY_EMAIL = "info@s2works.ca"; // where signed alerts are sent

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function _rows() {
  var sh = _sheet();
  var values = sh.getDataRange().getValues();
  var headers = values.shift().map(function (h) { return String(h).trim(); });
  return { sh: sh, headers: headers, values: values };
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** GET ?id=xxx  → returns the proposal as JSON (never returns signature image). */
function doGet(e) {
  try {
    var id = e && e.parameter ? String(e.parameter.id || "") : "";
    if (!id) return _json({ error: "missing id" });

    var data = _rows();
    var idCol = data.headers.indexOf("id");
    for (var i = 0; i < data.values.length; i++) {
      if (String(data.values[i][idCol]).trim() === id) {
        var row = data.values[i];
        var obj = {};
        data.headers.forEach(function (h, c) { obj[h] = row[c]; });
        // Don't leak the stored signature image on GET unless already signed.
        return _json({
          status: obj.status || "Sent",
          title: obj.title || "Proposal",
          client_name: obj.client_name || "",
          client_company: obj.client_company || "",
          date: obj.date || "",
          intro: obj.intro || "",
          line_items: obj.line_items || "",
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

    var data = _rows();
    var idCol = data.headers.indexOf("id");
    var col = function (name) { return data.headers.indexOf(name); };

    for (var i = 0; i < data.values.length; i++) {
      if (String(data.values[i][idCol]).trim() === id) {
        var rowNum = i + 2; // +1 header, +1 to 1-based
        var sh = data.sh;
        if (col("status") > -1)      sh.getRange(rowNum, col("status") + 1).setValue("Signed");
        if (col("signed_name") > -1) sh.getRange(rowNum, col("signed_name") + 1).setValue(body.name || "");
        if (col("signed_date") > -1) sh.getRange(rowNum, col("signed_date") + 1).setValue(body.date || "");
        if (col("signature") > -1)   sh.getRange(rowNum, col("signature") + 1).setValue(body.signature || "");

        var company = col("client_company") > -1 ? data.values[i][col("client_company")] : "";
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
