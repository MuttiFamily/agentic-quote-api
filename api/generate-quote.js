import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '..', 'assets/images/agentic-logo.png');
const PRICING_PATH = path.join(__dirname, '..', 'pricing.json');
const pricing = JSON.parse(fs.readFileSync(PRICING_PATH, 'utf8'));

function parseForm(body) {
  const out = {};
  body.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '));
  });
  return out;
}

const projectLabels = {
  'mutti-family-villas': 'Mutti Family Villas',
  'silhouette-by-the-zero': '"Silhouette" by The Zero',
  'the-zero-bang-tao': 'The Zero Bang Tao',
  'layan-lucky-villas': 'Layan Lucky Villas',
  'other': 'Other / Investor build'
};

function unitLabel(v) {
  return {
    '3-bed-villa':'3-bed villa','4-bed-villa':'4-bed villa','5-bed-villa':'5-bed villa',
    'studio':'Studio','1-bed':'1-bed','2-bed':'2-bed','plot':'Land / Plot',
    'villa':'Villa','condo':'Condo','other':'Other'
  }[v] || v || '—';
}
function budgetLabel(v) {
  return {
    'under-5m':'Under THB 5M','5m-20m':'THB 5M – 20M','20m-100m':'THB 20M – 100M','100m-plus':'THB 100M+'
  }[v] || v || '—';
}
function timelineLabel(v) {
  return {
    'now':'Now','3-months':'Within 3 months','6-months':'Within 6 months','exploring':'Exploring'
  }[v] || v || '—';
}
function offerTypeLabel(v) {
  return {
    'purchase':'Purchase','off-plan':'Off-plan Reservation','build':'Build-to-Spec','other':'Other'
  }[v] || v || '—';
}

function emailTemplate(ref, data) {
  return `
    <div style="font-family: system-ui, sans-serif; background:#0f1419; color:#e6e7ea; padding:32px; border-radius:16px; max-width:640px; margin:0 auto;">
      <div style="text-align:center; margin-bottom:24px;">
        <h1 style="font-size:22px; margin:0 0 8px; color:#c5a059;">Your quotation is ready</h1>
        <p style="color:#b0b8c4; margin:0;">Reference: ${ref}</p>
      </div>
      <div style="background:#1a2130; border:1px solid #2a3344; border-radius:12px; padding:20px; margin-bottom:20px;">
        <p style="margin:0 0 8px; color:#b0b8c4;">Project</p>
        <p style="margin:0 0 16px; font-weight:700;">${data.project}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">Unit type</p>
        <p style="margin:0 0 16px;">${unitLabel(data.unit_type) || '—'}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">Budget range</p>
        <p style="margin:0 0 16px;">${budgetLabel(data.budget_range) || '—'}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">Timeline</p>
        <p style="margin:0 0 16px;">${timelineLabel(data.timeline) || '—'}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">Offer type</p>
        <p style="margin:0;">${offerTypeLabel(data.offer_type) || '—'}</p>
      </div>
      <p style="color:#b0b8c4; font-size:13px; text-align:center;">Questions? Reply to this email or WhatsApp +66 98 860 6410.</p>
    </div>
  `;
}

async function generateQuotePdf(ref, projectKey, data) {
  const doc = await PDFDocument.create();
  const page = doc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const marginX = 52;

  let logoImage;
  try {
    const logoBytes = fs.readFileSync(LOGO_PATH);
    logoImage = await doc.embedPng(logoBytes);
  } catch (e) {
    console.error('Logo embed error', e);
  }
  let y = height - 64;

  const black = rgb(15/255, 20/255, 25/255);
  const gold = rgb(197/255, 160/255, 89/255);
  const muted = rgb(150/255, 155/255, 160/255);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  function drawText(text, x, py, fontRef, color, size, wordWrap = false) {
    const maxWidth = width - marginX * 2;
    const toDraw = wordWrap ? wrapText(text, fontRef, size, maxWidth) : [text];
    for (const line of toDraw) {
      page.drawText(line, { x, y: py, size, font: fontRef, color });
      py -= size * 1.3;
    }
    return py;
  }

  function wrapText(text, fontRef, size, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (fontRef.widthOfTextAtSize(test, size) > maxWidth) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  page.drawRectangle({ x: 0, y: height - 52, width, height: 52, color: black });
  page.drawRectangle({ x: 0, y: height - 50, width, height: 2, color: gold });

  const logoWidth = 140;
  const logoHeight = logoWidth * (76 / 557);
  const logoY = height - 50 - logoHeight;
  if (logoImage) {
    page.drawImage(logoImage, { x: marginX, y: logoY, width: logoWidth, height: logoHeight });
  }

  y = logoY - 18;
  y = drawText('QUOTATION', marginX, y, bold, black, 18);
  y -= 8;

  page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: rgb(220/255, 220/255, 220/255) });
  y -= 16;

  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  y = drawText(`Date: ${date}`, marginX, y, font, black, 10);
  y = drawText(`Reference: ${ref}`, marginX, y, font, black, 10);
  y -= 10;

  page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: rgb(230/255, 230/255, 230/255) });
  y -= 18;

  y = drawText('Prepared for', marginX, y, bold, black, 12);
  y = drawText(`${data.name}`, marginX, y, font, black, 11);
  if (data.email) y = drawText(data.email, marginX, y, font, muted, 10);
  if (data.phone) y = drawText(data.phone, marginX, y, font, muted, 10);
  if (data.country) y = drawText(data.country, marginX, y, font, muted, 10);
  y -= 6;

  page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: rgb(230/255, 230/255, 230/255) });
  y -= 18;

  y = drawText('Project details', marginX, y, bold, black, 12);
  const pricingEntry = pricing[projectKey];
  const unitKey = data.unit_type;
  const unitPricing = pricingEntry?.units?.[unitKey];
  const rows = [
    { label: 'Project', value: data.project },
    { label: 'Unit type', value: unitLabel(data.unit_type) }
  ];
  if (unitPricing) {
    if (unitPricing.builtUpSqm) {
      rows.push({ label: 'Built-up area', value: unitPricing.builtUpSqm + ' sqm' });
    }
    if (unitPricing.plotSqm) {
      rows.push({ label: 'Plot size', value: unitPricing.plotSqm + ' sqm' });
    }
    if (unitPricing.priceFrom || unitPricing.priceTo) {
      const from = unitPricing.priceFrom ? 'THB ' + (unitPricing.priceFrom / 1000000).toFixed(1) + 'M' : '—';
      const to = unitPricing.priceTo ? 'THB ' + (unitPricing.priceTo / 1000000).toFixed(1) + 'M' : (from === '—' ? '—' : 'on request');
      rows.push({ label: 'Price', value: from === to ? from : `${from} – ${to}` });
    }
    if (unitPricing.notes) {
      rows.push({ label: 'Availability', value: unitPricing.notes });
    }
  }
  rows.push(
    { label: 'Budget range', value: budgetLabel(data.budget_range) },
    { label: 'Timeline', value: timelineLabel(data.timeline) },
    { label: 'Offer type', value: offerTypeLabel(data.offer_type) }
  );
  for (const l of rows) {
    y = drawText(l.label + ':', marginX, y, bold, muted, 10);
    y = drawText(l.value, marginX + 110, y - 10, font, black, 10, true);
  }

  if (data.message) {
    y -= 10;
    page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: rgb(230/255, 230/255, 230/255) });
    y -= 18;
    y = drawText('Notes', marginX, y, bold, black, 12);
    y = drawText(data.message, marginX, y, font, muted, 10, true);
  }

  if (pricingEntry?.paymentPlan) {
    y -= 14;
    page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: gold });
    y -= 18;
    y = drawText('Payment plan', marginX, y, bold, black, 12);
    y = drawText(pricingEntry.paymentPlan, marginX, y, font, muted, 9, true);
  }

  y -= 14;
  page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: gold });
  y -= 16;
  y = drawText('This quotation is indicative and subject to final confirmation.', marginX, y, font, muted, 9);
  y = drawText('Pricing and availability depend on final unit selection, payment plan, and contract date.', marginX, y, font, muted, 9);

  page.drawRectangle({ x: marginX, y: 0, width: width - marginX * 2, height: 52, color: black });
  if (logoImage) {
    const smallW = 76;
    const smallH = smallW * (76 / 557);
    page.drawImage(logoImage, { x: marginX, y: (52 - smallH) / 2, width: smallW, height: smallH });
  }
  page.drawText('salesmutti@gmail.com · +66 98 860 6410', {
    x: marginX + 90, y: 18, size: 9, font, color: gold
  });

  return doc;
}

function jsonResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body),
    isBase64Encoded: false
  };
}

function pdfResponse(pdfBase64, filename, ref) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*'
    },
    body: pdfBase64,
    isBase64Encoded: true
  };
}

export default async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return jsonResponse({}, 204);
    }

    if (event.httpMethod !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const body = typeof event.body === 'string' ? event.body : Buffer.from(event.body || '', 'base64').toString();
    let parsed;
    if (typeof event.headers?.['content-type'] === 'string' && event.headers['content-type'].includes('application/json')) {
      try { parsed = JSON.parse(body); } catch { parsed = parseForm(body); }
    } else {
      parsed = parseForm(body);
    }
    const {
      name, email, phone, country,
      project, unit_type, budget_range, timeline, offer_type, message
    } = parsed;

    if (!email) {
      return jsonResponse({ error: 'Email is required' }, 400);
    }

    const ref = 'AGT-' + new Date().getFullYear() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

    const pdf = await generateQuotePdf(ref, project, {
      name: name || 'Valued Client',
      email: email || '',
      phone: phone || '',
      country: country || '',
      project: projectLabels[project] || project || 'Other',
      unit_type, budget_range, timeline, offer_type, message
    });

    const pdfBuffer = Buffer.from(await pdf.save());
    const pdfBase64 = pdfBuffer.toString('base64');

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      try {
        await resend.emails.send({
          from: 'Agentic <noreply@agenticphuket.com>',
          to: [email, 'salesmutti@gmail.com'].filter(Boolean),
          subject: `Your Agentic quotation — ${projectLabels[project] || 'Request'} (${ref})`,
          html: emailTemplate(ref, {
            name: name || 'Valued Client',
            project: projectLabels[project] || project || 'Other',
            unit_type, budget_range, timeline, offer_type
          }),
          attachments: [
            {
              filename: `Agentic-Quotation-${ref}.pdf`,
              content: pdfBuffer
            }
          ]
        });
      } catch (e) {
        console.error('Resend error', e);
      }
    }

    return pdfResponse(pdfBase64, `Agentic-Quotation-${ref}.pdf`, ref);

  } catch (err) {
    console.error('Quote generation error:', err);
    return jsonResponse({ error: err.message || 'Quote generation failed' }, 500);
  }
};
