const { CronJob } = require('cron');
const { checker: autoadsChecker } = require('../scrapers/autoads');
const { scrape: jacarsScrape } = require('../scrapers/jacars');
const { scrape: jcoScrape } = require('../scrapers/jco');
const { scrape: kmsScrape } = require('../scrapers/kms');
const { fetchMissingContacts } = require('../scrapers/contacts');

const job = new CronJob(
  '0 */15 * * * *',
  async function () {
    console.log(`[${new Date().toISOString()}] Cron job started`);
    await Promise.allSettled([
      autoadsChecker(process.env.SITE1),
      jacarsScrape(process.env.SITE2),
      jcoScrape(process.env.SITE3),
      kmsScrape(process.env.SITE4),
      fetchMissingContacts(),
    ]);
    console.log(`Next run: ${this.nextDate()}`);
  },
  null,
  true
);

module.exports = job;
