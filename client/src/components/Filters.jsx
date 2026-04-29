import React, { useState } from 'react';
import './Filters.css';
import { useAuth } from '../context/AuthContext';

const BASE_SORT_OPTIONS = [
  { value: '', label: 'Sort' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'year-new', label: 'Year: Newest' },
  { value: 'date-latest', label: 'Date: Latest' },
];

const ADMIN_SORT_OPTIONS = [
  ...BASE_SORT_OPTIONS,
  { value: 'score-high', label: 'Quality Score: Best First' },
  { value: 'score-low', label: 'Quality Score: Worst First' },
];

const EMPTY_FILTERS = { make: '', bodyType: '', transmission: '', parish: '', search: '', sort: '', minPrice: '', maxPrice: '' };

export default function Filters({ cars, filters, onFilterChange, resultCount }) {
  const { user } = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const sortOptions = user?.role === 'admin' ? ADMIN_SORT_OPTIONS : BASE_SORT_OPTIONS;
  const unique = (key) =>
    [...new Set(cars.map((c) => c[key]).filter(Boolean))].sort();

  const makes = unique('make');
  const bodyTypes = unique('bodyType');
  const transmissions = unique('transmission');
  const parishes = unique('parish');

  const handleChange = (key) => (e) => onFilterChange({ ...filters, [key]: e.target.value });
  const clearAll = () => {
    onFilterChange(EMPTY_FILTERS);
    setShowAdvanced(false);
  };
  const hasFilters = Object.entries(filters).some(([k, v]) => k !== 'sort' && v && v !== '');
  const hasAdvancedFilter = filters.bodyType || filters.transmission || filters.parish;

  return (
    <div className="filters">
      <div className="filters__inner">
        <div className="filters__search-wrap">
          <span className="filters__search-icon">🔍</span>
          <input
            className="filters__search"
            type="search"
            placeholder="Search make, model, year…"
            value={filters.search}
            onChange={handleChange('search')}
          />
        </div>

        <select className="filters__select" value={filters.make} onChange={handleChange('make')}>
          <option value="">All Makes</option>
          {makes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <div className="filters__price-range">
          <input
            className="filters__price-input"
            type="number"
            placeholder="Min price"
            value={filters.minPrice}
            min={0}
            onChange={handleChange('minPrice')}
          />
          <span className="filters__price-sep">–</span>
          <input
            className="filters__price-input"
            type="number"
            placeholder="Max price"
            value={filters.maxPrice}
            min={0}
            onChange={handleChange('maxPrice')}
          />
        </div>

        <select className="filters__select" value={filters.sort ?? ''} onChange={handleChange('sort')}>
          {sortOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        <button
          className={`filters__advanced-toggle${showAdvanced || hasAdvancedFilter ? ' filters__advanced-toggle--active' : ''}`}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          More filters {hasAdvancedFilter ? '•' : (showAdvanced ? '▲' : '▼')}
        </button>

        {hasFilters && (
          <button className="filters__clear" onClick={clearAll}>
            Clear
          </button>
        )}

        <span className="filters__count">{resultCount} results</span>
      </div>

      {showAdvanced && (
        <div className="filters__advanced">
          <div className="filters__advanced-inner">
            <select className="filters__select" value={filters.bodyType} onChange={handleChange('bodyType')}>
              <option value="">All Body Types</option>
              {bodyTypes.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>

            <select className="filters__select" value={filters.transmission} onChange={handleChange('transmission')}>
              <option value="">All Transmissions</option>
              {transmissions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <select className="filters__select" value={filters.parish} onChange={handleChange('parish')}>
              <option value="">All Parishes</option>
              {parishes.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
