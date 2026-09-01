# Invoice page — setup guide

Invoices work exactly like proposals: a row in your Google Sheet, shown on a
branded page at a private link, with a PDF download.

```
https://www.s2works.ca/invoice?id=8f3k2m9q
```

> **Preview it now:** open `/invoice?id=demo` — a sample invoice, no setup needed.

Payment is by **Interac e-Transfer**: the invoice shows where to send it and a
reference number. You mark it paid in the Sheet when it lands.

---

## Step 1 — Add two tabs to your existing Sheet

Same spreadsheet as your proposals. Add these two tabs (exact names):

### Tab — `Invoices` (one row per invoice)

| id | status | invoice_number | client_name | client_company | client_email | title | issue_date | due_date | terms_short | intro | subtotal | tax_label | tax | total | notes | payment_note | paid_date | proposal_id |
|----|--------|----------------|-------------|----------------|--------------|-------|-----------|----------|-------------|-------|----------|-----------|-----|-------|-------|--------------|-----------|-------------|

- **id** — unique, hard-to-guess code (this is the client's private link).
- **status** — `Unpaid`, or `Paid` once the money arrives. Setting it to `Paid` swaps the page to a green "Paid in full" confirmation and hides the payment instructions.
- **invoice_number** — e.g. `INV-0001`. Also used as the e-Transfer reference.
- **title** — e.g. `Deposit — Website & Lead Management System`.
- **issue_date / due_date** — e.g. `August 25, 2026`.
- **terms_short** — small line under the due date, e.g. `Due on receipt`.
- **intro** — one short paragraph at the top.
- **subtotal / total** — the amounts. `total` is what shows as **Amount due**.
- **tax_label / tax** *(optional)* — leave blank while you're not registered for GST/HST. Fill them in later (e.g. `HST 15%` / `112.50`) and a tax row appears automatically — no code change needed.
- **notes** — anything after the payment block.
- **payment_note** *(optional)* — overrides the default e-Transfer note.
- **paid_date** — filled in by you when paid.
- **proposal_id** *(optional)* — links back to the proposal it came from.

### Tab — `Invoice Items` (one row per line)

| invoice_id | item | description | price |
|------------|------|-------------|-------|
| 8f3k2m9q | Deposit — 50% of project total | Website, lead capture, lead database | $375 |

`invoice_id` must match the invoice's `id`, exactly like Line Items → proposals.

---

## Step 2 — Update the Apps Script

The script now serves **both** proposals and invoices, so it needs one update:

1. Sheet → **Extensions → Apps Script**.
2. Select all the old code, delete it, paste in the new **`apps-script/Code.gs`**. Save.
3. **Deploy → Manage deployments → ✏️ edit → Version: New version → Deploy.**
   Keep the same deployment so the URL doesn't change — nothing on the site needs updating.

> This is a new *document type*, not just a new column, which is why a redeploy is
> needed this once. Adding more columns later still needs nothing.

---

## Step 3 — Create invoices (the fast way)

After a proposal is signed, you don't have to type anything:

1. Go to the **Proposals** tab and click any cell on the signed proposal's row.
2. Menu bar → **s2works → Create deposit + balance invoices**.
3. Enter the one-time project total (e.g. `750`).

It creates **two invoices** — a 50% deposit and a 50% balance — with new IDs,
sequential invoice numbers, the client's details, and their line items. It then
shows you both links. Edit anything on the Invoices tab before sending.

> The **s2works** menu appears after you reload the spreadsheet once (it's added
> when the sheet opens).

Prefer to do it by hand? Just add a row to `Invoices` + its rows to `Invoice Items`.

---

## Step 4 — Send it, then mark it paid

- Send the client `https://www.s2works.ca/invoice?id=THEIR_ID`.
- They pay by e-Transfer to **info@s2works.ca**, using the invoice number as the reference.
- When it lands, set **status** to `Paid` and fill **paid_date**. The page updates itself.

---

## Notes

- **Recurring monthly billing** (e.g. $150/mo support) is a subscription, not an invoice. Generating one by hand every month is exactly the busywork we build systems to remove — a Stripe subscription (or your bank's recurring e-Transfer request) is the better fit. Ask and we can wire it up.
- **This isn't bookkeeping.** The Sheet is a solid record, but keep invoice numbers sequential and hang on to it for tax time. If you register for GST/HST, fill in `tax_label` / `tax` and add your business number to the invoice notes.
- **Card payments** can be added later: drop a Stripe payment link into a column and we'll show a "Pay now" button next to the e-Transfer details.
