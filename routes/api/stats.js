const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const db = require('../../models');
const { requireAdmin } = require('../auth');
const { DEFAULT_WEIGHTS, runScoringBatch } = require('../../services/scoringService');
const { refreshListings } = require('../../jobs/refreshListings');
const { persistScraperStats } = require('../../jobs/persistScraperStats');
const { closeBrowser } = require('../../scrapers/browser');

const SCRAPER_REGISTRY = {
  autoadsja:               () => require('../../scrapers/autoads').checker(process.env.SITE1),
  kms:                     () => require('../../scrapers/kms').scrape(process.env.SITE4),
  jacars:                  () => require('../../scrapers/jacars').scrape(),
  jamaicaonlineclassifieds:() => require('../../scrapers/jco').scrape(process.env.SITE3),
};

const PUPPETEER_SOURCES = new Set(['jacars', 'jamaicaonlineclassifieds']);

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

router.get('/scraper-runs/:id/failed-urls', requireAdmin, async (req, res) => {
  try {
    const run = await db.ScraperRun.findById(req.params.id).lean();
    if (!run) return res.status(404).json({ error: 'Not found' });
    res.json({ source: run.source, startedAt: run.startedAt, failedUrls: run.failedUrls || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scraper-rejections', requireAdmin, async (req, res) => {
  try {
    const { source } = req.query;
    const hours = Math.min(parseInt(req.query.hours) || 24, 24 * 30);
    const cutoff = new Date(Date.now() - hours * 3600 * 1000);
    const match = { posted: false, lastSeenAt: { $gte: cutoff } };
    if (source) match.user = source;

    const byCommentRaw = await db.Cars.aggregate([
      { $match: match },
      { $project: { codes: { $split: ['$comments', '. '] } } },
      { $unwind: '$codes' },
      { $match: { codes: { $ne: '' } } },
      { $group: { _id: '$codes', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const runMatch = { startedAt: { $gte: cutoff } };
    if (source) runMatch.source = source;
    const recentRuns = await db.ScraperRun.find(runMatch).lean();
    const byCode = {};
    for (const r of recentRuns) {
      for (const [k, v] of Object.entries(r.rejectionReasons || {})) {
        byCode[k] = (byCode[k] || 0) + v;
      }
    }

    res.json({
      byCode,
      byComment: Object.fromEntries(byCommentRaw.map(x => [x._id, x.count])),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual scraper trigger — admin-only, dev-friendly alternative to waiting for cron
router.post('/scrape/run', requireAdmin, async (req, res) => {
  const { source } = req.query;
  const fn = SCRAPER_REGISTRY[source];
  if (!fn) {
    return res.status(400).json({
      error: `Unknown source: ${source}`,
      valid: Object.keys(SCRAPER_REGISTRY),
    });
  }
  try {
    const stats = await fn();
    await persistScraperStats(stats);
    if (PUPPETEER_SOURCES.has(source)) await closeBrowser();
    res.json({ ok: true, stats });
  } catch (err) {
    if (PUPPETEER_SOURCES.has(source)) await closeBrowser().catch(() => {});
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
