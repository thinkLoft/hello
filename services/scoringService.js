const db = require('../models');
const { priceCheck } = require('./priceAnalysis');

const DEFAULT_WEIGHTS = { price: 35, completeness: 25, mileage: 20, source: 10, images: 10 };

const SOURCE_SCORES = {
  autoadsja: 1.0,
  kms: 0.7,
  jamaicaonlineclassifieds: 0.5,
  jacars: 0.3,
};

function parseMileage(str) {
  if (!str) return null;
  const match = String(str).match(/^[\d,]+/);
  if (!match) return null;
  const km = parseInt(match[0].replace(/,/g, ''), 10);
  return km > 0 ? km : null;
}

async function getWeights() {
  try {
    const doc = await db.Settings.findOne({ key: 'scoringWeights' }).lean();
    return doc?.value ?? DEFAULT_WEIGHTS;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

function getPriceBand(price, stats, minCount = 2) {
  if (!price || stats.count < minCount) return null;
  if (price < stats.crazy)  return 'crazy';
  if (price < stats.great)  return 'great';
  if (price < stats.below)  return 'below';
  if (price < stats.above)  return 'good';
  if (price < stats.high)   return 'above';
  return 'high';
}

function scoreListing(doc, priceband, weights) {
  const w = weights;
  const flags = [];
  const breakdown = { price: 0, completeness: 0, mileage: 0, source: 0, images: 0 };

  // Price vs market
  switch (priceband) {
    case 'crazy': flags.push('PRICE_SUSPICIOUSLY_LOW'); break;
    case 'great': breakdown.price = w.price; break;
    case 'below': breakdown.price = Math.round(w.price * 0.80); break;
    case 'good':  breakdown.price = Math.round(w.price * 0.57); break;
    case 'above': breakdown.price = Math.round(w.price * 0.34); break;
    case 'high':  breakdown.price = Math.round(w.price * 0.14); flags.push('PRICE_HIGH'); break;
    default:      flags.push('NO_PRICE_DATA'); break;
  }

  // Data completeness
  if (doc.description?.trim()) breakdown.completeness += Math.round(w.completeness * 0.32);
  if (doc.contactNumber)       breakdown.completeness += Math.round(w.completeness * 0.28);
  if (doc.parish)              breakdown.completeness += Math.round(w.completeness * 0.20);
  if (doc.posted)              breakdown.completeness += Math.round(w.completeness * 0.20);

  // Mileage sanity
  const currentYear = new Date().getFullYear();
  const km = parseMileage(doc.mileage);
  const age = currentYear - (doc.year ?? currentYear);
  if (km === null || age <= 0) {
    flags.push('MILEAGE_MISSING');
  } else {
    const ratio = km / age;
    if (ratio < 1000) {
      breakdown.mileage = Math.round(w.mileage * 0.25);
      flags.push('MILEAGE_SUSPICIOUSLY_LOW');
    } else if (ratio > 30000) {
      breakdown.mileage = Math.round(w.mileage * 0.25);
      flags.push('MILEAGE_HIGH');
    } else if (ratio <= 15000) {
      breakdown.mileage = w.mileage;
    } else {
      breakdown.mileage = Math.round(w.mileage * 0.60);
    }
  }

  // Source credibility
  breakdown.source = Math.round(w.source * (SOURCE_SCORES[doc.user] ?? 0));

  // Image count
  const imgCount = doc.imgs?.length ?? 0;
  if (imgCount === 0)      breakdown.images = 0;
  else if (imgCount <= 2)  breakdown.images = Math.round(w.images * 0.40);
  else if (imgCount <= 5)  breakdown.images = Math.round(w.images * 0.70);
  else                     breakdown.images = w.images;

  const score = Math.min(100, Math.max(0,
    breakdown.price + breakdown.completeness + breakdown.mileage + breakdown.source + breakdown.images
  ));

  return { score, scoreBreakdown: breakdown, anomalyFlags: flags, priceband: priceband ?? null };
}

async function runScoringBatch() {
  try {
    const weights = await getWeights();
    const cars = await db.Cars.find({ sold: { $ne: true } }).lean();

    // Group by make+model (primary) and make (fallback for thin buckets)
    const byMakeModel = {};
    const byMake = {};
    for (const car of cars) {
      const mmKey = `${car.make}|${car.model}`;
      if (!byMakeModel[mmKey]) byMakeModel[mmKey] = [];
      byMakeModel[mmKey].push(car);
      const mKey = car.make ?? '__unknown__';
      if (!byMake[mKey]) byMake[mKey] = [];
      byMake[mKey].push(car);
    }
    const makeStats = {};
    for (const [make, group] of Object.entries(byMake)) {
      makeStats[make] = priceCheck(group);
    }

    const ops = [];
    for (const [mmKey, group] of Object.entries(byMakeModel)) {
      const mmStats = priceCheck(group);
      const make = mmKey.split('|')[0];
      for (const car of group) {
        // Prefer make+model band (min 2); fall back to make-only (min 3)
        const band =
          getPriceBand(car.price, mmStats, 2) ??
          getPriceBand(car.price, makeStats[make ?? '__unknown__'] ?? { count: 0 }, 3);
        const result = scoreListing(car, band, weights);
        ops.push({
          updateOne: {
            filter: { _id: car._id },
            update: {
              $set: {
                score: result.score,
                scoreBreakdown: result.scoreBreakdown,
                anomalyFlags: result.anomalyFlags,
                priceband: result.priceband,
              },
            },
          },
        });
      }
    }

    if (ops.length > 0) {
      await db.Cars.bulkWrite(ops);
      console.log(`[Scoring] Scored ${ops.length} listings`);
    }
  } catch (err) {
    console.error('[Scoring] Batch error:', err.message);
  }
}

module.exports = { parseMileage, scoreListing, runScoringBatch, getWeights, DEFAULT_WEIGHTS };
