import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import Filters from './components/Filters';
import CarGrid from './components/CarGrid';
import CarModal from './components/CarModal';
import PriceCalculator from './components/PriceCalculator';
import { fetchCarsForSale, fetchUnderMil, fetchLatest, fetchCount } from './services/api';
import './App.css';

const FETCHERS = {
  forsale: fetchCarsForSale,
  undermil: fetchUnderMil,
  classics: fetchLatest,
};

const EMPTY_FILTERS = { make: '', bodyType: '', transmission: '', parish: '', search: '' };

export default function App() {
  const [activeTab, setActiveTab] = useState('forsale');
  const [allCars, setAllCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedCar, setSelectedCar] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchCount()
      .then((d) => setTotalCount(d.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'calculator') return;
    const fetcher = FETCHERS[activeTab];
    if (!fetcher) return;

    setLoading(true);
    setError(null);
    setAllCars([]);
    setFilters(EMPTY_FILTERS);

    fetcher()
      .then(setAllCars)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeTab]);

  const filteredCars = useMemo(() => {
    return allCars.filter((car) => {
      if (filters.make && car.make !== filters.make) return false;
      if (filters.bodyType && car.bodyType !== filters.bodyType) return false;
      if (filters.transmission && car.transmission !== filters.transmission) return false;
      if (filters.parish && car.parish !== filters.parish) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${car.year ?? ''} ${car.make ?? ''} ${car.model ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allCars, filters]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedCar(null);
  };

  const isListing = activeTab !== 'calculator';

  return (
    <div className="app">
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} count={totalCount} />

      {isListing && (
        <Filters
          cars={allCars}
          filters={filters}
          onFilterChange={setFilters}
          resultCount={filteredCars.length}
        />
      )}

      <main className="app__main">
        {activeTab === 'calculator' ? (
          <PriceCalculator />
        ) : (
          <CarGrid
            cars={filteredCars}
            loading={loading}
            error={error}
            onCarClick={setSelectedCar}
          />
        )}
      </main>

      {selectedCar && (
        <CarModal car={selectedCar} onClose={() => setSelectedCar(null)} />
      )}
    </div>
  );
}
