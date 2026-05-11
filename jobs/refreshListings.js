const axios = require('axios');
const db = require('../models');
const { scrapeDetail: autoadsDetail } = require('../scrapers/autoads');
const { scrapeDetail: kmsDetail } = require('../scrapers/kms');
const { scrapeDetail: jacarsDetail } = require('../scrapers/jacars');
const { scrapeDetail: jcoDetail } = require('../scrapers/jco');

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
const BATCH_SIZE = 20;
const STALE_HOURS = 24;

// Only include scrapers that use axios (not Puppeteer) — Puppeteer-based detail
// re-scrapes cause OOM on the 512MB dyno when run inside an HTTP request handler.
const DETAIL_SCRAPERS = {
  autoadsja: autoadsDetail,
  kms: kmsDetail,
};

async function refreshListings() {
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

  const listings = await db.Cars.find(
    {
      sold: { $ne: true },
      user: { $in: Object.keys(DETAIL_SCRAPERS) },
      $or: [{ lastSeenAt: { $lt: cutoff } }, { lastSeenAt: null }],
    },
    { url: 1, user: 1 }
  )
    .sort({ lastSeenAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  let refreshed = 0;
  let deactivated = 0;
  let failed = 0;

  for (const listing of listings) {
    try {
      const res = await axios.head(listing.url, {
        headers: HEADERS,
        timeout: 10000,
        maxRedirects: 5,
      });

      if (res.status >= 400) {
        await db.Cars.findOneAndUpdate(
          { url: listing.url },
          { $set: { posted: false, lastSeenAt: null } }
        );
        deactivated++;
        continue;
      }

      const detailFn = DETAIL_SCRAPERS[listing.user];
      if (detailFn) {
        await detailFn(listing.url);
        refreshed++;
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 404 || status === 410 || status === 301) {
        await db.Cars.findOneAndUpdate(
          { url: listing.url },
          { $set: { posted: false, lastSeenAt: null } }
        );
        deactivated++;
      } else {
        console.error(`[refresh] ${listing.url}: ${err.message}`);
        failed++;
      }
    }
  }

  return { refreshed, deactivated, failed, checked: listings.length };
}

// Off-peak Puppeteer refresh: re-scrapes JaCars/JCO detail pages.
// Only run from a dedicated cron (not the HTTP request handler) to keep memory safe.
const PUPPETEER_DETAIL_SCRAPERS = {
  jacars: jacarsDetail,
  jamaicaonlineclassifieds: jcoDetail,
};
const PUPPETEER_BATCH_SIZE = 10;

async function refreshPuppeteerListings() {
  if (process.env.ENABLE_PUPPETEER !== 'true') {
    return { skipped: 'ENABLE_PUPPETEER not set' };
  }
  const { closeBrowser } = require('../scrapers/browser');
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

  const result = { refreshed: 0, deactivated: 0, failed: 0, checked: 0 };

  for (const [source, detailFn] of Object.entries(PUPPETEER_DETAIL_SCRAPERS)) {
    const listings = await db.Cars.find(
      {
        sold: { $ne: true },
        user: source,
        $or: [{ lastSeenAt: { $lt: cutoff } }, { lastSeenAt: null }],
      },
      { url: 1, user: 1 }
    )
      .sort({ lastSeenAt: 1 })
      .limit(PUPPETEER_BATCH_SIZE)
      .lean();

    result.checked += listings.length;

    for (const listing of listings) {
      try {
        await detailFn(listing.url);
        result.refreshed++;
      } catch (err) {
        const status = err.response?.status;
        if (status === 404 || status === 410) {
          await db.Cars.findOneAndUpdate(
            { url: listing.url },
            { $set: { posted: false, lastSeenAt: null } }
          );
          result.deactivated++;
        } else {
          console.error(`[refresh-puppeteer] ${listing.url}: ${err.message}`);
          result.failed++;
        }
      }
    }
    await closeBrowser().catch(() => {});
  }

  return result;
}

module.exports = { refreshListings, refreshPuppeteerListings };
