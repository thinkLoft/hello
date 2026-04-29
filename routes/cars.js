const router = require('express').Router();
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { priceCheck } = require('../services/priceAnalysis');
const { requireAdmin } = require('../middleware/auth');
const { getPriceBand, scoreListing, getWeights } = require('../services/scoringService');

const currentYear = new Date().getFullYear();

const CSV_FIELDS = [
  'url', 'posted', 'user', 'year', 'make', 'model', 'price',
  'date', 'parish', 'bodyType', 'transmission', 'driverSide',
  'contactNumber', 'comments',
];

router.get('/carsforsale', async (req, res) => {
  try {
    const docs = await db.Cars.find({
      posted: true,
      hidden: { $ne: true },
      price: { $gte: 1000000 },
      year: { $gte: currentYear - 10 },
      imgs: { $gt: [] },
    }).sort({ _id: -1 }).limit(500);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/undermil', async (req, res) => {
  try {
    const docs = await db.Cars.find({
      posted: true,
      hidden: { $ne: true },
      price: { $lt: 1000000 },
      year: { $gte: currentYear - 10 },
      imgs: { $gt: [] },
    }).sort({ _id: -1 }).limit(200);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/latest', async (req, res) => {
  try {
    const docs = await db.Cars.find({
      posted: true,
      hidden: { $ne: true },
      year: { $lt: currentYear - 10 },
      imgs: { $gt: [] },
    }).sort({ _id: -1 }).limit(500);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/count', async (req, res) => {
  try {
    const count = await db.Cars.countDocuments({ posted: true, hidden: { $ne: true }, imgs: { $gt: [] } });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/csv', async (req, res) => {
  try {
    const docs = await db.Cars.find({}).limit(15000).lean();
    const parser = new Parser({ fields: CSV_FIELDS });
    const csv = parser.parse(docs);
    const dateTime = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const tmpDir = path.join(__dirname, '../tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `cars-${dateTime}.csv`);
    fs.writeFileSync(filePath, csv);
    res.download(filePath, `beego-cars-${dateTime}.csv`, () => {
      fs.unlink(filePath, () => {});
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/data/:yearUpper/:yearLower/:make/:model', async (req, res) => {
  try {
    const { yearUpper, yearLower, make, model } = req.params;
    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const docs = await db.Cars.find({
      year: { $lte: Number(yearUpper), $gte: Number(yearLower) },
      make: capitalize(make),
      model: capitalize(model),
      price: { $gte: 100000, $lte: 10000000 },
    }).sort({ _id: -1 });
    res.json(priceCheck(docs));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const EDITABLE_FIELDS = [
  'price', 'year', 'make', 'model', 'mileage', 'parish',
  'bodyType', 'transmission', 'driverSide', 'description', 'contactNumber',
  'adminNotes',
];

router.patch('/cars/:id', requireAdmin, async (req, res) => {
  try {
    const body = req.body ?? {};
    const update = {};

    if (body.sold === true) {
      update.sold = true;
      update.posted = false;
    }
    if (typeof body.hidden === 'boolean') {
      update.hidden = body.hidden;
    }
    for (const field of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        update[field] = body[field];
      }
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    await db.Cars.findByIdAndUpdate(req.params.id, { $set: update });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cars/:id/rescore', requireAdmin, async (req, res) => {
  try {
    const car = await db.Cars.findById(req.params.id).lean();
    if (!car) return res.status(404).json({ error: 'Car not found' });

    const [group, weights] = await Promise.all([
      db.Cars.find({ make: car.make, model: car.model, sold: { $ne: true } }).lean(),
      getWeights(),
    ]);

    const mmStats = priceCheck(group);
    const makeGroup = await db.Cars.find({ make: car.make, sold: { $ne: true } }).lean();
    const makeStats = priceCheck(makeGroup);

    const band =
      getPriceBand(car.price, mmStats, 2) ??
      getPriceBand(car.price, makeStats, 3);

    const result = scoreListing(car, band, weights);
    const scoreFields = {
      score: result.score,
      scoreBreakdown: result.scoreBreakdown,
      scoreSummary: result.scoreSummary,
      anomalyFlags: result.anomalyFlags,
      priceband: result.priceband,
    };

    await db.Cars.findByIdAndUpdate(req.params.id, { $set: scoreFields });
    res.json({ ok: true, ...scoreFields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
