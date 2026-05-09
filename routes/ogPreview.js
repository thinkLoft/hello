const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../models/cars');

const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://autos876-dc045b5182e0.herokuapp.com'
  : 'http://localhost:3000';

const frontendDist = path.join(__dirname, '../client/dist');

function formatPrice(price) {
  if (!price || price === 0) return 'Call for Pricing';
  return new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 0 }).format(price);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

router.get('/cars/:slug', async (req, res, next) => {
  try {
    const car = await db.Cars.findOne({ slug: req.params.slug, hidden: { $ne: true } }).lean();
    if (!car) return next();

    const title = escapeHtml(`${car.year} ${car.make} ${car.model} — Beego`);
    const desc = escapeHtml(
      [formatPrice(car.price), car.parish, car.transmission].filter(Boolean).join(' · ')
    );
    const image = escapeHtml(car.imgs?.[0] ?? '');
    const url = escapeHtml(`${BASE_URL}/cars/${car.slug}`);

    const ogTags = [
      `<title>${title}</title>`,
      `<meta property="og:title" content="${title}">`,
      `<meta property="og:description" content="${desc}">`,
      image ? `<meta property="og:image" content="${image}">` : '',
      `<meta property="og:url" content="${url}">`,
      `<meta property="og:type" content="website">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${title}">`,
      `<meta name="twitter:description" content="${desc}">`,
      image ? `<meta name="twitter:image" content="${image}">` : '',
    ].filter(Boolean).join('\n    ');

    // Inject OG tags into the built index.html so the React app still loads
    // for browsers while crawlers get the correct meta tags in static HTML.
    const indexHtml = fs.readFileSync(path.join(frontendDist, 'index.html'), 'utf8');
    const html = indexHtml
      .replace(/<title>[^<]*<\/title>/, '')
      .replace('</head>', `    ${ogTags}\n  </head>`);

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
