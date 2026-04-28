const router = require('express').Router();
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { priceCheck } = require('../services/priceAnalysis');

const currentYear = new Date().getFullYear();

// Auth gate for write operations.
// TODO: replace with real session/JWT check when user auth is added.
// Set ADMIN_KEY in .env to enable enforcement; unset = open (dev only).
function requireAdmin(req, res, next) {
  const key = process.env.ADMIN_KEY;
  if (!key) return next();
  if (req.headers['x-admin-key'] === key) return next();
  return res.status(401).json({ error: 'Unauthorized' });
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
    const count = await db.Cars.countDocuments();
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

router.patch('/cars/:id', requireAdmin, async (req, res) => {
  try {
    await db.Cars.findByIdAndUpdate(req.params.id, { sold: true, posted: false });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
