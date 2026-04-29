import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const TABS = [
  { id: 'all', label: 'All Listings', sub: 'Jamaica' },
  { id: 'forsale', label: 'For Sale', sub: '1M+' },
  { id: 'undermil', label: 'Under 1M', sub: 'Budget' },
  { id: 'classics', label: 'Classics', sub: '10+ yrs' },
  { id: 'calculator', label: 'Price Check', sub: 'Calculator' },
];

export default function Navbar({ activeTab, onTabChange, count }) {
  const [compact, setCompact] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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
        <div className="navbar__auth">
          {user ? (
            <>
              <Link to="/admin" className="navbar__admin-link">⚙️ Admin</Link>
              <button className="navbar__logout-btn" onClick={handleLogout}>Sign Out</button>
            </>
          ) : (
            <Link to="/login" className="navbar__login-link">Sign In</Link>
          )}
        </div>
      </div>
    </header>
  );
}
