import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchScraperStats,
  fetchScoringWeights,
  updateScoringWeights,
  triggerRescore,
} from '../services/api';
import './AdminPage.css';

const WEIGHT_KEYS = ['price', 'completeness', 'mileage', 'source', 'images'];
const WEIGHT_LABELS = {
  price: 'Price vs Market',
  completeness: 'Data Completeness',
  mileage: 'Mileage Sanity',
  source: 'Source Credibility',
  images: 'Image Count',
};

function formatDate(iso) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-JM', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Change password
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Scraper stats
  const [scraperStats, setScraperStats] = useState(null);
  const [scraperStatsError, setScraperStatsError] = useState('');

  // Bulk rescore
  const [rescoreLoading, setRescoreLoading] = useState(false);
  const [rescoreResult, setRescoreResult] = useState(null);
  const [rescoreError, setRescoreError] = useState('');

  // Scoring weights
  const [weights, setWeights] = useState(null);
  const [weightsLoading, setWeightsLoading] = useState(true);
  const [weightsSaving, setWeightsSaving] = useState(false);
  const [weightsError, setWeightsError] = useState('');
  const [weightsSuccess, setWeightsSuccess] = useState('');

  useEffect(() => {
    fetchScraperStats()
      .then(setScraperStats)
      .catch(() => setScraperStatsError('Could not load scraper stats'));

    fetchScoringWeights()
      .then(setWeights)
      .catch(() => setWeightsError('Could not load weights'))
      .finally(() => setWeightsLoading(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
    if (newPassword.length < 1) { setPasswordError('Password cannot be empty'); return; }
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
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => { setShowPasswordForm(false); setPasswordSuccess(''); }, 2000);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const weightTotal = weights
    ? WEIGHT_KEYS.reduce((sum, k) => sum + (Number(weights[k]) || 0), 0)
    : 0;

  const handleWeightChange = (key, val) => {
    setWeights((w) => ({ ...w, [key]: Number(val) }));
    setWeightsError('');
    setWeightsSuccess('');
  };

  const handleRescore = async () => {
    setRescoreLoading(true);
    setRescoreResult(null);
    setRescoreError('');
    try {
      const result = await triggerRescore();
      setRescoreResult(result);
    } catch (err) {
      setRescoreError(err.message);
    } finally {
      setRescoreLoading(false);
    }
  };

  const handleWeightsSave = async (e) => {
    e.preventDefault();
    setWeightsError('');
    setWeightsSuccess('');
    if (Math.abs(weightTotal - 100) > 0.01) {
      setWeightsError(`Weights must sum to 100 (currently ${weightTotal})`);
      return;
    }
    setWeightsSaving(true);
    try {
      const updated = await updateScoringWeights(weights);
      setWeights(updated);
      setWeightsSuccess('Weights saved — scores will update on next scrape run');
    } catch (err) {
      setWeightsError(err.message);
    } finally {
      setWeightsSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="admin-header">
          <button className="admin-back-btn" onClick={() => navigate('/')}>← Listings</button>
          <h1 className="admin-title">Admin Dashboard</h1>
          <button className="admin-logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>

        {/* Current User */}
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
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" required disabled={passwordLoading} />
              </div>
              <div className="admin-field">
                <label>New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required disabled={passwordLoading} />
              </div>
              <div className="admin-field">
                <label>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required disabled={passwordLoading} />
              </div>
              <button type="submit" className="admin-submit-btn" disabled={passwordLoading}>
                {passwordLoading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {/* Scraper Health */}
        <div className="admin-card">
          <h2>Scraper Health</h2>
          {scraperStatsError && <div className="admin-error">{scraperStatsError}</div>}
          {!scraperStats && !scraperStatsError && (
            <p className="admin-muted">Loading…</p>
          )}
          {scraperStats && scraperStats.length === 0 && (
            <p className="admin-muted">No scraper runs recorded yet. Stats appear after the next cron tick.</p>
          )}
          {scraperStats && scraperStats.length > 0 && (
            <div className="scraper-stats-table">
              <div className="scraper-stats-row scraper-stats-header">
                <span>Source</span>
                <span>Last Run</span>
                <span>Scraped</span>
                <span>Saved</span>
                <span>Skipped</span>
                <span>Failed</span>
              </div>
              {scraperStats.map((s) => (
                <div key={s.source} className="scraper-stats-row">
                  <span className="scraper-source">{s.source}</span>
                  <span className="scraper-date">{formatDate(s.lastRun)}</span>
                  <span>{s.scraped}</span>
                  <span className="stat-saved">{s.saved}</span>
                  <span className="stat-skipped">{s.skipped}</span>
                  <span className={s.failed > 0 ? 'stat-failed' : ''}>{s.failed}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data Quality */}
        <div className="admin-card">
          <h2>Data Quality</h2>
          <p className="admin-muted" style={{ marginBottom: '1rem' }}>
            Re-score all active listings using the current weights and market data. Run this after adjusting weights or fixing scraper selector gaps.
          </p>
          {rescoreError && <div className="admin-error" style={{ marginBottom: '0.75rem' }}>{rescoreError}</div>}
          {rescoreResult && (
            <div className="admin-success" style={{ marginBottom: '0.75rem' }}>
              Scored {rescoreResult.scored} listings — {new Date().toLocaleTimeString()}
            </div>
          )}
          <button
            className="admin-submit-btn"
            onClick={handleRescore}
            disabled={rescoreLoading}
          >
            {rescoreLoading ? 'Rescoring…' : 'Re-score All Listings'}
          </button>
        </div>

        {/* Scoring Weights */}
        <div className="admin-card">
          <h2>Scoring Weights</h2>
          <p className="admin-muted" style={{ marginBottom: '1rem' }}>
            Each listing is scored 0–100. Adjust how much each component contributes. Weights must sum to 100.
          </p>
          {weightsLoading && <p className="admin-muted">Loading…</p>}
          {!weightsLoading && weights && (
            <form onSubmit={handleWeightsSave} className="admin-form">
              {weightsError && <div className="admin-error">{weightsError}</div>}
              {weightsSuccess && <div className="admin-success">{weightsSuccess}</div>}
              {WEIGHT_KEYS.map((key) => (
                <div key={key} className="weight-row">
                  <label className="weight-label">{WEIGHT_LABELS[key]}</label>
                  <div className="weight-input-group">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={weights[key] ?? 0}
                      onChange={(e) => handleWeightChange(key, e.target.value)}
                      className="weight-slider"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={weights[key] ?? 0}
                      onChange={(e) => handleWeightChange(key, e.target.value)}
                      className="weight-number"
                    />
                  </div>
                </div>
              ))}
              <div className={`weight-total ${Math.abs(weightTotal - 100) > 0.01 ? 'weight-total--invalid' : 'weight-total--valid'}`}>
                Total: {weightTotal} / 100
              </div>
              <button
                type="submit"
                className="admin-submit-btn"
                disabled={weightsSaving || Math.abs(weightTotal - 100) > 0.01}
              >
                {weightsSaving ? 'Saving…' : 'Save Weights'}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
