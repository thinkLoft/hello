const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const db = require('../../models');
const { requireAdmin } = require('../auth');
const { DEFAULT_WEIGHTS, runScoringBatch } = require('../../services/scoringService');
const { refreshListings } = require('../../jobs/refreshListings');

router.get('/scraper-stats', requireAdmin, async (req, res) => {
  try {
    const [stats, counts] = await Promise.all([
      db.ScraperStats.find({}).sort({ source: 1 }).lean(),
      db.Cars.aggregate([
        { $match: { posted: true, hidden: { $ne: true }, imgs: { $gt: [] } } },
        { $group: { _id: '$user', count: { $sum: 1 } } },
      ]),
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));
    res.json(stats.map((s) => ({ ...s, activeListings: countMap[s.source] ?? 0 })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scoring-weights', requireAdmin, async (req, res) => {
  try {
    const doc = await db.Settings.findOne({ key: 'scoringWeights' }).lean();
    res.json(doc?.value ?? DEFAULT_WEIGHTS);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/scoring-weights', requireAdmin, async (req, res) => {
  try {
    const keys = ['price', 'completeness', 'mileage', 'source', 'images'];
    const weights = {};
    for (const k of keys) {
      const val = req.body[k];
      if (typeof val !== 'number' || val < 0) {
        return res.status(400).json({ error: `${k} must be a non-negative number` });
      }
      weights[k] = val;
    }

    const total = keys.reduce((sum, k) => sum + weights[k], 0);
    if (Math.abs(total - 100) > 0.01) {
      return res.status(400).json({ error: `Weights must sum to 100 (got ${total})` });
    }

    const doc = await db.Settings.findOneAndUpdate(
      { key: 'scoringWeights' },
      { $set: { value: weights } },
      { upsert: true, new: true }
    );
    res.json(doc.value);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scraper-runs', requireAdmin, async (req, res) => {
  try {
    const { source } = req.query;
    const filter = source ? { source } : {};
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const runs = await db.ScraperRun.find(filter)
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/listings/refresh', requireAdmin, async (req, res) => {
  try {
    const result = await refreshListings();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/scoring/run', requireAdmin, async (req, res) => {
  try {
    const scored = await runScoringBatch();
    res.json({ ok: true, scored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/scrape/push-to-prod', requireAdmin, (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  if (!process.env.PROD_MONGODB_URI) {
    return res.status(500).json({ error: 'PROD_MONGODB_URI not set in .env' });
  }

  const env = { ...process.env, MONGODB_URI: process.env.PROD_MONGODB_URI };
  const script = path.join(__dirname, '../../scripts/pushToProd.js');
  const child = spawn(process.execPath, [script], { env });

  child.stdout.on('data', d => console.log('[pushToProd]', d.toString().trim()));
  child.stderr.on('data', d => console.error('[pushToProd]', d.toString().trim()));
  child.on('exit', code => console.log(`[pushToProd] exited with code ${code}`));

  res.json({ started: true });
});

module.exports = router;
