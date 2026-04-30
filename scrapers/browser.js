let puppeteer = null;
try {
  puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());
} catch (_) {
  console.warn('[browser] puppeteer-extra not available — JaCars/JCO scrapers disabled on this host');
}

let _browser = null;

async function getBrowser() {
  if (!puppeteer) throw new Error('puppeteer-extra not available on this host');
  if (_browser && _browser.isConnected()) return _browser;
  const launchOpts = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--disable-extensions',
    ],
  };
  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.GOOGLE_CHROME_BIN;
  if (chromePath) launchOpts.executablePath = chromePath;
  _browser = await puppeteer.launch(launchOpts);
  _browser.on('disconnected', () => { _browser = null; });
  return _browser;
}

async function fetchPage(url, { waitSelector, timeout = 20000 } = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    if (waitSelector) {
      try {
        await page.waitForSelector(waitSelector, { timeout: 8000 });
      } catch {
        throw new Error(`selector_timeout:${waitSelector}`);
      }
    }
    return await page.content();
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

module.exports = { fetchPage, closeBrowser };
