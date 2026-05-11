// Read-only verification of image backfill state on prod.
//   MONGODB_URI=<prod-uri> node scripts/verifyBackfills.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });
const mongoose = require('mongoose');
const db = require('../models');

async function run() {
  const uri = process.env.MONGODB_URI || process.env.PROD_MONGODB_URI;
  if (!uri) { console.error('No MONGODB_URI / PROD_MONGODB_URI'); process.exit(1); }
  await mongoose.connect(uri);

  const sources = ['autoadsja', 'kms', 'jacars', 'jamaicaonlineclassifieds'];
  console.log('source            | total | hasImgs | cloudinary | non-cloud');
  console.log('------------------|-------|---------|------------|----------');
  for (const src of sources) {
    const total = await db.Cars.countDocuments({ user: src });
    const hasImgs = await db.Cars.countDocuments({ user: src, imgs: { $exists: true, $ne: [] } });
    const cloud = await db.Cars.countDocuments({ user: src, 'imgs.0': { $regex: 'res\\.cloudinary\\.com' } });
    const nonCloud = hasImgs - cloud;
    console.log(`${src.padEnd(18)}| ${String(total).padStart(5)} | ${String(hasImgs).padStart(7)} | ${String(cloud).padStart(10)} | ${String(nonCloud).padStart(8)}`);
  }

  // JaCars full-res check: count whether imgs contain the WordPress -WxH suffix
  const jacarsThumbCount = await db.Cars.countDocuments({
    user: 'jacars',
    'imgs.0': { $regex: '-\\d+x\\d+\\.(jpe?g|png|webp)' },
  });
  console.log(`\nJaCars first-img w/ -WxH thumbnail suffix: ${jacarsThumbCount}`);

  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
