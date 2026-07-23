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
function locationLabel(v) {
  return v || 'Any';
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

function matchedProjects(budget, preferred_location) {
  const lower = budgetMin(budget);
  const upper = budgetMax(budget);
  const projects = inventory.projects || [];
  let matches = projects.filter(p => p.priceFrom <= upper && p.priceTo >= lower);
  if (preferred_location) {
    matches = matches.filter(p => p.location === preferred_location);
  }
  matches.sort((a, b) => a.priceFrom - b.priceFrom);
  return matches.slice(0, 2);
}

function investorScenario(budget) {
  return (inventory.investorScenarios && inventory.investorScenarios[budget]) || 'Share your budget band and we’ll map exact project combinations.';
}

function emailTemplate(ref, data) {
  const projects = matchedProjects(data.budget_range, data.preferred_location);
  const scenarioText = (data.intent === 'buy-to-invest' || data.intent === 'partner-investor')
    ? investorScenario(data.budget_range)
    : null;

  const projectsHtml = projects.map(p => `
    <div style="background:#0f1419; border:1px solid #2a3344; border-radius:12px; padding:16px; margin-bottom:12px;">
      <p style="margin:0 0 6px; font-weight:700; color:#e6e7ea; font-size:15px;">${p.name} · ${p.location}</p>
      <p style="margin:0 0 6px; color:#b0b8c4; font-size:13px;">${p.beds} bed · ${p.type} · ${p.note}</p>
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
        <p style="margin:0 0 8px; color:#b0b8c4;">Preferred location</p>
        <p style="margin:0 0 16px;">${locationLabel(data.preferred_location)}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">Primary intent</p>
        <p style="margin:0 0 16px;">${intentLabel(data.intent) || '—'}</p>
        <p style="margin:0 0 8px; color:#b0b8c4;">Readiness</p>
        <p style="margin:0;">${spendingStyleLabel(data.spending_style) || '—'}</p>
        ${data.message ? `
        <p style="margin:14px 0 0; color:#b0b8c4;">Notes</p>
        <p style="margin:4px 0 0; color:#e6e7ea; line-height:1.5;">${data.message.length > 400 ? data.message.slice(0, 400) + '…' : data.message}</p>` : ''}
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

  const halfWidth = (width - marginX * 2) / 2;
  const rightXCol = marginX + halfWidth + 12;
  const baseY = y;
  let leftY = drawText('Prepared for', marginX, y, bold, black, 12);
  let rightY = drawText('Your profile', rightXCol, y, bold, black, 12);
  leftY -= 2;
  rightY -= 2;
  leftY = drawText(`${data.name || 'Valued Client'}`, marginX, leftY, font, black, 11);
  if (data.email) leftY = drawText(data.email, marginX, leftY, font, muted, 10);
  if (data.phone) leftY = drawText(data.phone, marginX, leftY, font, muted, 10);
  if (data.country) leftY = drawText(data.country, marginX, leftY, font, muted, 10);
  const labelSize = 10;
  const valueOffset = 100;
  const drawRow = (lbl, val, py) => {
    drawText(lbl, rightXCol, py, bold, muted, labelSize);
    drawText(val, rightXCol + valueOffset, py, font, black, labelSize, true);
    return py - labelSize * 1.3;
  };
  rightY = drawRow('Budget range:', budgetLabel(data.budget_range), rightY);
  rightY = drawRow('Preferred location:', locationLabel(data.preferred_location), rightY);
  rightY = drawRow('Primary intent:', intentLabel(data.intent), rightY);
  rightY = drawRow('Readiness:', spendingStyleLabel(data.spending_style), rightY);
  if (data.message) {
    const note = data.message.length > 180 ? data.message.slice(0, 180) + '…' : data.message;
    rightY = drawRow('Notes:', note, rightY);
  }
  y = Math.max(leftY, rightY) - 6;

  page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: rgb(230/255, 230/255, 230/255) });
  y -= 18;

  const intent = data.intent || 'exploring';
  const style = data.spending_style || 'researching';
  const budget = data.budget_range || '';
  const projects = matchedProjects(budget, data.preferred_location);

  // Your options
  if ((intent === 'buy-to-live' || intent === 'buy-to-invest' || intent === 'partner-investor') && projects.length) {
      y -= 14;
      page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: gold });
      y -= 18;
      y = drawText('Your options', marginX, y, bold, black, 12);

      const tableX = marginX + 4;
      const rowW = width - marginX * 2 - 8;
      const colW = [rowW * 0.24, rowW * 0.16, rowW * 0.10, rowW * 0.18, rowW * 0.32];
      let cx = tableX;
      const colXs = [];
      for (const w of colW) { colXs.push(cx); cx += w; }
      const headerH = 20;

      page.drawText('Developer', { x: colXs[0] + 2, y: y - 13, size: 9, font: bold, color: black });
      page.drawText('District', { x: colXs[1] + 2, y: y - 13, size: 9, font: bold, color: black });
      page.drawText('Size', { x: colXs[2] + 2, y: y - 13, size: 9, font: bold, color: black });
      page.drawText('Price', { x: colXs[3] + 2, y: y - 13, size: 9, font: bold, color: black });
      page.drawText('Agentic comment', { x: colXs[4] + 2, y: y - 13, size: 9, font: bold, color: black });
      y -= headerH;
      page.drawRectangle({ x: tableX, y: y, width: rowW, height: 1.2, color: rgb(200/255, 200/255, 200/255) });

      for (const p of projects) {
        const isInvestor = intent === 'partner-investor';
      const hook = isInvestor ? p.investorHook : p.buyerHook;
      const comment = (hook && hook[budget]) || (hook && hook['default']) || p.note;
        const rows = [
          { text: p.name, bold: true },
          { text: p.location, bold: false },
          { text: p.beds + ' bed', bold: false },
          { text: p.unitTypes[0].text, bold: false },
        ];
        for (let i = 0; i < rows.length; i++) {
          page.drawText(rows[i].text, { x: colXs[i] + 2, y: y - 12, size: 8, font: rows[i].bold ? bold : font, color: black });
        }
        const wrapped = wrapText(comment, font, 8, colW[4] - 6);
        for (let li = 0; li < wrapped.length; li++) {
          page.drawText(wrapped[li], { x: colXs[4] + 2, y: y - 12 - li * 10, size: 8, font, color: black });
        }
        const rowH = Math.max(22, wrapped.length * 10 + 6);
        y -= rowH;
        page.drawRectangle({ x: tableX, y: y, width: rowW, height: 1.2, color: rgb(220/255, 220/255, 220/255) });
      }
      y -= 6;
  }

  // What we can help with
  y -= 10;
  page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: rgb(220/255, 220/255, 220/255) });
  y -= 18;
  if (intent === 'buy-to-live' || intent === 'buy-to-invest') {
    y = drawText('How we help beyond the purchase', marginX, y, bold, black, 12);
    y -= 4;
    const helpItems = [
      'Cross-border capital – we guide legal money transfers into Thailand for your purchase.',
      'Ownership structures – freehold, leasehold, and Thai-company setups explained simply.',
      'Other options – we can design and build your dream villa, or renovate a resale, all fixed-price.'
    ];
    for (const item of helpItems) {
      y = drawBullet(item, marginX, y, font, black, 10);
      y -= 2;
    }
  } else if (intent === 'partner-investor') {
    y = drawText('What we can build together', marginX, y, bold, black, 12);
    y -= 4;
    const investorItems = [
      'Become a developer – feasibility, design, permits, fixed-price delivery. You own the asset.',
      'Off-plan, your finishings – buy off-plan, customize kitchen, bathroom, flooring with our in-house team.',
      'Buy, renovate, sell/rent/live – buy resale at a discount, renovate for uplift, then exit or occupy.',
      'Build your business – from concept and permits to delivery and first guests. Hospitality, retail, serviced brand.'
    ];
    for (const item of investorItems) {
      y = drawBullet(item, marginX, y, font, black, 10);
      y -= 2;
    }
  } else {
    y = drawText('How we can help', marginX, y, bold, black, 12);
    y -= 4;
    y = drawBullet('From shortlisting to handover – tell us more and we will map the right pathway.', marginX, y, font, black, 10);
  }

  if (data.message) {
    y -= 8;
    const note = data.message.length > 140 ? data.message.slice(0, 140) + '…' : data.message;
    y = drawText(`You mentioned: ${note}`, marginX, y, font, black, 10, true);
    y = drawText("We'll build this into your shortlist and next conversation.", marginX, y - 2, font, muted, 9, true);
    y -= 6;
  }


  // For partner-investor: show budget scenario first
  if (intent === 'partner-investor') {
    const scenarioText = investorScenario(budget);
    if (scenarioText) {
      y -= 6;
      page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: gold });
      y -= 18;
      y = drawText('What your budget can buy', marginX, y, bold, black, 12);
      y = drawText(scenarioText, marginX, y, font, black, 10, true);
    }
  }

  // For buy-to-invest: budget scenario after services
  if (intent === 'buy-to-invest') {
    const scenarioText = investorScenario(budget);
    if (scenarioText) {
      y -= 6;
      page.drawRectangle({ x: marginX, y: y, width: width - marginX * 2, height: 1.2, color: gold });
      y -= 18;
      y = drawText('What your budget can buy', marginX, y, bold, black, 12);
      y = drawText(scenarioText, marginX, y, font, black, 10, true);
    }
  }

  y -= 8;
  y = drawText('Agentic clients closed THB 380M+ in Phuket transactions since 2024.', marginX, y, font, muted, 9);
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
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
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
      budget_range, preferred_location, message,
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
      preferred_location: preferred_location || '',
      message,
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
            budget_range, preferred_location,
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
