// Debug JCO price extraction.
// Run: node scripts/debugJcoPrice.js [optional-url]
const { fetchPage, closeBrowser } = require('../scrapers/browser');
const cheerio = require('cheerio');

const URLS = process.argv[2]
  ? [process.argv[2]]
  : [
      'https://jamaicaclassifiedonline.com/auto/cars/2004-prado-350602.htm',
      'https://jamaicaclassifiedonline.com/auto/cars/2009-prado-350602.htm',
    ];

async function run() {
  for (const url of URLS) {
    console.log('\n===', url);
    try {
      const html = await fetchPage(url, { waitSelector: 'li.collection-item', timeout: 30000 });
      const $ = cheerio.load(html);
      // JSON-LD blocks
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const data = JSON.parse($(el).text());
          console.log('JSON-LD type:', data['@type']);
          if (data['@type'] === 'Product') {
            console.log('  name:', data.name);
            console.log('  offers:', JSON.stringify(data.offers));
          }
        } catch (e) {
          console.log('  JSON-LD parse error:', e.message);
        }
      });
      // Look for any visible price-like text
      const bodyText = $('body').text();
      const prices = bodyText.match(/\$[\d,]{3,12}/g) || [];
      console.log('Visible $-prices:', prices.slice(0, 6));
      // Old fallback selector
      const legacyPriceText = $('div.col.s12.l3.m6.flow-text').toArray()
        .map((el) => $(el).text().trim()).filter((t) => t.includes('$'));
      console.log('Legacy fallback $-text:', legacyPriceText);
    } catch (e) {
      console.error('Fetch error:', e.message);
    }
  }
  await closeBrowser();
}
run().catch(async (e) => { console.error(e); await closeBrowser(); process.exit(1); });
