#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_URL = 'https://snatched-api.vercel.app/api/reviews';
const REVIEWS_DIR = path.join(__dirname, '..', 'reviews');
const CHROME_STORE =
  'https://chromewebstore.google.com/detail/snatched/hcdlgnlefjhejhlpgmmgmehknekphamm';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'product';
}

function parseList(val) {
  if (val == null || val === '') return [];

  let items = val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[')) {
      try {
        items = JSON.parse(trimmed);
      } catch {
        items = trimmed
          .replace(/^\[|\]$/g, '')
          .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
          .map(cleanListItem);
      }
    } else {
      items = trimmed.split(/[,;]\s*/).map(cleanListItem);
    }
  }

  if (!Array.isArray(items)) return [];
  return items.map(cleanListItem).filter(Boolean);
}

function cleanListItem(item) {
  return String(item)
    .trim()
    .replace(/^\[+|\]+$/g, '')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

function verdictClass(verdict) {
  const v = String(verdict || '').toLowerCase();
  if (v === 'buy') return 'verdict-buy';
  if (v === 'skip') return 'verdict-skip';
  return 'verdict-maybe';
}

function formatStatLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function renderListItems(items, emptyText) {
  if (!items.length) {
    return `<li>${escapeHtml(emptyText)}</li>`;
  }
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n          ');
}

function renderStats(stats) {
  if (!stats || typeof stats !== 'object') return '';
  return Object.entries(stats)
    .filter(([, value]) => value != null && value !== '')
    .map(
      ([key, value]) =>
        `<span class="pill"><span>${escapeHtml(formatStatLabel(key))}</span> · ${escapeHtml(String(value))}</span>`
    )
    .join('\n        ');
}

function renderCleanBeauty(clean) {
  if (!clean || typeof clean !== 'object') return '';

  const labels = {
    fragranceFree: 'Fragrance-free',
    parabenFree: 'Paraben-free',
    vegan: 'Vegan',
    crueltyFree: 'Cruelty-free',
    fragrance_free: 'Fragrance-free',
    paraben_free: 'Paraben-free',
    cruelty_free: 'Cruelty-free',
  };

  return Object.entries(clean)
    .map(([key, val]) => {
      const label = labels[key] || formatStatLabel(key);
      const pass =
        val === true ||
        String(val).toLowerCase() === 'yes' ||
        String(val).toLowerCase() === 'pass';
      return `<span class="clean-badge${pass ? '' : ' no'}">${escapeHtml(label)}${pass ? ' ✓' : ' ✗'}</span>`;
    })
    .join('\n        ');
}

function renderComparable(comparable) {
  if (!comparable) {
    return '<p>No comparable pick available.</p>';
  }
  if (typeof comparable === 'string') {
    return `<strong>${escapeHtml(comparable)}</strong>`;
  }
  const name =
    comparable.name ||
    comparable.productName ||
    comparable.product_name ||
    'Comparable product';
  const reason = comparable.reason || comparable.summary || comparable.description || '';
  const url = comparable.url || comparable.link || comparable.href || '';
  let html = `<strong>${escapeHtml(name)}</strong>`;
  if (reason) html += `<p>${escapeHtml(reason)}</p>`;
  if (url) {
    html += `<a href="${escapeHtml(url)}" target="_blank">View on retailer ↗</a>`;
  }
  return html;
}

function displayProductName(name) {
  if (!name) return name;
  if (name.length <= 60) return name;
  const pipeIndex = name.indexOf('|');
  if (pipeIndex > 0 && pipeIndex <= 60) {
    return name.slice(0, pipeIndex).trim();
  }
  return name.slice(0, 57).trim().replace(/[\s\-|]+$/, '') + '...';
}

function buildPage(review) {
  const productName = review.product_name || review.productName || 'Product';
  const headingName = displayProductName(productName);
  const retailer = review.retailer || 'Retailer';
  const verdict = review.verdict || 'Maybe';
  const summary = review.summary || '';
  const pros = parseList(review.pros);
  const cons = parseList(review.cons);
  const statsHtml = renderStats(review.stats);
  const cleanHtml = renderCleanBeauty(review.clean_beauty || review.cleanBeauty);
  const comparableHtml = renderComparable(review.comparable_pick || review.comparablePick);

  const title = `${productName} — AI Says ${verdict} | Snatched`;
  const description = summary || `AI-verified ${verdict} verdict for ${productName}.`;

  const statsSection = statsHtml
    ? `<div class="section-label">Review Stats</div>
      <div class="pill-row">
        ${statsHtml}
      </div>`
    : '';

  const cleanSection = cleanHtml
    ? `<div class="section-label">Clean Beauty Check</div>
      <div class="clean-row">
        ${cleanHtml}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZCMRLHPNF1"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-ZCMRLHPNF1');
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --pink: #FF4D8D;
      --pink-dim: rgba(255,77,141,0.15);
      --bg: #0d0d0d;
      --surface: #1a1a1a;
      --text: #f0f0f0;
      --muted: #888;
      --border: rgba(255,255,255,0.08);
      --buy: #22c55e;
      --maybe: #eab308;
      --skip: #ef4444;
    }
    body {
      font-family: 'Space Grotesk', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    nav {
      position: sticky;
      top: 0;
      background: rgba(13,13,13,0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 0 24px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
    }
    .nav-logo { font-weight: 700; font-size: 18px; color: var(--pink); text-decoration: none; }
    .nav-links { display: flex; align-items: center; gap: 24px; }
    .nav-links a { font-size: 14px; font-weight: 500; color: #aaa; text-decoration: none; transition: color 0.2s; }
    .nav-links a:hover { color: var(--pink); }
    .nav-cta {
      background: var(--pink);
      color: #fff !important;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px !important;
    }
    .content { max-width: 720px; margin: 0 auto; padding: 40px 24px 64px; }
    .back-link {
      display: inline-block;
      font-size: 13px;
      color: var(--muted);
      text-decoration: none;
      margin-bottom: 24px;
      transition: color 0.2s;
    }
    .back-link:hover { color: var(--pink); }
    .header { margin-bottom: 28px; }
    .header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
    .product-name { font-size: 33.6px; font-weight: 700; line-height: 1.2; color: #FF4D8D; }
    .retailer-badge {
      font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
      text-transform: uppercase; padding: 4px 10px; border-radius: 4px;
      background: rgba(255,255,255,0.08); color: #aaa;
      white-space: nowrap; flex-shrink: 0; margin-top: 6px;
    }
    .verdict {
      display: inline-block;
      font-size: 14px; font-weight: 700; letter-spacing: 0.06em;
      text-transform: uppercase; padding: 6px 16px; border-radius: 100px;
    }
    .verdict-buy { background: rgba(34,197,94,0.15); color: var(--buy); }
    .verdict-maybe { background: rgba(234,179,8,0.15); color: var(--maybe); }
    .verdict-skip { background: rgba(239,68,68,0.15); color: var(--skip); }
    .summary {
      font-size: 16px;
      line-height: 1.7;
      color: #ccc;
      margin-bottom: 32px;
      padding-bottom: 32px;
      border-bottom: 1px solid var(--border);
    }
    .section-label {
      font-size: 11px; font-weight: 600; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--pink);
      margin-bottom: 12px;
    }
    .pros-cons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 32px;
    }
    .pros-cons-col {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
    }
    .pros-cons-col h3 { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #fff; }
    .pros-cons-col ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .pros-cons-col li { font-size: 14px; color: #bbb; line-height: 1.5; padding-left: 16px; position: relative; }
    .pros-cons-col li::before { content: '·'; position: absolute; left: 0; color: var(--pink); font-weight: 700; }
    .pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 32px; }
    .pill {
      font-size: 12px; font-weight: 600;
      padding: 6px 14px; border-radius: 100px;
      background: var(--surface);
      border: 1px solid var(--border);
      color: #ccc;
    }
    .pill span { color: var(--pink); }
    .clean-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 32px; }
    .clean-badge {
      font-size: 12px; font-weight: 600;
      padding: 6px 14px; border-radius: 100px;
      background: var(--pink-dim);
      color: var(--pink);
      border: 1px solid rgba(255,77,141,0.25);
    }
    .clean-badge.no { background: rgba(255,255,255,0.05); color: var(--muted); border-color: var(--border); }
    .comparable {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 32px;
      font-size: 14px;
      color: #bbb;
      line-height: 1.5;
    }
    .comparable strong { color: #fff; font-size: 15px; }
    .comparable p { margin-top: 6px; }
    .cta-wrap { text-align: center; padding-top: 8px; }
    .cta-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--pink); color: #fff;
      padding: 16px 32px; border-radius: 100px;
      font-size: 16px; font-weight: 600;
      text-decoration: none; transition: opacity 0.2s;
    }
    .cta-btn:hover { opacity: 0.9; }
    @media (max-width: 600px) {
      .pros-cons { grid-template-columns: 1fr; }
      .product-name { font-size: 26.4px; }
      .nav-links a:not(.nav-cta) { display: none; }
    }
  </style>
</head>
<body>

  <nav>
    <a href="/" class="nav-logo">Snatched</a>
    <div class="nav-links">
      <a href="/">Home</a>
      <a href="/picks/">Picks</a>
      <a href="/reviews/">Reviews</a>
      <a href="${CHROME_STORE}" target="_blank" class="nav-cta">Get Extension →</a>
    </div>
  </nav>

  <div class="content">
    <a href="/reviews/" class="back-link">← All reviews</a>
    <div class="header">
      <div class="header-top">
        <h1 class="product-name">${escapeHtml(headingName)}</h1>
        <span class="retailer-badge">${escapeHtml(retailer)}</span>
      </div>
      <span class="verdict ${verdictClass(verdict)}">${escapeHtml(verdict)}</span>
    </div>
    ${summary ? `<p class="summary">${escapeHtml(summary)}</p>` : ''}

    <div class="section-label">Pros & Cons</div>
    <div class="pros-cons">
      <div class="pros-cons-col">
        <h3>Pros</h3>
        <ul>
          ${renderListItems(pros, 'No pros listed.')}
        </ul>
      </div>
      <div class="pros-cons-col">
        <h3>Cons</h3>
        <ul>
          ${renderListItems(cons, 'No cons listed.')}
        </ul>
      </div>
    </div>

    ${statsSection}

    ${cleanSection}

    <div class="section-label">Comparable Pick</div>
    <div class="comparable">
      ${comparableHtml}
    </div>

    <div class="cta-wrap">
      <a href="${CHROME_STORE}" target="_blank" class="cta-btn">Analyze any product free →</a>
    </div>
  </div>

</body>
</html>
`;
}

async function main() {
  const res = await fetch(API_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch reviews: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const reviews = Array.isArray(data) ? data : data.reviews || [];

  if (!reviews.length) {
    console.log('No reviews found — 0 pages created.');
    return;
  }

  const usedSlugs = new Set();
  let created = 0;

  for (const review of reviews) {
    const productName = review.product_name || review.productName;
    if (!productName) continue;

    let slug = slugify(productName);
    if (usedSlugs.has(slug)) {
      let i = 2;
      while (usedSlugs.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }
    usedSlugs.add(slug);

    const dir = path.join(REVIEWS_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), buildPage(review), 'utf8');
    created++;
  }

  console.log(`Created ${created} review page${created === 1 ? '' : 's'}.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
