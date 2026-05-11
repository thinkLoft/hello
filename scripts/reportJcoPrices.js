// MONGODB_URI=<prod-uri> node scripts/reportJcoPrices.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });
const mongoose = require('mongoose');
const db = require('../models');
async function run() {
  const uri = process.env.MONGODB_URI || process.env.PROD_MONGODB_URI;
  await mongoose.connect(uri);
  const totalJco = await db.Cars.countDocuments({ user: 'jamaicaonlineclassifieds' });
  const zero = await db.Cars.countDocuments({ user: 'jamaicaonlineclassifieds', $or: [{ price: 0 }, { price: null }, { price: { $exists: false } }] });
  const sample = await db.Cars.find({ user: 'jamaicaonlineclassifieds', $or: [{ price: 0 }, { price: null }] })
    .select('url price title date posted')
    .sort({ _id: -1 })
    .limit(5)
    .lean();
  console.log(`JCO total: ${totalJco}, 0/null price: ${zero} (${((zero / totalJco) * 100).toFixed(1)}%)`);
  console.log('Recent 0-price samples:');
  for (const c of sample) console.log(' -', c.url, '| posted=' + c.posted, '| price=', c.price);
  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
