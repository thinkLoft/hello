const mongoose = require('mongoose');
const { Schema } = mongoose;

const scraperRunSchema = new Schema({
  source:     { type: String, required: true, index: true },
  startedAt:  { type: Date, required: true },
  finishedAt: { type: Date },
  scraped:    { type: Number, default: 0 },
  saved:      { type: Number, default: 0 },
  skipped:    { type: Number, default: 0 },
  failed:     { type: Number, default: 0 },
});

// Sort support + TTL auto-expiry after 90 days
scraperRunSchema.index({ startedAt: -1 });
scraperRunSchema.index({ startedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('ScraperRun', scraperRunSchema);
