import React from 'react';
import CarCard from './CarCard';
import './CarGrid.css';

export default function CarGrid({ cars, loading, error, onCarClick }) {
  if (loading) {
    return (
      <div className="car-grid__state">
        <div className="car-grid__spinner" />
        <p>Loading listings…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="car-grid__state car-grid__state--error">
        <span>⚠️</span>
        <p>{error}</p>
      </div>
    );
  }

  if (cars.length === 0) {
    return (
      <div className="car-grid__state">
        <span>🔍</span>
        <p>No listings match your filters.</p>
      </div>
    );
  }

  return (
    <div className="car-grid">
      {cars.map((car) => (
        <CarCard key={car._id} car={car} onClick={onCarClick} />
      ))}
    </div>
  );
}
