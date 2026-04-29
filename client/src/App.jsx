import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Filters from './components/Filters';
import CarGrid from './components/CarGrid';
import CarModal from './components/CarModal';
import PriceCalculator from './components/PriceCalculator';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import { fetchCarsForSale, fetchUnderMil, fetchLatest, fetchCount, markAsSold, updateListing, hideListing } from './services/api';
import './App.css';

const FETCHERS = {
  forsale: fetchCarsForSale,
  undermil: fetchUnderMil,
  classics: fetchLatest,
};

const EMPTY_FILTERS = { make: '', bodyType: '', transmission: '', parish: '', search: '', sort: '', minPrice: '', maxPrice: '' };
const PAGE_SIZE = 24;

function HomePage() {
  const [activeTab, setActiveTab] = useState('forsale');
  const [allCars, setAllCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedCar, setSelectedCar] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [soldIds, setSoldIds] = useState(new Set());
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
    setVisibleCount(PAGE_SIZE);

    fetcher()
      .then(setAllCars)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeTab]);

  const filteredCars = useMemo(() => {
    const minP = filters.minPrice ? Number(filters.minPrice) : null;
    const maxP = filters.maxPrice ? Number(filters.maxPrice) : null;
    let result = allCars.filter((car) => {
      if (hiddenIds.has(car._id)) return false;
      if (filters.make && car.make !== filters.make) return false;
      if (filters.bodyType && car.bodyType !== filters.bodyType) return false;
      if (filters.transmission && car.transmission !== filters.transmission) return false;
      if (filters.parish && car.parish !== filters.parish) return false;
      if (minP !== null && (car.price ?? 0) < minP) return false;
      if (maxP !== null && (car.price ?? 0) > maxP) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${car.year ?? ''} ${car.make ?? ''} ${car.model ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (filters.sort) {
      switch (filters.sort) {
        case 'price-low':
          result.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
          break;
        case 'price-high':
          result.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
          break;
        case 'year-new':
          result.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
          break;
        case 'date-latest':
          result.sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0));
          break;
        case 'score-high':
          result.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
          break;
        case 'score-low':
          result.sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
          break;
        default:
          break;
      }
    }

    return result;
  }, [allCars, filters]);

  const visibleCars = useMemo(() => filteredCars.slice(0, visibleCount), [filteredCars, visibleCount]);
  const hasMore = visibleCount < filteredCars.length;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedCar(null);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setVisibleCount(PAGE_SIZE);
  };

  const handleSold = async (car) => {
    await markAsSold(car._id);
    setSoldIds((prev) => new Set([...prev, car._id]));
  };

  const handleUpdate = (updated) => {
    setAllCars((prev) => prev.map((c) => c._id === updated._id ? { ...c, ...updated } : c));
    setSelectedCar((prev) => prev?._id === updated._id ? { ...prev, ...updated } : prev);
  };

  const handleHide = async (car) => {
    await hideListing(car._id, true);
    setHiddenIds((prev) => new Set([...prev, car._id]));
    setSelectedCar(null);
  };

  const handleModalClose = () => {
    if (selectedCar && soldIds.has(selectedCar._id)) {
      setAllCars((prev) => prev.filter((c) => c._id !== selectedCar._id));
      setSoldIds((prev) => { const s = new Set(prev); s.delete(selectedCar._id); return s; });
    }
    setSelectedCar(null);
  };

  const handleLoadMore = useCallback(() => setVisibleCount((n) => n + PAGE_SIZE), []);

  const isListing = activeTab !== 'calculator';

  return (
    <div className="app">
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} count={totalCount} />

      {isListing && (
        <Filters
          cars={allCars}
          filters={filters}
          onFilterChange={handleFilterChange}
          resultCount={filteredCars.length}
        />
      )}

      <main className="app__main">
        {activeTab === 'calculator' ? (
          <PriceCalculator />
        ) : (
          <CarGrid
            cars={visibleCars}
            loading={loading}
            error={error}
            onCarClick={setSelectedCar}
            soldIds={soldIds}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            emptyMessage={
              allCars.length === 0
                ? 'No listings yet — scrapers are still populating the database.'
                : 'No listings match your filters.'
            }
          />
        )}
      </main>

      {selectedCar && (
        <CarModal car={selectedCar} onClose={handleModalClose} onSold={handleSold} onUpdate={handleUpdate} onHide={handleHide} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminPage /></ProtectedRoute>} />
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
