// Quick diagnostic — prints all img attributes from one JaCars listing.
// node scripts/debugJacarsImgs.js <url>
// e.g. node scripts/debugJacarsImgs.js https://www.jacars.net/adv/123456

require('dotenv').config();
const cheerio = require('cheerio');
const { fetchPage } = require('../scrapers/browser');

async function run() {
  const url = process.argv[2];
  if (!url) { console.error('Usage: node scripts/debugJacarsImgs.js <url>'); process.exit(1); }

  console.log('Fetching', url);
  const html = await fetchPage(url, { waitSelector: '#ad-title', timeout: 30000 });
  const $ = cheerio.load(html);

  console.log('\n--- img.announcement__images-item elements ---');
  $('img.announcement__images-item').each((i, el) => {
    const attrs = el.attribs;
    console.log(`\nImage ${i + 1}:`);
    Object.entries(attrs).forEach(([k, v]) => console.log(`  ${k}: ${v?.slice(0, 120)}`));
  });

  console.log('\n--- Parent <a> hrefs ---');
  $('img.announcement__images-item').each((i, el) => {
    const href = $(el).closest('a').attr('href');
    console.log(`  Image ${i + 1} parent href: ${href}`);
  });

  console.log('\n--- All img src containing "jacars" or "upload" ---');
  $('img').each((i, el) => {
    const src = $(el).attr('src') || '';
    if (src.includes('jacars') || src.includes('upload') || src.includes('cdn')) {
      console.log(' ', src.slice(0, 120));
    }
  });

  process.exit(0);
}

run().catch(err => { console.error(err.message); process.exit(1); });
