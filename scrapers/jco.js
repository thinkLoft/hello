const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');
const { nullCheck } = require('../services/validator');

const ATTR_MAP = {
  Year: 'year',
  Make: 'make',
  Model: 'model',
  'Body Type': 'bodyType',
  Transmission: 'transmission',
  'Driver Side': 'driverSide',
  Mileage: 'mileage',
};

async function scrape(pageUrl) {
  const stats = { source: 'jamaicaonlineclassifieds', scraped: 0, saved: 0, skipped: 0, failed: 0, startedAt: new Date() };
  try {
    const response = await axios.get(pageUrl);
    const $ = cheerio.load(response.data);
    const links = [];
    $('.jco-card > a').each((i, el) => {
      const href = $(el).attr('href');
      if (href?.startsWith('https://jamaicaclassifiedonline.com/auto/cars')) {
        links.push(href);
      }
    });
    for (const url of links) {
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
  } catch (err) {
    console.error('JCO scrape error:', err.message);
    stats.failed++;
  }
  return stats;
}

async function scrapeDetail(srcURL) {
  try {
    const response = await axios.get(srcURL);
    const $ = cheerio.load(response.data);
    const attr = {};

    $('li.collection-item').each((i, el) => {
      const divText = $(el).children('div').text().trim();
      const colonIdx = divText.indexOf(':');
      if (colonIdx === -1) return;
      const subtitle = divText.slice(0, colonIdx).trim();
      // Linked values (Year, Make, etc.) are in <a>; plain text fields (Mileage) fall back to text after colon
      const val = $(el).children('div').children('a').text().trim() || divText.slice(colonIdx + 1).trim();
      if (ATTR_MAP[subtitle] && val) attr[ATTR_MAP[subtitle]] = val;
    });

    if (!attr.year) return;

    $('div.col.s12.l3.m6.flow-text').each((i, el) => {
      const link = $(el).children('a').attr('href');
      if (link?.startsWith('tel:')) attr.contactNumber = link.replace('tel:', '').trim();

      const text = $(el).last().contents().text().trim();
      if (text.replace(/(\W)*\$/g, '$').startsWith('$')) {
        attr.price = text.replace(/[^0-9.-]+/g, '');
      }
      if (text.replace(/(\W)*/g, '').trim().startsWith('map')) {
        attr.parish = text.replace(/(\W)*map/g, '').trim();
      }
    });

    attr.description = $('div.wysiwyg').text().trim();
    $('span.card-title').each((i, el) => {
      if ($(el).text().startsWith('FEATURES')) {
        attr.description += '\n\n' + $(el).next().text().trim();
      }
    });

    const imgs = [];
    $('a.item-images').each((i, el) => imgs.push($(el).attr('href')));

    return await nullCheck({ user: 'jamaicaonlineclassifieds', url: srcURL, imgs, ...attr });
  } catch (err) {
    console.error('JCO detail error:', err.message);
    return false;
  }
}

module.exports = { scrape };
