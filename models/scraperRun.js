const mongoose = require('mongoose');
const { Schema } = mongoose;

const scraperRunSchema = new Schema(
  {
    source:     { type: String, required: true },
    startedAt:  { type: Date, required: true },
    finishedAt: { type: Date },
    scraped:    { type: Number, default: 0 },
    saved:      { type: Number, default: 0 },
    skipped:    { type: Number, default: 0 },
    failed:     { type: Number, default: 0 },
  },
  { capped: { size: 5_000_000, max: 500 } }
);

module.exports = mongoose.model('ScraperRun', scraperRunSchema);
