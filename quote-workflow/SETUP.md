# Advisory Automation Setup — Option 3

## Goal
Separate advisory pipeline from Facebook leads. Auto-generate a branded advisory overview PDF via Google Doc template and email it to customer + info@agenticphuket.com. Zero cost.

## Files in this folder
- `quote-script.js` — full Apps Script code to paste into Google Apps Script

## Step-by-step

### 1. Create Google Sheet
- Name: `Agentic Quotes`
- Make a header row with these columns:
  timestamp | name | email | phone | country | intent | budget_range | timeline | spending_style | message | quote_doc_id | quote_doc_url | status

### 2. Create Google Doc template
- Name: `Quote Template` (must match this exact name)
- Paste this content:
  ```
  AGENTIC
  Advisory overview

  Date: {{date}}
  Reference: {{ref}}

  Prepared for
  Name: {{name}}
  Email: {{email}}
  Phone: {{phone}}
  Country: {{country}}

  Your profile
  Intent: {{intent}}
  Budget range: {{budget_range}}
  Timeline: {{timeline}}
  How ready are you: {{spending_style}}
  Notes: {{message}}

  {{disclaimer}}

  Agentic · info@agenticphuket.com · +66 98 860 6410
  ```
- The placeholder `{{logo_url}}` is replaced by the script with an external image URL. For best results, insert the URL `https://v3b.fal.media/files/b/0a9edf53/og-agentic-brand.png` manually in the doc and label it (it won't auto-insert because external images in HTML export are limited).

### 3. Paste Apps Script
- In the same Sheet → Extensions → Apps Script
- Replace any starter script with the full contents of `quote-script.js`
- Save project as `Advisory Automation`

### 4. Authorize and deploy
- Click **Deploy** → **New deployment**
- Select type: **Web app**
- Execute as: **Me**
- Who has access: **Anyone, even anonymous**
- Copy the **Web app URL**

### 5. Update website form
- In `get-an-offer/index.html` replace:
  `/__quote_web_app_url_placeholder__/exec`
  with your actual Apps Script URL ending in `/exec`

### 6. Test
- Submit the form on `/get-an-offer/`
- Check Sheet for new row
- Check inbox for PDF email
- Verify PDF formatting

## Notes and caveats
- Google Docs PDF export formatting is basic (no CSS). Keep template simple.
- If you want richer styling, replace the PDF generation with Google Slides or skip PDF and send a well-formatted HTML email.
- The script sends one email per recipient to avoid CC issues.
- PDF export requires the copy step (makeCopy) — do not delete `createQuoteTemplate()`.
- If your GCP org restricts anonymous web apps, this will fail; ask us to switch to n8n/Render.
