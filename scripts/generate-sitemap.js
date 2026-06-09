#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_URL = 'https://snatched-api.vercel.app/api/reviews';
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');
const BASE_URL = 'https://get-snatched.com';

const STATIC_PAGES = [
  '/',
  '/picks/',
  '/picks/off-campus/',
  '/picks/loveisland/',
  '/picks/celebrity/',
  '/reviews/',
];

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'product';
}

function buildUrlEntry(loc, changefreq, priority) {
  return `  <url>
    <loc>${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function buildSitemap(urlEntries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>
`;
}

async function main() {
  const res = await fetch(API_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch reviews: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const reviews = Array.isArray(data) ? data : data.reviews || [];

  const urlEntries = STATIC_PAGES.map((page) =>
    buildUrlEntry(`${BASE_URL}${page}`, 'weekly', '0.8')
  );

  const usedSlugs = new Set();

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

    urlEntries.push(
      buildUrlEntry(`${BASE_URL}/reviews/${slug}/`, 'monthly', '0.6')
    );
  }

  fs.writeFileSync(SITEMAP_PATH, buildSitemap(urlEntries), 'utf8');
  console.log(`Added ${urlEntries.length} URLs to sitemap.xml`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
