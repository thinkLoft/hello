#!/usr/bin/env node
// Temporary debug script — remove after investigation
const { fetchPage } = require('../scrapers/browser');
const cheerio = require('cheerio');

async function debugJCO() {
  const url = 'https://jamaicaclassifiedonline.com/auto/cars/2016-toyota-allion-346865.htm';
  console.log('\n=== JCO ===', url);
  try {
    const html = await fetchPage(url, { waitSelector: 'li.collection-item', timeout: 30000 });
    const $ = cheerio.load(html);

    // Dump all text nodes that look like price or parish
    console.log('\n-- All text with digits > 4 chars or parish keywords --');
    const seen = new Set();
    $('*').each((i, el) => {
      const t = $(el).clone().children().remove().end().text().trim();
      if (t.length > 3 && t.length < 80 && !seen.has(t)) {
        if (/\d{4,}/.test(t) || /kingston|parish|st\.|clarendon|portland|westmoreland|hanover|manchester|trelawny|price|contact/i.test(t)) {
          seen.add(t);
          console.log(' ', el.tagName, $(el).attr('class')?.slice(0,40), JSON.stringify(t.slice(0,80)));
        }
      }
    });

    // Also dump page title and first 3000 chars of body text
    console.log('\n-- Page title:', $('title').text());
    console.log('-- Body text sample (first 2000 chars):');
    console.log($('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000));
  } catch (e) { console.error('JCO failed:', e.message); }
}

async function debugJaCars() {
  // Try a different, fresher JaCars URL
  const url = 'https://www.jacars.net/adv/2457820_toyota-axio/';
  console.log('\n=== JaCars ===', url);
  try {
    const html = await fetchPage(url, { timeout: 30000 });
    const $ = cheerio.load(html);
    console.log('Page title:', $('title').text().trim());
    console.log('meta[itemprop=price]:', $("meta[itemprop='price']").attr('content'));
    // Dump first 3000 chars of body
    console.log('Body text sample:');
    console.log($('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000));
  } catch (e) { console.error('JaCars failed:', e.message); }
}

(async () => {
  await debugJCO();
  await debugJaCars();
  process.exit(0);
})();
