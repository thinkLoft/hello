const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const db = require('../models');
const { contactCheck } = require('../services/validator');

async function fetchMissingContacts() {
  const docs = await db.Cars.find({
    contactNumber: null,
    user: 'jacars',
    posted: true,
  }).sort({ _id: -1 }).limit(3);

  if (docs.length === 0) return;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    for (const car of docs) {
      await page.goto(car.url, { waitUntil: 'networkidle2' });
      await page.evaluate(() => document.querySelector('.phone-author__title')?.click());
      await page.waitForTimeout(800);

      const $ = cheerio.load(await page.content());
      const raw = $('.phone-author-subtext__main').text().replace(/[^0-9]+/g, '');
      const contactNumber = raw ? contactCheck(raw) : null;

      await db.Cars.findOneAndUpdate({ url: car.url }, { contactNumber }).catch((err) =>
        console.error('Contact update error:', err.message)
      );
    }
  } finally {
    await browser.close();
  }
}

module.exports = { fetchMissingContacts };
