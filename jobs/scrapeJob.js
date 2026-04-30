const { CronJob } = require('cron');
const { checker: autoadsChecker } = require('../scrapers/autoads');
const { scrape: jacarsScrape } = require('../scrapers/jacars');
const { scrape: jcoScrape } = require('../scrapers/jco');
const { scrape: kmsScrape } = require('../scrapers/kms');
const { fetchMissingContacts } = require('../scrapers/contacts');
const { closeBrowser } = require('../scrapers/browser');
const { refreshListings } = require('./refreshListings');
const { persistScraperStats } = require('./persistScraperStats');
const { runScoringBatch } = require('../services/scoringService');

let tickCount = 0;

const job = new CronJob(
  '0 */15 * * * *',
  async function () {
    tickCount++;
    console.log(`[${new Date().toISOString()}] Cron job started (tick ${tickCount})`);

    // Phase 1: non-Puppeteer scrapers run in parallel
    const phase1 = await Promise.allSettled([
      autoadsChecker(process.env.SITE1),
      kmsScrape(process.env.SITE4),
      fetchMissingContacts(),
    ]);

    // Phase 2: Puppeteer scrapers — skipped unless ENABLE_PUPPETEER=true (not set on Heroku Basic)
    const puppeteerEnabled = process.env.ENABLE_PUPPETEER === 'true';
    const jacarsResult = puppeteerEnabled
      ? await jacarsScrape().then(
          (v) => ({ status: 'fulfilled', value: v }),
          (e) => { console.error('[JaCars] error:', e.message); return { status: 'rejected' }; }
        )
      : { status: 'skipped' };
    if (puppeteerEnabled) await closeBrowser();

    const jcoResult = puppeteerEnabled
      ? await jcoScrape(process.env.SITE3).then(
          (v) => ({ status: 'fulfilled', value: v }),
          (e) => { console.error('[JCO] error:', e.message); return { status: 'rejected' }; }
        )
      : { status: 'skipped' };
    if (puppeteerEnabled) await closeBrowser();

    const results = [...phase1, jacarsResult, jcoResult];

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
