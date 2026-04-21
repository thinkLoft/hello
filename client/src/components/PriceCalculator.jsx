import React, { useState } from 'react';
import { fetchPriceData } from '../services/api';
import './PriceCalculator.css';

const currentYear = new Date().getFullYear();

const fmt = (n) =>
  new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: 'JMD',
    maximumFractionDigits: 0,
  }).format(n);

const BANDS = [
  { key: 'crazy', label: 'Exceptional Deal', emoji: '🔥', color: '#059669', desc: 'Extremely rare — buy immediately' },
  { key: 'great', label: 'Great Deal', emoji: '✅', color: '#16a34a', desc: 'Well below market average' },
  { key: 'below', label: 'Good Price', emoji: '👍', color: '#65a30d', desc: 'Below average — solid value' },
  { key: 'average', label: 'Market Average', emoji: '📊', color: '#d97706', desc: 'Typical price for this vehicle' },
  { key: 'above', label: 'Above Average', emoji: '💰', color: '#ea580c', desc: 'Higher than typical — negotiate' },
  { key: 'high', label: 'High Price', emoji: '⚠️', color: '#dc2626', desc: 'Significantly above market' },
];

export default function PriceCalculator() {
  const [form, setForm] = useState({
    make: '',
    model: '',
    yearLower: currentYear - 4,
    yearUpper: currentYear,
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.make || !form.model) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await fetchPriceData(
        form.yearUpper,
        form.yearLower,
        form.make,
        form.model
      );
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="calculator">
      <div className="calculator__inner">
        <div className="calculator__hero">
          <h2 className="calculator__title">Price Calculator</h2>
          <p className="calculator__subtitle">
            Find the fair market value for any car in Jamaica, based on real listings in our database.
          </p>
        </div>

        <form className="calculator__form" onSubmit={handleSubmit}>
          <div className="calculator__field">
            <label className="calculator__label">Make</label>
            <input
              className="calculator__input"
              type="text"
              placeholder="e.g. Toyota"
              value={form.make}
              onChange={handleChange('make')}
              required
            />
          </div>
          <div className="calculator__field">
            <label className="calculator__label">Model</label>
            <input
              className="calculator__input"
              type="text"
              placeholder="e.g. Corolla"
              value={form.model}
              onChange={handleChange('model')}
              required
            />
          </div>
          <div className="calculator__field">
            <label className="calculator__label">Year From</label>
            <input
              className="calculator__input"
              type="number"
              min="1935"
              max={currentYear}
              value={form.yearLower}
              onChange={handleChange('yearLower')}
            />
          </div>
          <div className="calculator__field">
            <label className="calculator__label">Year To</label>
            <input
              className="calculator__input"
              type="number"
              min="1935"
              max={currentYear + 1}
              value={form.yearUpper}
              onChange={handleChange('yearUpper')}
            />
          </div>
          <button className="calculator__submit" type="submit" disabled={loading}>
            {loading ? 'Searching…' : 'Check Price'}
          </button>
        </form>

        {error && (
          <div className="calculator__error">⚠️ {error}</div>
        )}

        {data && data.count === 0 && (
          <div className="calculator__empty">
            No listings found for {form.yearLower}–{form.yearUpper} {form.make} {form.model}.
            Try broadening your year range.
          </div>
        )}

        {data && data.count > 0 && (
          <div className="calculator__results">
            <div className="calculator__results-header">
              <h3>
                {form.yearLower}–{form.yearUpper} {form.make} {form.model}
              </h3>
              <span className="calculator__results-count">
                Based on {data.count} listing{data.count !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="calculator__bands">
              {BANDS.map(({ key, label, emoji, color, desc }) => {
                const value = data[key];
                const isAverage = key === 'average';
                return (
                  <div
                    key={key}
                    className={`calculator__band${isAverage ? ' calculator__band--highlight' : ''}`}
                    style={{ '--band-color': color }}
                  >
                    <span className="calculator__band-emoji">{emoji}</span>
                    <div className="calculator__band-info">
                      <span className="calculator__band-label">{label}</span>
                      <span className="calculator__band-desc">{desc}</span>
                    </div>
                    <span className="calculator__band-value">{fmt(value)}</span>
                  </div>
                );
              })}
            </div>

            <p className="calculator__disclaimer">
              Prices in Jamaican dollars. Based on active listings — not a guarantee of value.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
