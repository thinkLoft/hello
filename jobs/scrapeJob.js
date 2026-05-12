const { CronJob } = require('cron');
const { checker: autoadsChecker } = require('../scrapers/autoads');
const { scrape: jacarsScrape } = require('../scrapers/jacars');
const { scrape: jcoScrape } = require('../scrapers/jco');
const { scrape: kmsScrape } = require('../scrapers/kms');
const { fetchMissingContacts } = require('../scrapers/contacts');
const { closeBrowser } = require('../scrapers/browser');
const { refreshListings, refreshPuppeteerListings } = require('./refreshListings');
const { persistScraperStats } = require('./persistScraperStats');
const { runScoringBatch } = require('../services/scoringService');

let tickCount = 0;

// Per-source schedule (in 15-min ticks). AutoAds & KMS run without Puppeteer;
// contacts/JaCars/JCO require Puppeteer and are gated by ENABLE_PUPPETEER.
// contacts runs every 2nd tick (~30 min); Puppeteer scrapers every 4th tick (~60 min).
const SOURCE_TICK_INTERVAL = {
  autoadsja: 1,
  kms:       2,
  contacts:  2,
  jacars:    4,
  jamaicaonlineclassifieds: 4,
};

const shouldRun = (source) => tickCount % SOURCE_TICK_INTERVAL[source] === 0;

const job = new CronJob(
  '0 */15 * * * *',
  async function () {
    tickCount++;
    console.log(`[${new Date().toISOString()}] Cron job started (tick ${tickCount})`);

    // Phase 1: non-Puppeteer scrapers
    const phase1Tasks = [];
    if (shouldRun('autoadsja')) phase1Tasks.push(autoadsChecker(process.env.SITE1));
    if (shouldRun('kms'))       phase1Tasks.push(kmsScrape(process.env.SITE4));
    const phase1 = await Promise.allSettled(phase1Tasks);

    // Phase 2: Puppeteer scrapers — skipped unless ENABLE_PUPPETEER=true
    const puppeteerEnabled = process.env.ENABLE_PUPPETEER === 'true';
    const runJacars = puppeteerEnabled && shouldRun('jacars');
    const runJco = puppeteerEnabled && shouldRun('jamaicaonlineclassifieds');
    const runContacts = puppeteerEnabled && shouldRun('contacts');

    const jacarsResult = runJacars
      ? await jacarsScrape().then(
          (v) => ({ status: 'fulfilled', value: v }),
          (e) => { console.error('[JaCars] error:', e.message); return { status: 'rejected' }; }
        )
      : { status: 'skipped' };
    if (runJacars) await closeBrowser();

    const jcoResult = runJco
      ? await jcoScrape(process.env.SITE3).then(
          (v) => ({ status: 'fulfilled', value: v }),
          (e) => { console.error('[JCO] error:', e.message); return { status: 'rejected' }; }
        )
      : { status: 'skipped' };
    if (runJco) await closeBrowser();

    const contactsResult = runContacts
      ? await fetchMissingContacts().then(
          (v) => ({ status: 'fulfilled', value: v }),
          (e) => { console.error('[Contacts] error:', e.message); return { status: 'rejected' }; }
        )
      : { status: 'skipped' };
    if (runContacts) await closeBrowser();

    const results = [...phase1, jacarsResult, jcoResult, contactsResult];

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

// Off-peak Puppeteer refresh: 04:00 JM time (= 09:00 UTC) daily.
// Runs JaCars + JCO detail re-scrapes sequentially with closeBrowser between.
const puppeteerRefreshJob = new CronJob(
  '0 0 9 * * *',
  async function () {
    if (process.env.ENABLE_PUPPETEER !== 'true') return;
    console.log(`[${new Date().toISOString()}] Off-peak Puppeteer refresh starting`);
    try {
      const result = await refreshPuppeteerListings();
      console.log('[refresh-puppeteer] result:', JSON.stringify(result));
    } catch (err) {
      console.error('[refresh-puppeteer] error:', err.message);
    }
  },
  null,
  true,
  'UTC'
);

module.exports = job;
module.exports.puppeteerRefreshJob = puppeteerRefreshJob;
