'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const Cars = require('../models/cars');
const { makeSlug } = require('../services/validator');

const BATCH = 100;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const total = await Cars.countDocuments({ slug: { $exists: false } });
  console.log(`Found ${total} listings without a slug`);

  let processed = 0;
  let updated = 0;
  let errors = 0;

  const cursor = Cars.find({ slug: { $exists: false } }, { _id: 1, year: 1, make: 1, model: 1 })
    .lean()
    .cursor({ batchSize: BATCH });

  for await (const doc of cursor) {
    const slug = makeSlug(doc);
    try {
      await Cars.updateOne({ _id: doc._id }, { $set: { slug } });
      updated++;
    } catch (err) {
      console.error(`  Error on ${doc._id}: ${err.message}`);
      errors++;
    }
    processed++;
    if (processed % 100 === 0) {
      console.log(`  ${processed}/${total} processed (${updated} updated, ${errors} errors)`);
    }
  }

  console.log(`Done: ${updated} slugs generated, ${errors} errors`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
