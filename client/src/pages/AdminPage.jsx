import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminPage.css';

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 1) {
      setPasswordError('Password cannot be empty');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        setPasswordError(err.error || 'Failed to change password');
        return;
      }

      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
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
          <button
            className="admin-password-btn"
            onClick={() => setShowPasswordForm(!showPasswordForm)}
          >
            {showPasswordForm ? 'Cancel' : '🔐 Change Password'}
          </button>
        </div>

        {showPasswordForm && (
          <div className="admin-card">
            <h2>Change Password</h2>
            <form onSubmit={handlePasswordChange} className="admin-form">
              {passwordError && <div className="admin-error">{passwordError}</div>}
              {passwordSuccess && <div className="admin-success">{passwordSuccess}</div>}

              <div className="admin-field">
                <label>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={passwordLoading}
                />
              </div>

              <div className="admin-field">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={passwordLoading}
                />
              </div>

              <div className="admin-field">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={passwordLoading}
                />
              </div>

              <button type="submit" className="admin-submit-btn" disabled={passwordLoading}>
                {passwordLoading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        <div className="admin-card">
          <h2>Features</h2>
          <ul className="admin-features">
            <li>✓ Admin authentication enabled</li>
            <li>✓ Session-based auth (secure httpOnly cookies)</li>
            <li>✓ Rate limiting on login attempts</li>
            <li>✓ Change password feature</li>
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
