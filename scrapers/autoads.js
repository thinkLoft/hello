const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');
const { nullCheck } = require('../services/validator');

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

async function checker(siteUrl) {
  const stats = { source: 'autoadsja', scraped: 0, saved: 0, skipped: 0, failed: 0, startedAt: new Date() };
  try {
    const response = await axios.get(siteUrl, { headers: HEADERS });
    const $ = cheerio.load(response.data, { xmlMode: true });
    const urls = [];
    $('item').each((i, el) => urls.push($(el).children('link').text()));
    for (const url of urls) {
      const exists = await db.Cars.exists({ url });
      if (exists) {
        stats.skipped++;
      } else {
        stats.scraped++;
        const saved = await scrape(url);
        if (saved) stats.saved++;
        else stats.failed++;
      }
    }
  } catch (err) {
    console.error('AutoAds checker error:', err.message);
    stats.failed++;
  }
  return stats;
}

async function scrape(link) {
  try {
    const response = await axios.get(link, { headers: HEADERS });
    const $ = cheerio.load(response.data);

    // Title is the first text node in h1.mb-3; price is in the <b> inside the same h1
    const h1 = $('h1.mb-3').first();
    const titleText = h1.contents().filter((_, n) => n.type === 'text').first().text().trim();
    const ymm = titleText.split(/\s+/);
    const price = h1.find('b').first().text().replace(/[^0-9]/g, '');

    // Specs: each .list-group-item has a .fw-bold label and .me-auto value
    const specs = {};
    $('.list-group-item').each((_, el) => {
      const label = $(el).find('.fw-bold').text().trim().replace(/:$/, '').trim();
      const value = $(el).find('.me-auto').text().trim();
      if (label && value) specs[label] = value;
    });

    // Images
    const imgs = [];
    $('.gallery__thumbs > a').each((_, el) => imgs.push($(el).attr('href')));

    // Contact: href="tel:18761234567"
    const contactNumber = $('.contact_details a[href^="tel:"]').attr('href')?.replace(/[^0-9]/g, '') ?? null;

    return await nullCheck({
      user: 'autoadsja',
      url: response.config.url,
      price,
      year: ymm[0],
      make: ymm[1],
      model: ymm.slice(2).join(' ') || null,
      parish: specs['Location'] ?? null,
      bodyType: specs['Body Type'] ?? null,
      driverSide: specs['Driver Side'] ?? null,
      transmission: specs['Transmission'] ?? null,
      mileage: specs['Mileage'] ?? null,
      contactNumber,
      imgs,
    });
  } catch (err) {
    console.error('AutoAds scraper error:', err.message);
    return false;
  }
}

module.exports = { checker };
