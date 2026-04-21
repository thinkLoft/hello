const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');
const { nullCheck } = require('../services/validator');

async function checker(siteUrl) {
  try {
    const response = await axios.get(siteUrl);
    const $ = cheerio.load(response.data, { xmlMode: true });
    const urls = [];
    $('item').each((i, el) => urls.push($(el).children('link').text()));
    for (const url of urls) {
      const exists = await db.Cars.exists({ url });
      if (!exists) await scrape(url);
    }
  } catch (err) {
    console.error('AutoAds checker error:', err.message);
  }
}

async function scrape(link) {
  try {
    const response = await axios.get(link);
    const $ = cheerio.load(response.data);
    const title = $('.price-tag > h1').text();
    const ymm = title.split(' ');
    const listItems = $('.per-detail > ul > li');

    const getText = (el, prefix) =>
      el?.children[0]?.data?.replace(prefix, '').replace(/\s+/g, '').replace('.', '. ') ?? null;

    const imgs = [];
    $('.gallery__thumbs > a').each((i, el) => imgs.push($(el).attr('href')));

    await nullCheck({
      user: 'autoadsja',
      url: response.config.url,
      price: $('.price-tag > h2').text().replace(/[^0-9.-]+/g, ''),
      year: ymm[0],
      make: ymm[1]?.replace(/\-.*/g, '').trim(),
      model: ymm[2]?.replace(/\-.*/g, '').trim(),
      parish: getText(listItems[0], 'Location: '),
      bodyType: getText(listItems[1], 'Body Type: '),
      driverSide: getText(listItems[2], 'Driver Side: '),
      transmission: getText(listItems[4], 'Transmission: '),
      mileage: getText(listItems[7], 'Mileage: '),
      contactNumber: $('.contact_details > a').attr('href')?.replace(/[^0-9]+/g, ''),
      imgs,
    });
  } catch (err) {
    console.error('AutoAds scraper error:', err.message);
  }
}

module.exports = { checker };
