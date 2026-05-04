const router = require('express').Router();
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { priceCheck } = require('../services/priceAnalysis');
const { requireAdmin } = require('./auth');
const { getPriceBand, scoreListing, getWeights } = require('../services/scoringService');

const currentYear = new Date().getFullYear();

// Strip contactNumber from public listing responses; replace with hasContact boolean
function maskContacts(docs) {
  return docs.map(({ contactNumber, ...rest }) => ({
    ...rest,
    hasContact: !!contactNumber,
  }));
}

// In-memory rate limiter: max 10 contact reveals per IP per 15 min
const revealLog = new Map();
function checkRevealLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const limit = 10;
  const hits = (revealLog.get(ip) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  revealLog.set(ip, hits);
  return true;
}

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
    }).sort({ _id: -1 }).limit(500).lean();
    res.json(maskContacts(docs));
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
    }).sort({ _id: -1 }).limit(200).lean();
    res.json(maskContacts(docs));
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
    }).sort({ _id: -1 }).limit(500).lean();
    res.json(maskContacts(docs));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all', async (req, res) => {
  try {
    const docs = await db.Cars.find({
      posted: true,
      hidden: { $ne: true },
      imgs: { $gt: [] },
    }).sort({ _id: -1 }).limit(2000).lean();
    res.json(maskContacts(docs));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cars/:id/reveal-contact', async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRevealLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests — please wait before revealing more numbers' });
  }
  try {
    const car = await db.Cars.findById(req.params.id, { contactNumber: 1 }).lean();
    if (!car) return res.status(404).json({ error: 'Not found' });
    if (!car.contactNumber) return res.status(404).json({ error: 'No contact info for this listing' });
    await db.Cars.findByIdAndUpdate(req.params.id, { $inc: { contactReveals: 1 } });
    res.json({ contactNumber: car.contactNumber });
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
    const docs = await db.Cars.find({
      year: { $lte: Number(yearUpper), $gte: Number(yearLower) },
      make: { $regex: new RegExp(`^${make.trim()}$`, 'i') },
      model: { $regex: new RegExp(`^${model.trim()}$`, 'i') },
      price: { $gte: 100000, $lte: 10000000 },
      posted: true,
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
