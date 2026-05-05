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
    console.log('li.collection-item items:');
    $('li.collection-item').each((i, el) => console.log(' ', i, $(el).text().trim().slice(0, 120)));
    console.log('div.col.s12.l3.m6.flow-text items:');
    $('div.col.s12.l3.m6.flow-text').each((i, el) => console.log(' ', i, $(el).text().trim().slice(0, 120)));
    console.log('Any element with $ (first 10):');
    let n = 0;
    $('*').each((i, el) => {
      if (n >= 10) return false;
      const t = $(el).clone().children().remove().end().text().trim();
      if (t.includes('$') && t.length < 40) { console.log(' ', el.tagName, $(el).attr('class'), JSON.stringify(t)); n++; }
    });
  } catch (e) { console.error('JCO failed:', e.message); }
}

async function debugJaCars() {
  const url = 'https://www.jacars.net/adv/2510377_ready/';
  console.log('\n=== JaCars ===', url);
  try {
    const html = await fetchPage(url, { waitSelector: '#ad-title', timeout: 30000 });
    const $ = cheerio.load(html);
    console.log('meta[itemprop=price]:', $("meta[itemprop='price']").attr('content'));
    console.log('#ad-title:', $('#ad-title').text().trim().slice(0, 80));
    console.log('.chars-column li items:');
    $('.chars-column > li').each((i, el) => {
      const subtitle = $(el).children('span').first().text().trim();
      const val = $(el).children('a').text().trim() || $(el).children('span').eq(1).text().trim();
      console.log(' ', subtitle, '->', val);
    });
    console.log('Any element with $ or JMD (first 10):');
    let n = 0;
    $('*').each((i, el) => {
      if (n >= 10) return false;
      const t = $(el).clone().children().remove().end().text().trim();
      if ((t.includes('$') || t.toLowerCase().includes('jmd')) && t.length < 50)
        { console.log(' ', el.tagName, $(el).attr('class'), JSON.stringify(t)); n++; }
    });
  } catch (e) { console.error('JaCars failed:', e.message); }
}

(async () => {
  await debugJCO();
  await debugJaCars();
  process.exit(0);
})();
