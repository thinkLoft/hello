const express = require('express');
const router = express.Router();
const db = require('../../models');
const { requireAdmin } = require('../../middleware/auth');
const { DEFAULT_WEIGHTS, runScoringBatch } = require('../../services/scoringService');

router.get('/scraper-stats', requireAdmin, async (req, res) => {
  try {
    const stats = await db.ScraperStats.find({}).sort({ source: 1 }).lean();
    res.json(stats);
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
    const runs = await db.ScraperRun.find(filter)
      .sort({ startedAt: -1 })
      .limit(25)
      .lean();
    res.json(runs);
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

module.exports = router;
