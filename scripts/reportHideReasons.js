// Read-only: dump hideReason aggregation from prod for analysis.
//   MONGODB_URI=<prod-uri> node scripts/reportHideReasons.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });
const mongoose = require('mongoose');
const db = require('../models');

async function run() {
  const uri = process.env.MONGODB_URI || process.env.PROD_MONGODB_URI;
  await mongoose.connect(uri);

  const grouped = await db.Cars.aggregate([
    { $match: { hidden: true, hideReason: { $ne: null } } },
    { $group: { _id: { reason: '$hideReason', source: '$user' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const totalsBySource = {};
  for (const g of grouped) {
    totalsBySource[g._id.source] = (totalsBySource[g._id.source] || 0) + g.count;
  }

  console.log('Hide reasons by source (% of source total):');
  console.log('reason'.padEnd(32), 'source'.padEnd(28), 'count'.padStart(6), '   pct');
  console.log('-'.repeat(82));
  for (const g of grouped) {
    const total = totalsBySource[g._id.source] || 1;
    const pct = ((g.count / total) * 100).toFixed(1);
    console.log(g._id.reason.padEnd(32), g._id.source.padEnd(28), String(g.count).padStart(6), `   ${pct}%`);
  }
  console.log('\nTotals:', totalsBySource);

  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
