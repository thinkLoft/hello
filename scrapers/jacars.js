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

async function scrape(pageUrl) {
  try {
    const response = await axios.get(pageUrl);
    const $ = cheerio.load(response.data);
    const links = [];
    $('.announcement-block__title').each((i, el) => {
      links.push('https://www.jacars.net' + $(el).attr('href'));
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
