const db = require('../models');

async function persistScraperStats(stats) {
  if (!stats?.source) return;
  const {
    source, startedAt,
    scraped, saved, skipped, failed,
    rejected = 0, rejectionReasons = {}, failedUrls = [],
  } = stats;
  const finishedAt = new Date();
  await Promise.all([
    db.ScraperStats.findOneAndUpdate(
      { source },
      { $set: { lastRun: finishedAt, scraped, saved, skipped, failed, rejected } },
      { upsert: true, new: true }
    ),
    db.ScraperRun.create({
      source, startedAt, finishedAt,
      scraped, saved, skipped, failed,
      rejected, rejectionReasons, failedUrls,
    }),
  ]);
}

module.exports = { persistScraperStats };
