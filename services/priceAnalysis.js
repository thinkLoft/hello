const stats = require('stats-lite');

function priceCheck(docs) {
  const prices = docs.map((d) => d.price).filter(Boolean);
  if (prices.length === 0) return { count: 0, total: 0, average: 0, std: 0 };

  const average = stats.mean(prices);
  const std = stats.stdev(prices);

  return {
    count: docs.length,
    total: prices.reduce((a, b) => a + b, 0),
    average,
    std,
    high: average + std * 2,
    above: average + std,
    below: average - std,
    great: average - std * 2,
    crazy: average - std * 3,
  };
}

module.exports = { priceCheck };
