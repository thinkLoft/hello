const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');
const { nullCheck } = require('../services/validator');

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

// Discovery: sitemap-advert.xml lists all ads with lastmod dates — filter to last 24 h for new listings.
// Detail pages are Cloudflare-protected (same as JCO); needs Puppeteer before this can run.
async function scrape() {
  try {
    const response = await axios.get('https://www.jacars.net/sitemap-advert.xml');
    const $ = cheerio.load(response.data, { xmlMode: true });
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const links = [];
    $('url').each((i, el) => {
      const loc = $(el).children('loc').text();
      const lastmod = $(el).children('lastmod').text();
      if (loc.includes('/adv/') && lastmod >= cutoff) links.push(loc);
    });
    for (const url of links) {
      const exists = await db.Cars.exists({ url });
      if (!exists) await scrapeDetail(url);
    }
  } catch (err) {
    console.error('JaCars scrape error:', err.message);
  }
}

async function scrapeDetail(srcURL) {
  try {
    const response = await axios.get(srcURL);
    const $ = cheerio.load(response.data);
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
    $('.announcement-content-container').children('img').each((i, el) => {
      const src = $(el).attr('src')?.trim();
      if (src) imgs.push(src);
    });

    await nullCheck({
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
  }
}

module.exports = { scrape };
