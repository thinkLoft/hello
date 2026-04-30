const mongoose = require('mongoose');
const { Schema } = mongoose;

const scraperStatsSchema = new Schema(
  {
    source:  { type: String, required: true, unique: true },
    lastRun: { type: Date },
    scraped: { type: Number, default: 0 },
    saved:   { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    failed:   { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScraperStats', scraperStatsSchema);
