import React, { useRef, useEffect } from 'react';
import CarCard from './CarCard';
import './CarGrid.css';

export default function CarGrid({ cars, loading, error, onCarClick, emptyMessage, soldIds, hasMore, onLoadMore }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore(); },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

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
        <p>{emptyMessage ?? 'No listings match your filters.'}</p>
      </div>
    );
  }

  return (
    <div className="car-grid">
      {cars.map((car) => (
        <CarCard key={car._id} car={car} onClick={onCarClick} sold={soldIds?.has(car._id)} />
      ))}
      {hasMore && <div ref={sentinelRef} className="car-grid__sentinel" />}
    </div>
  );
}
