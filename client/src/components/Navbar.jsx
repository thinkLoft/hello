import React, { useState, useEffect } from 'react';
import './Navbar.css';

const TABS = [
  { id: 'forsale', label: 'For Sale', sub: '1M+' },
  { id: 'undermil', label: 'Under 1M', sub: 'Budget' },
  { id: 'classics', label: 'Classics', sub: '10+ yrs' },
  { id: 'calculator', label: 'Price Check', sub: 'Calculator' },
];

export default function Navbar({ activeTab, onTabChange, count }) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`navbar${compact ? ' navbar--compact' : ''}`}>
      <div className="navbar__inner">
        <div className="navbar__brand">
          <span className="navbar__logo">🚗</span>
          <div>
            <span className="navbar__name">Beego</span>
            <span className="navbar__tagline">Jamaica Car Listings</span>
          </div>
          {count > 0 && (
            <span className="navbar__count">{count.toLocaleString()} listings</span>
          )}
        </div>
        <nav className="navbar__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`navbar__tab${activeTab === tab.id ? ' navbar__tab--active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="navbar__tab-label">{tab.label}</span>
              <span className="navbar__tab-sub">{tab.sub}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
