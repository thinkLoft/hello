require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('[pushToProd] Connected to prod DB');

  require('../models');
  const { loadMakeDb } = require('../services/validator');
  await loadMakeDb();

  const { scrape: jacarsScrape } = require('../scrapers/jacars');
  const { scrape: jcoScrape } = require('../scrapers/jco');
  const { closeBrowser } = require('../scrapers/browser');

  const results = {};

  console.log('[pushToProd] Running JaCars…');
  results.jacars = await jacarsScrape().catch(e => ({ error: e.message }));
  await closeBrowser();

  console.log('[pushToProd] Running JCO…');
  results.jco = await jcoScrape(process.env.SITE3).catch(e => ({ error: e.message }));
  await closeBrowser();

  console.log(JSON.stringify(results, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('[pushToProd] fatal:', e.message); process.exit(1); });
