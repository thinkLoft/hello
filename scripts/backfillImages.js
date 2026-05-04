#!/usr/bin/env node
// One-time script: upload all existing non-Cloudinary car images to Cloudinary.
// Run from project root: node scripts/backfillImages.js
require('dotenv').config();
const mongoose = require('mongoose');
const { cacheImages } = require('../services/imageCache');

const CarSchema = new mongoose.Schema({ imgs: [String] }, { strict: false });
const Car = mongoose.model('Car', CarSchema, 'cars');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const cars = await Car.find({
    imgs: { $elemMatch: { $not: /cloudinary\.com/ } },
  }).select('_id imgs');

  console.log(`Found ${cars.length} listings with non-Cloudinary images`);

  let updated = 0;
  const BATCH = 5;
  for (let i = 0; i < cars.length; i += BATCH) {
    const batch = cars.slice(i, i + BATCH);
    await Promise.all(batch.map(async (car) => {
      const newImgs = await cacheImages(car.imgs);
      const changed = newImgs.some((u, idx) => u !== car.imgs[idx]);
      if (changed) {
        await Car.findByIdAndUpdate(car._id, { $set: { imgs: newImgs } });
        updated++;
      }
    }));
    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH, cars.length)}/${cars.length} processed, ${updated} updated`);
  }

  console.log(`\nDone — ${updated}/${cars.length} listings updated`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
