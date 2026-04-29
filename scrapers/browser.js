const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

let _browser = null;

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  _browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  _browser.on('disconnected', () => { _browser = null; });
  return _browser;
}

async function fetchPage(url, { waitSelector, timeout = 20000 } = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    if (waitSelector) await page.waitForSelector(waitSelector, { timeout: 8000 }).catch(() => {});
    return await page.content();
  } finally {
    await page.close();
  }
}

module.exports = { fetchPage };
