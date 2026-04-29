const axios = require('axios');
const db = require('../models');
const { scrapeDetail: autoadsDetail } = require('../scrapers/autoads');
const { scrapeDetail: kmsDetail } = require('../scrapers/kms');
const { scrapeDetail: jacarsDetail } = require('../scrapers/jacars');
const { scrapeDetail: jcoDetail } = require('../scrapers/jco');

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
const BATCH_SIZE = 20;
const STALE_HOURS = 24;

const DETAIL_SCRAPERS = {
  autoadsja: autoadsDetail,
  kms: kmsDetail,
  jacars: jacarsDetail,
  jamaicaonlineclassifieds: jcoDetail,
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

module.exports = { refreshListings };
