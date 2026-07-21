import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '..', 'assets/images/agentic-logo.png');
const INVENTORY_PATH = path.join(__dirname, '..', 'inventory.json');
const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));

function parseForm(body) {
  const out = {};
  body.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '));
  });
  return out;
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
function intentLabel(v) {
  return {
    'buy-to-live':'Buy to live','buy-to-invest':'Buy to invest / rent out','partner-investor':'Partner as investor / developer','exploring':'Exploring','other':'Other'
  }[v] || v || '—';
}
function spendingStyleLabel(v) {
  return {
    'ready':'Ready to proceed','evaluating':'Evaluating options','researching':'Just researching'
  }[v] || v || '—';
}
function pathwayLabel(v) {
  return {
    'buy-to-live':'Direct shortlist + viewings',
    'buy-to-invest':'Yield + property management',
    'partner-investor':'Deal flow + feasibility',
    'exploring':'Four-pathway comparison',
    'other':'Tailored match'
  }[v] || '—';
}

function budgetMin(v) {
  return { 'under-5m':0, '5m-20m':5000000, '20m-100m':20000000, '100m-plus':100000000 }[v] || 0;
}
function budgetMax(v) {
  return { 'under-5m':5000000, '5m-20m':20000000, '20m-100m':100000000, '100m-plus': Infinity }[v] || Infinity;
}

function matchedProjects(budget) {
  const lower = budgetMin(budget);
  const upper = budgetMax(budget);
  const projects = inventory.projects || [];
  let matches = projects.filter(p => p.priceFrom <= upper && p.priceTo >= lower);
  matches.sort((a, b) => a.priceFrom - b.priceFrom);
  return matches.slice(0, 2);
}

function investorScenario(budget) {
  return (inventory.investorScenarios && inventory.investorScenarios[budget]) || 'Share your budget band and we’ll map exact project combinations.';
}

function emailTemplate(ref, data) {
  const projects = matchedProjects(data.budget_range);
  const scenarioText = (data.intent === 'buy-to-invest' || data.intent === 'partner-investor')
    ? investorScenario(data.budget_range)
    : null;

  const projectsHtml = projects.map(p => `
    <div style="background:#0f1419; border:1px solid #2a3344; border-radius:12px; padding:16px; margin-bottom:12px;">
      <p style="margin:0 0 6px; font-weight:700; color:#e6e7ea; font-size:15px;">${p.name} · ${p.location}</p>
      <p style="margin:0 0 6px; color:#b0b8c4; font-size:13px;">${p.beds} bed · ${p.note}</p>
      <p style="margin:0; color:#c5a059; font-weight:700; font-size:14px;">From ${p.unitTypes[0].text.split(' ')[0]} THB ${p.unitTypes[0].priceFrom.toLocaleString('en-US')}</p>
    </div>
  `).join('');

  return `
    <div style="font-family: system-ui, sans-serif; background:#0f1419; color:#e6e7ea; padding:32px; border-radius:16px; max-width:640px; margin:0 auto;">
      <div style="text-align:center; margin-bottom:24px;">
        <h1 style="font-size:22px; margin:0 0 8px; color:#c5a059;">Your Agentic Advisory Overview is ready</h1>
        <p style="color:#b0b8c4; margin:0;">Reference: ${ref}</p>
      </div>
      <div style="background:#1a2130; border:1px solid #2a3344; border-radius:12px; padding:20px; margin-bottom:20px;">
        <p style="margin:0 0 8px; color:#b0b8c4;">Recommended pathway</p>
        <p style="margin:0 0 18px; font-weight:700; font-size:18px; color:#e6e7ea;">${pathwayLabel(data.intent)}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">Budget range</p>
        <p style="margin:0 0 16px;">${budgetLabel(data.budget_range) || '—'}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">Timeline</p>
        <p style="margin:0 0 16px;">${timelineLabel(data.timeline) || '—'}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">Primary intent</p>
        <p style="margin:0 0 16px;">${intentLabel(data.intent) || '—'}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">Readiness</p>
        <p style="margin:0;">${spendingStyleLabel(data.spending_style) || '—'}</p>
      </div>
      ${projectsHtml ? `
      <div style="background:#1a2130; border:1px solid #2a3344; border-radius:12px; padding:20px; margin-bottom:20px;">
        <p style="margin:0 0 10px; color:#c5a059; font-weight:700; font-size:14px; letter-spacing:0.5px; text-transform:uppercase;">Available for your budget</p>
        ${projectsHtml}
      </div>` : ''}
      ${scenarioText ? `
      <div style="background:#1a2130; border:1px solid #2a3344; border-radius:12px; padding:20px; margin-bottom:20px;">
        <p style="margin:0 0 8px; color:#c5a059; font-weight:700; font-size:14px; letter-spacing:0.5px; text-transform:uppercase;">What your budget can buy</p>
        <p style="margin:0; color:#e6e7ea; line-height:1.6; font-size:14px;">${scenarioText}</p>
      </div>` : ''}
      <p style="color:#b0b8c4; font-size:13px; text-align:center;">Questions? Reply to this email or WhatsApp +66 98 860 6410.</p>
    </div>
  `;
}

async function generateQuotePdf(ref, data) {
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
  const light = rgb(240/255, 243/255, 246/255);

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

  function drawBullet(text, x, py, fontRef, color, size) {
    const maxWidth = width - marginX * 2 - 18;
    const words = text.split(' ');
    let line = '• ';
    for (const w of words) {
      const test = line + w;
      if (fontRef.widthOfTextAtSize(test, size) > maxWidth) {
        page.drawText(line, { x, y: py, size, font: fontRef, color });
        py -= size * 1.35;
        line = '  ' + w;
      } else {
        line = test + ' ';
      }
    }
    if (line.trim()) {
      page.drawText(line.trim(), { x, y: py, size, font: fontRef, color });
      py -= size * 1.35;
    }
    return py;
  }

  // Header
  page.drawRectangle({ x: 0, y: height - 66, width, height: 66, color: black });
  page.drawRectangle({ x: 0, y: height - 2, width, height: 2, color: gold });

  const logoWidth = 160;
  const logoHeight = logoWidth * (76 / 557);
  const logoY = height - 33 - logoHeight / 2;
  if (logoImage) {
    page.drawImage(logoImage, { x: marginX, y: logoY, width: logoWidth, height: logoHeight });
  }

  y = logoY - 16;
  y = drawText('AGENTIC', marginX, y, bold, gold, 16);
  y = drawText('ADVISORY OVERVIEW', marginX, y, bold, black, 18);
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
  y = drawText(`${data.name || 'Valued Client'}`, marginX, y, font, black, 11);
  if (data.email) y = drawText(data.email, marginX, y, font, muted, 10);
  if (data.phone) y = drawText(data.phone, marginX, y, font, muted, 10);
  if (data.country) y = drawText(data.country, marginX, y, font, muted, 10);
  y -= 6;

  page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: rgb(230/255, 230/255, 230/255) });
  y -= 18;

  // Your profile
  y = drawText('Your profile', marginX, y, bold, black, 12);
  const profileRows = [
    { label: 'Budget range', value: budgetLabel(data.budget_range) },
    { label: 'Timeline', value: timelineLabel(data.timeline) },
    { label: 'Primary intent', value: intentLabel(data.intent) },
    { label: 'Readiness', value: spendingStyleLabel(data.spending_style) }
  ];
  for (const l of profileRows) {
    y = drawText(l.label + ':', marginX, y, bold, muted, 10);
    y = drawText(l.value, marginX + 110, y - 10, font, black, 10, true);
  }

  if (data.message) {
    y -= 10;
    page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: rgb(230/255, 230/255, 230/255) });
    y -= 18;
    y = drawText('Your notes', marginX, y, bold, black, 12);
    y = drawText(data.message, marginX, y, font, muted, 10, true);
  }

  // Recommended pathway
  y -= 18;
  page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: gold });
  y -= 18;
  y = drawText('Recommended pathway', marginX, y, bold, black, 12);
  y = drawText(pathwayLabel(data.intent), marginX, y, font, black, 11, true);
  y -= 6;

  const intent = data.intent || 'exploring';
  const style = data.spending_style || 'researching';
  const budget = data.budget_range || '';
  const projects = matchedProjects(budget);

  let pathwayLines = [];
  if (intent === 'buy-to-live') {
    pathwayLines.push('We shortlist projects that match your lifestyle, location preference, and budget.');
    pathwayLines.push('You get direct viewings with our in-house team and transparent pricing — no agent markup.');
    pathwayLines.push('After handover, we handle title transfer, utilities setup, and after-sales support.');
  } else if (intent === 'buy-to-invest') {
    pathwayLines.push('We present units and projects with clear rental yield and resale drivers.');
    pathwayLines.push('We can align you with property-management options so your asset is rent-ready from day one.');
    if (budget === 'under-5m') pathwayLines.push('Note: at this budget, best-fit options are typically agent-network condos; we can curate shortlist on request.');
  } else if (intent === 'partner-investor') {
    pathwayLines.push('Developer partnerships at Agentic usually require a 5M THB+ starting ticket.');
    if (budget && budget !== '100m-plus' && budget !== '20m-100m') {
      pathwayLines.push('With your stated band, the most realistic pathway is an off-plan reservation with an extended payment plan, or co-investing through an agent-curated scheme.');
    }
    pathwayLines.push('For larger tickets, we introduce you to deal flow, feasibility checks, and our construction track record.');
  } else if (intent === 'exploring') {
    pathwayLines.push('We map your situation across four pathways: direct purchase, off-plan, value-add, and development partnership.');
    pathwayLines.push('You get a clear comparison sheet with timelines, risk, and indicative ranges.');
  } else {
    pathwayLines.push('Tell us more in your notes so we can match you to the right Agentic pathway.');
  }

  const styleLine = style === 'ready'
    ? 'You’re ready to move: we prioritize docs, payment-plan lock, and a same-week proposal.'
    : style === 'evaluating'
    ? 'You’re comparing options: we provide side-by-side project comparisons and a shortlist within 48 hours.'
    : 'You’re in research mode: we send a private advisory pack and stay in touch quarterly.';
  pathwayLines.push(styleLine);

  for (const text of pathwayLines) {
    y = drawBullet(text, marginX, y, font, black, 10);
  }

  // Available for your budget
  if (projects.length) {
    y -= 14;
    page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: gold });
    y -= 18;
    y = drawText('Available for your budget', marginX, y, bold, black, 12);
    for (const p of projects) {
      y -= 2;
      const boxY = y + 14;
      const boxH = 56 + p.unitTypes.length * 16;
      page.drawRectangle({ x: marginX, y: boxY - boxH, width: width - marginX * 2, height: boxH, color: rgb(250/255, 251/255, 252/255) });
      page.drawRectangle({ x: marginX, y: boxY - boxH, width: width - marginX * 2, height: 1.2, color: rgb(230/255, 230/255, 230/255) });
      y = drawText(`${p.name} · ${p.location}`, marginX + 8, y, bold, black, 11);
      y = drawText(`${p.beds} bed · ${p.type} · ${p.note}`, marginX + 8, y, font, muted, 9, true);
      for (const u of p.unitTypes.slice(0, 4)) {
        y = drawText(`• ${u.name}: ${u.text}`, marginX + 16, y, font, black, 9);
      }
      if (p.unitTypes.length > 4) {
        y = drawText(`• +${p.unitTypes.length - 4} more configurations`, marginX + 16, y, muted, 9);
      }
      y -= 4;
    }
  }

  // What your budget can buy
  const scenarioText = (intent === 'buy-to-invest' || intent === 'partner-investor')
    ? investorScenario(budget)
    : null;

  if (scenarioText) {
    y -= 6;
    page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: gold });
    y -= 18;
    y = drawText('What your budget can buy', marginX, y, bold, black, 12);
    y = drawText(scenarioText, marginX, y, font, black, 10, true);
  }

  // By the numbers
  y -= 14;
  page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: rgb(220/255, 220/255, 220/255) });
  y -= 18;
  y = drawText('By the numbers', marginX, y, bold, black, 12);
  y -= 4;

  const byNumbers = [
    { label: 'Build new', value: '20–35% ROI', sub: '18–36 months · Medium–High risk' },
    { label: 'Off-plan', value: '15–25% ROI', sub: '12–24 months · Medium–High risk' },
    { label: 'Value-add', value: '15–30% ROI', sub: '12–24 months · Medium–High risk' },
    { label: 'Build your business', value: '25–40% ROI', sub: '24–48 months · High risk' }
  ];

  const col1X = marginX;
  const col2X = marginX + (width - marginX * 2) / 2 + 12;
  let colY = y;
  for (let i = 0; i < byNumbers.length; i++) {
    const item = byNumbers[i];
    const x = i < 2 ? col1X : col2X;
    const rowBase = i % 2 === 0 ? colY : colY - 28;
    const ry = rowBase;
    page.drawRectangle({ x: x - 6, y: ry - 40, width: (width - marginX * 2) / 2 - 12, height: 52, color: rgb(250/255, 251/255, 252/255) });
    page.drawRectangle({ x: x - 6, y: ry - 40, width: (width - marginX * 2) / 2 - 12, height: 1.2, color: rgb(230/255, 230/255, 230/255) });
    page.drawText(item.label, { x, y: ry - 12, size: 10, font: bold, color: black });
    page.drawText(item.value, { x, y: ry - 24, size: 10, font: bold, color: gold });
    page.drawText(item.sub, { x, y: ry - 34, size: 9, font, color: muted });

    if (i % 2 === 1) colY -= 56;
  }

  y = colY - 18;

  // Next step
  y -= 10;
  page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: gold });
  y -= 18;
  y = drawText('Next step', marginX, y, bold, black, 12);
  y = drawText('Reply to this email or WhatsApp +66 98 860 6410. We normally respond within one business day.', marginX, y, font, black, 10, true);

  y -= 14;
  page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: rgb(220/255, 220/255, 220/255) });
  y -= 16;
  y = drawText('This overview is indicative and intended to start a conversation, not to constitute a binding quote.', marginX, y, font, muted, 9);
  y = drawText('Pricing, availability, and pathways depend on final unit selection, contract date, and verification.', marginX, y, font, muted, 9);

  // Footer
  page.drawRectangle({ x: marginX, y: 0, width: width - marginX * 2, height: 52, color: black });
  if (logoImage) {
    const smallW = 76;
    const smallH = smallW * (76 / 557);
    page.drawImage(logoImage, { x: marginX, y: (52 - smallH) / 2, width: smallW, height: smallH });
  }
  page.drawText('info@agenticphuket.com · +66 98 860 6410', {
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
      budget_range, timeline, message,
      intent, spending_style
    } = parsed;

    if (!email) {
      return jsonResponse({ error: 'Email is required' }, 400);
    }

    const ref = 'AGT-' + new Date().getFullYear() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

    const pdf = await generateQuotePdf(ref, {
      name: name || 'Valued Client',
      email: email || '',
      phone: phone || '',
      country: country || '',
      budget_range: budget_range || '',
      timeline, message,
      intent, spending_style
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
          subject: `Your Agentic Advisory Overview (${ref})`,
          html: emailTemplate(ref, {
            name: name || 'Valued Client',
            budget_range, timeline,
            intent, spending_style
          }),
          attachments: [
            {
              filename: `Agentic-Advisory-${ref}.pdf`,
              content: pdfBuffer
            }
          ]
        });
      } catch (e) {
        console.error('Resend error', e);
      }
    }

    return pdfResponse(pdfBase64, `Agentic-Advisory-${ref}.pdf`, ref);

  } catch (err) {
    console.error('Quote generation error:', err);
    return jsonResponse({ error: err.message || 'Quote generation failed' }, 500);
  }
};
