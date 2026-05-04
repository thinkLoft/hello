const cheerio = require('cheerio');
const db = require('../models');
const { nullCheck } = require('../services/validator');
const { cacheImages } = require('../services/imageCache');
const { fetchPage } = require('./browser');

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
  const stats = {
    source: 'jamaicaonlineclassifieds',
    scraped: 0, saved: 0, skipped: 0, failed: 0,
    rejected: 0, rejectionReasons: {}, failedUrls: [],
    startedAt: new Date(),
  };
  const seenUrls = [];
  try {
    const html = await fetchPage(pageUrl, { waitSelector: '.jco-card', timeout: 45000 });
    const $ = cheerio.load(html);
    $('.jco-card > a').each((i, el) => {
      const href = $(el).attr('href');
      if (href?.startsWith('https://jamaicaclassifiedonline.com/auto/cars')) {
        seenUrls.push(href);
      }
    });
    for (const url of seenUrls) {
      const exists = await db.Cars.exists({ url });
      if (exists) {
        stats.skipped++;
      } else {
        stats.scraped++;
        const result = await scrapeDetail(url);
        if (result?.failed) {
          stats.failed++;
          stats.failedUrls.push({ url, reason: result.reason });
        } else if (result?.saved) {
          stats.saved++;
          if (!result.posted) stats.rejected++;
          for (const c of result.codes || []) {
            stats.rejectionReasons[c] = (stats.rejectionReasons[c] || 0) + 1;
          }
        } else {
          stats.failed++;
        }
      }
    }
    if (seenUrls.length > 0) {
      await db.Cars.updateMany(
        { url: { $in: seenUrls } },
        { $set: { lastSeenAt: new Date() } }
      ).catch(() => {});
    }
  } catch (err) {
    console.error('JCO scrape error:', err.message);
    stats.failed++;
  }
  return stats;
}

async function scrapeDetail(srcURL) {
  let html;
  try {
    html = await fetchPage(srcURL, { waitSelector: 'li.collection-item', timeout: 30000 });
  } catch (err) {
    console.warn(`[jco] retrying ${srcURL} after: ${err.message}`);
    await new Promise(r => setTimeout(r, 3000));
    try {
      html = await fetchPage(srcURL, { waitSelector: 'li.collection-item', timeout: 30000 });
    } catch (err2) {
      console.error('JCO detail error:', err2.message, srcURL);
      return { failed: true, reason: err2.message };
    }
  }
  try {
    const $ = cheerio.load(html);
    const attr = {};

    $('li.collection-item').each((i, el) => {
      const divText = $(el).children('div').text().trim();
      const colonIdx = divText.indexOf(':');
      if (colonIdx === -1) return;
      const subtitle = divText.slice(0, colonIdx).trim();
      const val = $(el).children('div').children('a').text().trim() || divText.slice(colonIdx + 1).trim();
      if (ATTR_MAP[subtitle] && val) attr[ATTR_MAP[subtitle]] = val;
    });

    if (!attr.year) return { failed: true, reason: 'no_year_in_parsed_html' };

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

    const rawImgs = [];
    $('a.item-images').each((i, el) => rawImgs.push($(el).attr('href')));
    const imgs = await cacheImages(rawImgs);

    return await nullCheck({ user: 'jamaicaonlineclassifieds', url: srcURL, imgs, ...attr });
  } catch (err) {
    console.error('JCO detail error:', err.message);
    return { failed: true, reason: err.message };
  }
}

module.exports = { scrape, scrapeDetail };
