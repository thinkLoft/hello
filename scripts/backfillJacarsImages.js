// Re-scrape JaCars detail pages to update imgs[] with full-res URLs.
// Run locally against prod:
//   MONGODB_URI=<prod-uri> node scripts/backfillJacarsImages.js
//
// Uses Puppeteer — must run locally, not on Heroku (memory limits).
// ~30s per listing. Safe to re-run — skips listings where imgs haven't changed.

require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../models');
const { scrapeDetail } = require('../scrapers/jacars');

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
      const result = await scrapeDetail(listing.url);
      if (!result?.imgs?.length) {
        console.warn('  No images returned — skipping');
        failed++;
        continue;
      }
      // Only update if imgs changed
      const same = JSON.stringify(result.imgs) === JSON.stringify(listing.imgs);
      if (same) {
        console.log('  Images unchanged — skipping');
        skipped++;
        continue;
      }
      await db.Cars.updateOne({ _id: listing._id }, { $set: { imgs: result.imgs } });
      console.log(`  Updated: ${result.imgs.length} image(s)`);
      updated++;
    } catch (err) {
      console.error('  Error:', err.message);
      failed++;
    }
  }

  console.log(`\nDone — updated ${updated}, skipped ${skipped}, failed ${failed}`);
  await mongoose.disconnect();
}

run().catch(console.error);
