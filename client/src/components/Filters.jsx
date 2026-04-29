import React from 'react';
import './Filters.css';
import { useAuth } from '../context/AuthContext';

const BASE_SORT_OPTIONS = [
  { value: '', label: 'Default' },
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

export default function Filters({ cars, filters, onFilterChange, resultCount }) {
  const { user } = useAuth();
  const sortOptions = user?.role === 'admin' ? ADMIN_SORT_OPTIONS : BASE_SORT_OPTIONS;
  const unique = (key) =>
    [...new Set(cars.map((c) => c[key]).filter(Boolean))].sort();

  const makes = unique('make');
  const bodyTypes = unique('bodyType');
  const transmissions = unique('transmission');
  const parishes = unique('parish');

  const handleChange = (key) => (e) => onFilterChange({ ...filters, [key]: e.target.value });
  const clearAll = () => onFilterChange({ make: '', bodyType: '', transmission: '', parish: '', search: '', sort: '' });
  const hasFilters = Object.values(filters).some((v) => v && v !== '');

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

        <select className="filters__select" value={filters.sort ?? ''} onChange={handleChange('sort')}>
          {sortOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        {hasFilters && (
          <button className="filters__clear" onClick={clearAll}>
            Clear filters
          </button>
        )}

        <span className="filters__count">{resultCount} results</span>
      </div>
    </div>
  );
}
