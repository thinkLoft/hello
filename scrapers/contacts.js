const cheerio = require('cheerio');
const db = require('../models');
const { contactCheck } = require('../services/validator');
const { getBrowser } = require('./browser');

async function fetchMissingContacts() {
  const docs = await db.Cars.find({
    contactNumber: null,
    user: 'jacars',
    posted: true,
  }).sort({ _id: -1 }).limit(10);

  if (docs.length === 0) return { source: 'contacts', found: 0, enriched: 0 };

  const browser = await getBrowser();
  const page = await browser.newPage();
  let enriched = 0;

  try {
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    for (const car of docs) {
      try {
        await page.goto(car.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.evaluate(() => document.querySelector('.phone-author__title')?.click());
        try {
          await page.waitForSelector('.phone-author-subtext__main', { timeout: 5000 });
        } catch {
          // selector never appeared — likely no phone or page blocked
        }

        const $ = cheerio.load(await page.content());
        const raw = $('.phone-author-subtext__main').text().replace(/[^0-9]+/g, '');
        const contactNumber = raw ? contactCheck(raw) : null;

        if (contactNumber) {
          await db.Cars.findOneAndUpdate({ url: car.url }, { contactNumber }).catch((err) =>
            console.error('[Contacts] update error:', err.message)
          );
          enriched++;
          console.log('[Contacts] enriched', car.url, '→', contactNumber);
        } else {
          console.log('[Contacts] no number for', car.url);
        }
      } catch (err) {
        console.error('[Contacts] per-doc error:', car.url, err.message);
      }
    }
  } finally {
    await page.close().catch(() => {});
  }

  return { source: 'contacts', found: docs.length, enriched };
}

module.exports = { fetchMissingContacts };
