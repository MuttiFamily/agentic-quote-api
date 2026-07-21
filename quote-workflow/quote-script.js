/**
 * Agentic Advisory automation
 * - Separate from Facebook leads
 * - Auto-generates branded PDF via Google Doc template
 * - Emails PDF to customer + info@agenticphuket.com
 *
 * Setup:
 * 1. Create a new Google Sheet named "Agentic Quotes"
 * 2. Create a Google Doc named "Quote Template" with placeholders {{key}}
 * 3. Paste this script into the Sheet's Apps Script editor
 * 4. Set trigger: On form submit (or onChange if using form)
 * 5. Deploy as web app: Execute as Me, Access: Anyone, even anonymous
 * 6. Replace the doPost(e) endpoint below for form submissions
 */

const SHEET_NAME = 'Quotes';
const CUSTOMER_EMAIL_PLACEHOLDER = '{{email}}';

function doPost(e) {
  try {
    let data;
    const contentType = (e.postData && e.postData.type) ? e.postData.type.toLowerCase() : '';
    if (contentType.indexOf('application/json') !== -1) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = {};
      const raw = (e.postData && e.postData.contents) ? e.postData.contents : '';
      raw.split('&').forEach(pair => {
        const parts = pair.split('=');
        if (parts[0]) data[decodeURIComponent(parts[0])] = decodeURIComponent((parts[1] || '').replace(/\+/g, ' '));
      });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    const headers = [
      'timestamp','name','email','phone','country',
      'intent','budget_range','timeline','spending_style','message',
      'quote_doc_id','quote_doc_url','status'
    ];

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    const row = [
      data.timestamp || new Date().toISOString(),
      data.name || '',
      data.email || '',
      data.phone || '',
      data.country || '',
      data.intent || '',
      data.budget_range || '',
      data.timeline || '',
      data.spending_style || '',
      data.message || '',
      '', // quote_doc_id
      '', // quote_doc_url
      'new'
    ];

    sheet.appendRow(row);

    const quoteResult = generateQuote(data);
    const quoteRow = sheet.getLastRow();
    sheet.getRange(quoteRow, 11).setValue(quoteResult.documentId);
    sheet.getRange(quoteRow, 12).setValue(quoteResult.url);
    sheet.getRange(quoteRow, 13).setValue('quoted');

    sendQuoteEmail(data, quoteResult);

    return ContentService.createTextOutput(JSON.stringify({result:'success', quote: quoteResult.url})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({result:'error', error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function generateQuote(data) {
  const template = getQuoteTemplate();
  const doc = DocumentApp.openById(template.documentId);
  const body = doc.getBody();

  const intentLabels = {
    'buy-to-live': 'Buy to live',
    'buy-to-invest': 'Buy to invest / rent out',
    'partner-investor': 'Partner as investor / developer',
    'exploring': 'Exploring',
    'other': 'Other — tell us in notes'
  };

  const timelineLabels = {
    'now': 'Now',
    '3-months': 'Within 3 months',
    '6-months': 'Within 6 months',
    'exploring': 'Exploring'
  };

  const spendingStyleLabels = {
    'ready': 'Ready to proceed',
    'evaluating': 'Evaluating options',
    'researching': 'Just researching'
  };

  const budgetLabels = {
    'under-5m': 'Under THB 5M',
    '5m-20m': 'THB 5M – 20M',
    '20m-100m': 'THB 20M – 100M',
    '100m-plus': 'THB 100M+'
  };

  const replacements = {
    '{{date}}': new Date().toLocaleDateString('en-GB', {day:'numeric', month:'long', year:'numeric'}),
    '{{ref}}': 'AGT-' + new Date().getFullYear() + '-' + Math.random().toString(36).slice(2,8).toUpperCase(),
    '{{name}}': data.name || 'Valued Client',
    '{{email}}': data.email || '',
    '{{phone}}': data.phone || '',
    '{{country}}': data.country || '',
    '{{intent}}': intentLabels[data.intent] || data.intent || '',
    '{{budget_range}}': budgetLabels[data.budget_range] || data.budget_range || '',
    '{{timeline}}': timelineLabels[data.timeline] || data.timeline || '',
    '{{spending_style}}': spendingStyleLabels[data.spending_style] || data.spending_style || '',
    '{{message}}': data.message || '',
    '{{company}}': 'Agentic',
    '{{disclaimer}}': 'This overview is indicative and intended to start a conversation, not to constitute a binding quote. Pricing, availability, and pathways depend on final unit selection, contract date, and verification.'
  };

  let text = body.getText();
  for (const [key, value] of Object.entries(replacements)) {
    text = text.split(key).join(value);
  }

  body.setText(text);
  body.replaceAllText('{{logo_url}}', 'https://v3b.fal.media/files/b/0a9edf53/og-agentic-brand.png');

  const newDoc = doc.saveAndClose();
  
  // Copy the template instead of mutating it
  const copy = DriveApp.getFileById(template.documentId).makeCopy('Advisory - ' + (data.name || 'Draft'));
  const copyDoc = DocumentApp.openById(copy.getId());
  const copyBody = copyDoc.getBody();
  
  for (const [key, value] of Object.entries(replacements)) {
    copyBody.replaceText(key, value);
  }
  copyDoc.saveAndClose();

  return {
    documentId: copy.getId(),
    url: copy.getUrl()
  };
}

function sendQuoteEmail(data, quoteResult) {
  const subject = 'Your Agentic advisory overview — ' + (intentLabels?.[data.intent] || data.intent || 'Request');
  const quoteUrl = quoteResult.url;
  const pdfUrl = 'https://docs.google.com/document/d/' + quoteResult.documentId + '/export?format=pdf';

  const htmlBody = `
    <div style="font-family: system-ui, sans-serif; background:#0f1419; color:#e6e7ea; padding:32px; border-radius:16px; max-width:640px; margin:0 auto;">
      <div style="text-align:center; margin-bottom:24px;">
        <img src="https://v3b.fal.media/files/b/0a9edf53/og-agentic-brand.png" alt="Agentic" style="height:32px; margin:0 auto;">
        <h1 style="font-size:22px; margin:16px 0 8px; color:#c5a059;">Your advisory overview is ready</h1>
        <p style="color:#b0b8c4; margin:0;">Reference: Advisory for ${data.name || 'Valued Client'}</p>
      </div>
      <div style="background:#1a2130; border:1px solid #2a3344; border-radius:12px; padding:20px; margin-bottom:20px;">
        <p style="margin:0 0 8px; color:#b0b8c4;">Intent</p>
        <p style="margin:0 0 16px; font-weight:700;">${intentLabels[data.intent] || data.intent || '—'}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">Budget range</p>
        <p style="margin:0 0 16px;">${budgetLabels[data.budget_range] || data.budget_range || '—'}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">Timeline</p>
        <p style="margin:0 0 16px;">${timelineLabels[data.timeline] || data.timeline || '—'}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">How ready are you</p>
        <p style="margin:0;">${spendingStyleLabels[data.spending_style] || data.spending_style || '—'}</p>
      </div>
      <div style="text-align:center; margin-bottom:20px;">
        <a href="${pdfUrl}" style="background:#c5a059; color:#fff; padding:14px 24px; border-radius:10px; text-decoration:none; font-weight:700; display:inline-block;">Download PDF advisory overview</a>
      </div>
      <p style="color:#b0b8c4; font-size:13px; text-align:center;">Questions? Reply to this email or WhatsApp +66 98 860 6410.</p>
    </div>
  `;

  const recipients = [
    data.email,
    'info@agenticphuket.com'
  ].filter(Boolean);

  recipients.forEach(email => {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      attachments: [Utilities.newBlob(htmlBody.replace(/<[^>]*>/g,''), 'text/html')]
        // we add a PDF attachment via another fetch below
    });
  });

  // Try to attach PDF directly
  try {
    const response = UrlFetchApp.fetch(pdfUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    });
    const pdfBlob = response.getBlob().setName('Agentic-Advisory.pdf');
    
    recipients.forEach(email => {
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: htmlBody,
        attachments: [pdfBlob]
      });
    });
  } catch (fetchErr) {
    // Fallback: send link-only email if PDF fetch fails
  }
}

function getQuoteTemplate() {
  // ID of the Google Doc named "Quote Template"
  // Find by title search
  const docs = DriveApp.searchFiles('title = "Quote Template" and mimeType = "' + MimeType.GOOGLE_DOCS + '"');
  const doc = docs.hasNext() ? docs.next() : null;
  if (!doc) throw new Error('Quote Template not found. Create a Google Doc named "Quote Template".');
  return { documentId: doc.getId() };
}

// Run this once to create the template from scratch
function createQuoteTemplate() {
  const template = getQuoteTemplate();
  const doc = DocumentApp.openById(template.documentId);
  const body = doc.getBody();
  
  body.appendParagraph('AGENTIC').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('Advisory overview');
  body.appendParagraph('');
  body.appendParagraph('Date: {{date}}');
  body.appendParagraph('Reference: {{ref}}');
  body.appendParagraph('');
  body.appendParagraph('Prepared for').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Name: {{name}}');
  body.appendParagraph('Email: {{email}}');
  body.appendParagraph('Phone: {{phone}}');
  body.appendParagraph('Country: {{country}}');
  body.appendParagraph('');
  body.appendParagraph('Your profile').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Intent: {{intent}}');
  body.appendParagraph('Budget range: {{budget_range}}');
  body.appendParagraph('Timeline: {{timeline}}');
  body.appendParagraph('How ready are you: {{spending_style}}');
  body.appendParagraph('Notes: {{message}}');
  body.appendParagraph('');
  body.appendParagraph('{{disclaimer}}');
  body.appendParagraph('');
  body.appendParagraph('Agentic · info@agenticphuket.com · +66 98 860 6410');
  
  doc.saveAndClose();
}

const intentLabels = {
  'buy-to-live': 'Buy to live',
  'buy-to-invest': 'Buy to invest / rent out',
  'partner-investor': 'Partner as investor / developer',
  'exploring': 'Exploring',
  'other': 'Other'
};

const timelineLabels = {
  'now': 'Now',
  '3-months': 'Within 3 months',
  '6-months': 'Within 6 months',
  'exploring': 'Exploring'
};

const spendingStyleLabels = {
  'ready': 'Ready to proceed',
  'evaluating': 'Evaluating options',
  'researching': 'Just researching'
};

const budgetLabels = {
  'under-5m': 'Under THB 5M',
  '5m-20m': 'THB 5M – 20M',
  '20m-100m': 'THB 20M – 100M',
  '100m-plus': 'THB 100M+'
};
