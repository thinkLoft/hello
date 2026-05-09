// Re-scrape JaCars detail pages to update imgs[] with full-res URLs.
// Run locally against prod:
//   MONGODB_URI=<prod-uri> node scripts/backfillJacarsImages.js
//
// Uses Puppeteer — must run locally, not on Heroku (memory limits).
// Safe to re-run — skips listings where imgs haven't changed.

require('dotenv').config();
const mongoose = require('mongoose');
const cheerio = require('cheerio');
const db = require('../models');
const { fetchPage } = require('../scrapers/browser');
const { cacheImages } = require('../services/imageCache');

async function extractImgs(url) {
  const html = await fetchPage(url, { waitSelector: '#ad-title', timeout: 30000 });
  const $ = cheerio.load(html);
  const rawImgs = [];
  $('img.announcement__images-item').each((i, el) => {
    const src = (
      $(el).attr('data-full-image') ||
      $(el).attr('data-src') ||
      $(el).attr('data-original') ||
      $(el).attr('data-lazy') ||
      $(el).attr('src')
    )?.trim();
    if (src && !rawImgs.includes(src)) {
      rawImgs.push(src.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1'));
    }
  });
  return cacheImages(rawImgs);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/helloV1');
  console.log('Connected to MongoDB');

  const listings = await db.Cars.find({ user: 'jacars', imgs: { $exists: true, $ne: [] } })
    .select('_id url imgs')
    .lean();
  console.log(`Found ${listings.length} JaCars listings to backfill`);

  let updated = 0, skipped = 0, failed = 0;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    console.log(`\n[${i + 1}/${listings.length}] ${listing.url}`);
    try {
      const imgs = await extractImgs(listing.url);
      if (!imgs.length) {
        console.warn('  No images found — skipping');
        failed++;
      } else if (JSON.stringify(imgs) === JSON.stringify(listing.imgs)) {
        console.log('  Images unchanged — skipping');
        skipped++;
      } else {
        await db.Cars.updateOne({ _id: listing._id }, { $set: { imgs } });
        console.log(`  Updated: ${imgs.length} image(s)`);
        updated++;
      }
    } catch (err) {
      console.error('  Error:', err.message);
      failed++;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\nDone — updated ${updated}, skipped ${skipped}, failed ${failed}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(console.error);
