const { CronJob } = require('cron');
const { checker: autoadsChecker } = require('../scrapers/autoads');
// const { scrape: jacarsScrape } = require('../scrapers/jacars'); // TODO: sitemap discovery ready; blocked on Puppeteer (Cloudflare on detail pages)
const { scrape: jcoScrape } = require('../scrapers/jco');
const { scrape: kmsScrape } = require('../scrapers/kms');
const { fetchMissingContacts } = require('../scrapers/contacts');
const { refreshListings } = require('./refreshListings');
const db = require('../models');
const { runScoringBatch } = require('../services/scoringService');

let tickCount = 0;

async function persistScraperStats(stats) {
  if (!stats?.source) return;
  const { source, startedAt, scraped, saved, skipped, failed } = stats;
  const finishedAt = new Date();
  await Promise.all([
    db.ScraperStats.findOneAndUpdate(
      { source },
      { $set: { lastRun: finishedAt, scraped, saved, skipped, failed } },
      { upsert: true, new: true }
    ),
    db.ScraperRun.create({ source, startedAt, finishedAt, scraped, saved, skipped, failed }),
  ]);
}

const job = new CronJob(
  '0 */15 * * * *',
  async function () {
    tickCount++;
    console.log(`[${new Date().toISOString()}] Cron job started (tick ${tickCount})`);
    const results = await Promise.allSettled([
      autoadsChecker(process.env.SITE1),
      // jacarsScrape(), // TODO: sitemap discovery ready; blocked on Puppeteer (Cloudflare on detail pages)
      // jcoScrape(process.env.SITE3),    // TODO: Cloudflare bot protection, needs Puppeteer
      kmsScrape(process.env.SITE4),
      fetchMissingContacts(),
    ]);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value?.source) {
        await persistScraperStats(result.value).catch((err) =>
          console.error('[Stats] persist error:', err.message)
        );
      }
    }

    // Run listing refresh every 4th tick (~1 hour)
    if (tickCount % 4 === 0) {
      await refreshListings().catch((err) =>
        console.error('[Refresh] error:', err.message)
      );
    }

    await runScoringBatch();
    console.log(`Next run: ${this.nextDate()}`);
  },
  null,
  true
);

module.exports = job;
