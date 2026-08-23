# Proposal page — setup guide

The proposal page lives at **`/proposal`** on the site. Each client opens a
private link like:

```
https://www.s2works.ca/proposal?id=8f3k2m9q
```

It pulls that proposal's content from a Google Sheet, displays it, lets the
client sign, records the signature back into the Sheet, emails you, and lets
them download a PDF.

> **Preview it now (no setup needed):** open `/proposal?id=demo` — it shows a
> sample proposal so you can see the design and try signing. Sample signatures
> are **not** saved.

---

## Step 1 — Create the Google Sheet

Make a new Google Sheet (call it whatever you like). On the first tab, name the
tab **`Proposals`** and put these **exact** column headers in row 1:

| id | status | client_name | client_company | client_email | title | date | intro | line_items | total | terms | signature | signed_name | signed_date |
|----|--------|-------------|----------------|--------------|-------|------|-------|------------|-------|-------|-----------|-------------|-------------|

You only fill in the first 11 columns. The last three
(`signature`, `signed_name`, `signed_date`) are filled **automatically** when a
client signs — leave them blank.

**What each column is:**
- **id** — a unique, hard-to-guess code for the proposal. This is the client's private link. Make it random, e.g. `8f3k2m9q`, `re7t2plumb`. (Anyone with the link can view, so don't use `1`, `2`, `3`.)
- **status** — leave blank or put `Sent`. Becomes `Signed` automatically after they sign.
- **client_name / client_company / client_email** — who it's for.
- **title** — e.g. `Website + Lead Capture Proposal`.
- **date** — e.g. `August 23, 2026`.
- **intro** — the opening paragraph.
- **line_items** — one service per line, in the format **`Name | Description | Price`**. Press **Alt+Enter** (Windows) / **Option+Enter** (Mac) to add a new line inside the cell. Example cell contents:
  ```
  High-Converting Website | Custom 5-page site, mobile-ready | $2,500
  Lead Capture & Routing | Every inquiry sent straight to you | $500
  Management & Support | Hosting, security, updates | $99/mo
  ```
  (Description is optional — `Name | Price` also works.)
- **total** — e.g. `$3,000 + $99/mo`.
- **terms** — payment terms, validity, etc. Use Alt/Option+Enter for paragraphs.

To add a new client, just duplicate a row and change the values (and give it a new random `id`).

---

## Step 2 — Add the backend script

1. In your Sheet, go to **Extensions → Apps Script**.
2. Delete anything in the editor and paste in the full contents of **`apps-script/Code.gs`** (from this repo).
3. If your tab isn't named `Proposals`, or you want alerts sent somewhere other than `info@s2works.ca`, edit the two lines near the top (`SHEET_NAME`, `NOTIFY_EMAIL`).
4. Click **Save**.

---

## Step 3 — Deploy it as a web app

1. Top-right, click **Deploy → New deployment**.
2. Click the gear icon → **Web app**.
3. Set:
   - **Execute as:** **Me** (your Google account)
   - **Who has access:** **Anyone**
4. Click **Deploy**. Google will ask you to **authorize** — approve it (it needs permission to read your sheet and send the notification email from your account).
5. Copy the **Web app URL** it gives you (ends in `/exec`).

> "Who has access: Anyone" only means the *script endpoint* is reachable — clients still need the secret `id` to see a specific proposal. No one can list or browse other proposals.

---

## Step 4 — Connect the page to the script

1. Open **`proposal/proposal.js`** in this repo.
2. Near the top, paste your Web app URL between the quotes:
   ```js
   const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfy..../exec";
   ```
3. Commit — the site redeploys automatically.

That's it. From now on:

- **You:** add a row in the Sheet → copy the link `…/proposal?id=THEIR_ID` → send it to the client.
- **Client:** opens the link, reviews, draws their signature + types their name, clicks **Accept & Sign**, optionally downloads the PDF.
- **You:** get an email the moment they sign, and the signature + date land back in the Sheet row.

---

## Notes & options

- **Re-deploying the script after edits:** use **Deploy → Manage deployments → Edit (pencil) → Version: New version**, so the URL stays the same.
- **Signature image** is stored in the Sheet as a data URL in the `signature` column. It can look like a long string in the cell — that's expected.
- **PDF** is generated in the client's browser from the on-screen proposal, so it always matches what they see (including their signature).
- **Access codes / stronger privacy:** the current model is "unguessable link." If you ever want an extra passcode step, that's a small addition — just ask.
