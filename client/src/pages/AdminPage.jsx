import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminPage.css';

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="admin-header">
          <h1 className="admin-title">Admin Dashboard</h1>
          <button className="admin-logout-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>

        <div className="admin-card">
          <h2>Current User</h2>
          <p className="admin-email">{user?.email}</p>
          <p className="admin-role">Role: {user?.role}</p>
        </div>

        <div className="admin-card">
          <h2>Features</h2>
          <ul className="admin-features">
            <li>✓ Admin authentication enabled</li>
            <li>✓ Session-based auth (secure httpOnly cookies)</li>
            <li>✓ Rate limiting on login attempts</li>
            <li>✓ CSRF protection</li>
            <li>→ User management (coming soon)</li>
            <li>→ Scraper statistics (coming soon)</li>
            <li>→ Audit logs (coming soon)</li>
          </ul>
        </div>

        <div className="admin-card">
          <h2>Next Steps</h2>
          <p>Browse car listings → click a car → "Mark as Sold" now requires admin authentication.</p>
        </div>
      </div>
    </div>
  );
}
