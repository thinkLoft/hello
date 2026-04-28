const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');
const { nullCheck } = require('../services/validator');

async function scrape(pageUrl) {
  try {
    const response = await axios.get(pageUrl);
    const $ = cheerio.load(response.data);
    const links = [];
    $('a.inventory[href*="/listings/"]').each((i, el) => {
      links.push($(el).attr('href'));
    });
    for (const url of links) {
      const exists = await db.Cars.exists({ url });
      if (!exists) await scrapeDetail(url);
    }
  } catch (err) {
    console.error('KMS scrape error:', err.message);
  }
}

async function scrapeDetail(srcURL) {
  try {
    const response = await axios.get(srcURL);
    const $ = cheerio.load(response.data);
    const titleParts = $('h2[itemprop="name"]').text().trim().replace(/\s*\([^)]+\)\s*$/, '').split(' ');

    const imgs = [];
    $('ul.slides > li > img').each((i, el) => {
      const src = $(el).attr('src')?.trim();
      if (src) imgs.push(src);
    });

    await nullCheck({
      user: 'kms',
      url: srcURL,
      price: $('span[itemprop="price"]').text().replace(/[^0-9.-]+/g, '').trim(),
      year: titleParts[0],
      make: titleParts[1],
      model: titleParts.slice(2).join(' '),
      parish: $('.listing_category_location').children().eq(1).text().trim(),
      description: $('#vehicle').text(),
      bodyType: $('.listing_category_body-style').children().eq(1).text().trim(),
      transmission: $('.listing_category_transmission').children().eq(1).text().trim(),
      driverSide: $('.listing_category_drive').children().eq(1).text().trim(),
      mileage: $('.listing_category_mileage').children().eq(1).text().trim(),
      imgs,
      contactNumber: '18764331652',
    });
  } catch (err) {
    console.error('KMS detail error:', err.message);
  }
}

module.exports = { scrape };
