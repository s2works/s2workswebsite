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

## Step 1 — Create the Google Sheet (two tabs)

The easiest way: open the **`s2works-proposals-template.xlsx`** file you were
given in Google Sheets (upload it to Drive → right-click → Open with → Google
Sheets, or **File → Import**). It already has both tabs and a sample proposal.

If you'd rather build it by hand, make a Google Sheet with **two tabs**:

### Tab 1 — `Proposals` (one row per proposal)
Headers in row 1 (exact names):

| id | status | client_name | client_company | client_email | title | date | intro | total | terms | signature | signed_name | signed_date |
|----|--------|-------------|----------------|--------------|-------|------|-------|-------|-------|-----------|-------------|-------------|

You fill in everything except the last three (`signature`, `signed_name`,
`signed_date`) — those are filled **automatically** when a client signs.

- **id** — a unique, hard-to-guess code. This is the client's private link (e.g. `8f3k2m9q`). Don't use `1`, `2`, `3`.
- **status** — leave blank or `Sent`. Becomes `Signed` automatically.
- **client_name / client_company / client_email** — who it's for.
- **title** — e.g. `Website + Lead Capture Proposal`.
- **date** — e.g. `August 23, 2026`.
- **intro** — the opening paragraph.
- **total** — e.g. `$3,000 + $99/mo`.
- **terms** — payment terms, validity, etc.

### Tab 2 — `Line Items` (one row per item)
Headers in row 1:

| proposal_id | item | description | price |
|-------------|------|-------------|-------|
| 8f3k2m9q | High-Converting Website | Custom 5-page site, mobile-ready | $2,500 |
| 8f3k2m9q | Lead Capture & Routing | Every inquiry sent straight to you | $500 |
| 8f3k2m9q | Management & Support | Hosting, security, updates | $99/mo |

Each item is its own row. The **`proposal_id`** must match the proposal's
**`id`** on the Proposals tab — that's how the page knows which items belong to
which proposal. Add as many rows as you need; `description` is optional.

**To add a new proposal:** add one row on the *Proposals* tab (with a new random
`id`), then add its items as rows on the *Line Items* tab using that same `id`.

---

## Step 2 — Add the backend script

1. In your Sheet, go to **Extensions → Apps Script**.
2. Delete anything in the editor and paste in the full contents of **`apps-script/Code.gs`** (from this repo).
3. If you renamed the tabs, or want alerts sent somewhere other than `info@s2works.ca`, edit the `SHEET_NAME`, `ITEMS_SHEET_NAME`, and `NOTIFY_EMAIL` lines near the top.
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

- **You:** add a proposal row + its item rows in the Sheet → copy the link `…/proposal?id=THEIR_ID` → send it to the client.
- **Client:** opens the link, reviews, draws their signature + types their name, clicks **Accept & Sign**, optionally downloads the PDF.
- **You:** get an email the moment they sign, and the signature + date land back in the Proposals tab.

---

## Notes & options

- **Re-deploying the script after edits:** use **Deploy → Manage deployments → Edit (pencil) → Version: New version**, so the URL stays the same.
- **Signature image** is stored in the Proposals tab as a data URL in the `signature` column. It can look like a long string — that's expected.
- **PDF** is generated in the client's browser from the on-screen proposal, so it always matches what they see (including their signature).
- **Access codes / stronger privacy:** the current model is "unguessable link." If you ever want an extra passcode step, that's a small addition — just ask.
