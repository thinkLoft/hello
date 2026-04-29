const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');
const { nullCheck } = require('../services/validator');
const { fetchPage } = require('./browser');

const ATTR_MAP = {
  Year: 'year',
  'Body type': 'bodyType',
  'Fuel type': 'fuelType',
  Gearbox: 'transmission',
  Colour: 'colour',
  'Right hand drive': 'driverSide',
  'Engine size': 'engineSize',
  Seats: 'seats',
  Mileage: 'mileage',
};

// Sitemap discovery works via axios; detail pages need Puppeteer (Cloudflare-protected).
async function scrape() {
  const stats = { source: 'jacars', scraped: 0, saved: 0, skipped: 0, failed: 0, startedAt: new Date() };
  const seenUrls = [];
  try {
    const response = await axios.get('https://www.jacars.net/sitemap-advert.xml', { timeout: 15000 });
    const $ = cheerio.load(response.data, { xmlMode: true });
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    $('url').each((i, el) => {
      const loc = $(el).children('loc').text();
      const lastmod = $(el).children('lastmod').text();
      if (loc.includes('/adv/') && lastmod >= cutoff) seenUrls.push(loc);
    });
    for (const url of seenUrls) {
      const exists = await db.Cars.exists({ url });
      if (exists) {
        stats.skipped++;
      } else {
        stats.scraped++;
        const saved = await scrapeDetail(url);
        if (saved) stats.saved++;
        else stats.failed++;
      }
    }
    if (seenUrls.length > 0) {
      await db.Cars.updateMany(
        { url: { $in: seenUrls } },
        { $set: { lastSeenAt: new Date() } }
      ).catch(() => {});
    }
  } catch (err) {
    console.error('JaCars scrape error:', err.message);
    stats.failed++;
  }
  return stats;
}

async function scrapeDetail(srcURL) {
  try {
    const html = await fetchPage(srcURL, { waitSelector: '#ad-title' });
    const $ = cheerio.load(html);
    const titleParts = $('#ad-title').text().trim().split(' ');
    let price = Math.round(
      Number($("meta[itemprop='price']").attr('content')?.replace(/[^0-9.-]+/g, '') || 0)
    );
    if (price < 10000 && price > 100) price *= 1000;

    const attr = { make: titleParts[0], model: titleParts[1] };
    $('.chars-column > li').each((i, el) => {
      const subtitle = $(el).children('span').text();
      const val = $(el).children('a').text();
      if (ATTR_MAP[subtitle]) attr[ATTR_MAP[subtitle]] = val;
    });

    const imgs = [];
    $('img.announcement__images-item').each((i, el) => {
      const src = $(el).attr('src')?.trim();
      if (src && !imgs.includes(src)) imgs.push(src);
    });

    return await nullCheck({
      user: 'jacars',
      url: srcURL,
      price,
      year: attr.year,
      make: attr.make,
      model: attr.model,
      parish: $('.announcement__location').children('span').text(),
      description: $('.announcement-description').text().trim(),
      bodyType: attr.bodyType,
      transmission: attr.transmission,
      driverSide: attr.driverSide,
      mileage: attr.mileage,
      imgs,
    });
  } catch (err) {
    console.error('JaCars detail error:', err.message);
    return false;
  }
}

module.exports = { scrape, scrapeDetail };
