import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchScraperStats,
  fetchScraperRuns,
  fetchFailedUrls,
  fetchRejections,
  triggerScrape,
  fetchScoringWeights,
  updateScoringWeights,
  triggerRescore,
  triggerRefresh,
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
  const [expandedSource, setExpandedSource] = useState(null);
  const [runsCache, setRunsCache] = useState({});
  const [runsLoading, setRunsLoading] = useState(false);

  // Bulk rescore
  const [rescoreLoading, setRescoreLoading] = useState(false);
  const [rescoreResult, setRescoreResult] = useState(null);
  const [rescoreError, setRescoreError] = useState('');

  // Listing refresh
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);
  const [refreshError, setRefreshError] = useState('');

  // Admin notes
  const [notes, setNotes] = useState(() => localStorage.getItem('adminNotes') ?? '');
  const [notesSaved, setNotesSaved] = useState(false);

  const handleNotesSave = () => {
    localStorage.setItem('adminNotes', notes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 1500);
  };

  // Revenue plan
  const [showRevenuePlan, setShowRevenuePlan] = useState(false);

  // Memory log
  const [memLog, setMemLog] = useState([]);

  // Manual scraper triggers (keyed by source)
  const [runNowLoading, setRunNowLoading] = useState({});
  const [runNowResult, setRunNowResult] = useState({});
  const [runNowError, setRunNowError] = useState({});

  // Rejection histograms (keyed by source)
  const [rejectionsData, setRejectionsData] = useState({});
  const [rejectionsLoading, setRejectionsLoading] = useState({});

  // Failed URL drilldown (keyed by run _id)
  const [failedUrlsData, setFailedUrlsData] = useState({});
  const [failedUrlsLoading, setFailedUrlsLoading] = useState({});

  // Push JaCars/JCO to prod
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState(null);
  const [pushError, setPushError] = useState('');

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

    fetch('/api/health/memory', { credentials: 'include' })
      .then((r) => r.json())
      .then(setMemLog)
      .catch(() => {});
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

  const handleRefresh = async () => {
    setRefreshLoading(true);
    setRefreshResult(null);
    setRefreshError('');
    try {
      const result = await triggerRefresh();
      setRefreshResult(result);
    } catch (err) {
      setRefreshError(err.message);
    } finally {
      setRefreshLoading(false);
    }
  };

  const handlePushToProd = async () => {
    setPushing(true);
    setPushResult(null);
    setPushError('');
    try {
      const res = await fetch('/api/scrape/push-to-prod', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        setPushError(err.error || 'Failed to start push');
        return;
      }
      setPushResult('Started — check server terminal for progress logs');
      setTimeout(() => setPushing(false), 30000);
    } catch (err) {
      setPushError(err.message);
      setPushing(false);
    }
  };

  const handleRunNow = async (source) => {
    setRunNowLoading((p) => ({ ...p, [source]: true }));
    setRunNowResult((p) => ({ ...p, [source]: null }));
    setRunNowError((p) => ({ ...p, [source]: '' }));
    try {
      const res = await triggerScrape(source);
      setRunNowResult((p) => ({ ...p, [source]: res.stats }));
      // Refresh stats table and bust the runs cache so new run appears
      fetchScraperStats().then(setScraperStats).catch(() => {});
      setRunsCache((c) => { const next = { ...c }; delete next[source]; return next; });
    } catch (err) {
      setRunNowError((p) => ({ ...p, [source]: err.message }));
    } finally {
      setRunNowLoading((p) => ({ ...p, [source]: false }));
    }
  };

  const handleViewRejections = async (source) => {
    if (rejectionsData[source]) {
      setRejectionsData((p) => { const next = { ...p }; delete next[source]; return next; });
      return;
    }
    setRejectionsLoading((p) => ({ ...p, [source]: true }));
    try {
      const data = await fetchRejections(source, 72);
      setRejectionsData((p) => ({ ...p, [source]: data }));
    } catch {
      setRejectionsData((p) => ({ ...p, [source]: { byCode: {}, byComment: {} } }));
    } finally {
      setRejectionsLoading((p) => ({ ...p, [source]: false }));
    }
  };

  const handleToggleFailedUrls = async (runId) => {
    if (failedUrlsData[runId]) {
      setFailedUrlsData((p) => { const next = { ...p }; delete next[runId]; return next; });
      return;
    }
    setFailedUrlsLoading((p) => ({ ...p, [runId]: true }));
    try {
      const data = await fetchFailedUrls(runId);
      setFailedUrlsData((p) => ({ ...p, [runId]: data.failedUrls || [] }));
    } catch {
      setFailedUrlsData((p) => ({ ...p, [runId]: [] }));
    } finally {
      setFailedUrlsLoading((p) => ({ ...p, [runId]: false }));
    }
  };

  const handleToggleRuns = async (source) => {
    if (expandedSource === source) { setExpandedSource(null); return; }
    setExpandedSource(source);
    if (runsCache[source]) return;
    setRunsLoading(true);
    try {
      const runs = await fetchScraperRuns(source);
      setRunsCache((c) => ({ ...c, [source]: runs }));
    } catch {
      setRunsCache((c) => ({ ...c, [source]: [] }));
    } finally {
      setRunsLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="admin-header">
          <button className="admin-back-btn" onClick={() => navigate('/')}>← Listings</button>
          <h1 className="admin-title">Admin Dashboard</h1>
          <button
            className="admin-back-btn"
            onClick={() => setShowRevenuePlan((v) => !v)}
          >
            {showRevenuePlan ? '← Back to Admin' : 'Revenue Action Plan'}
          </button>
          <button className="admin-logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>

        {showRevenuePlan && (
          <iframe
            src="/revenue-action-plan.html"
            style={{ width: '100%', height: '80vh', border: 'none', borderRadius: '8px', marginTop: '1rem' }}
            title="Revenue Action Plan"
          />
        )}

        {!showRevenuePlan && (
        <>{/* Current User */}
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
                <span>Active</span>
                <span>Scraped</span>
                <span>Saved</span>
                <span>Skipped</span>
                <span>Failed</span>
                <span>Rejected</span>
              </div>
              {scraperStats.map((s) => (
                <React.Fragment key={s.source}>
                  <div
                    className="scraper-stats-row scraper-stats-row--clickable"
                    onClick={() => handleToggleRuns(s.source)}
                    title="Click to view run history"
                  >
                    <span className="scraper-source">
                      {expandedSource === s.source ? '▾' : '▸'} {s.source}
                    </span>
                    <span className="scraper-date">{formatDate(s.lastRun)}</span>
                    <span className="stat-saved">{s.activeListings ?? 0}</span>
                    <span>{s.scraped}</span>
                    <span className="stat-saved">{s.saved}</span>
                    <span className="stat-skipped">{s.skipped}</span>
                    <span className={s.failed > 0 ? 'stat-failed' : ''}>{s.failed}</span>
                    <span className={s.rejected > 0 ? 'stat-skipped' : ''}>{s.rejected ?? 0}</span>
                  </div>
                  {expandedSource === s.source && (
                    <div className="scraper-runs-panel">
                      {/* Run Now controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                          className="admin-submit-btn"
                          style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem', marginTop: 0 }}
                          onClick={(e) => { e.stopPropagation(); handleRunNow(s.source); }}
                          disabled={runNowLoading[s.source]}
                        >
                          {runNowLoading[s.source] ? 'Running…' : 'Run Now'}
                        </button>
                        <button
                          className="admin-submit-btn"
                          style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem', marginTop: 0, background: 'var(--border, #374151)' }}
                          onClick={(e) => { e.stopPropagation(); handleViewRejections(s.source); }}
                          disabled={rejectionsLoading[s.source]}
                        >
                          {rejectionsLoading[s.source] ? 'Loading…' : rejectionsData[s.source] ? 'Hide Rejections' : 'View Rejections (72h)'}
                        </button>
                      </div>
                      {runNowError[s.source] && (
                        <div className="admin-error" style={{ marginBottom: '0.5rem' }}>{runNowError[s.source]}</div>
                      )}
                      {runNowResult[s.source] && (() => {
                        const r = runNowResult[s.source];
                        return (
                          <div className="admin-success" style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                            Done — scraped {r.scraped}, saved {r.saved}, skipped {r.skipped}, failed {r.failed}, rejected {r.rejected ?? 0}
                          </div>
                        );
                      })()}

                      {/* Rejection histogram */}
                      {rejectionsData[s.source] && (() => {
                        const { byCode } = rejectionsData[s.source];
                        const entries = Object.entries(byCode).sort((a, b) => b[1] - a[1]);
                        return entries.length === 0 ? (
                          <p className="admin-muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>No rejections in last 72h.</p>
                        ) : (
                          <div style={{ marginBottom: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', padding: '0.6rem 0.75rem' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.4rem', opacity: 0.7 }}>Rejection reasons (72h)</p>
                            {entries.map(([code, count]) => (
                              <div key={code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '0.15rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ opacity: 0.85 }}>{code}</span>
                                <span style={{ fontWeight: 600 }}>{count}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Run history table */}
                      {runsLoading && !runsCache[s.source] ? (
                        <p className="admin-muted">Loading run history…</p>
                      ) : (runsCache[s.source] ?? []).length === 0 ? (
                        <p className="admin-muted">No run history recorded.</p>
                      ) : (
                        <div className="scraper-runs-table">
                          <div className="scraper-runs-row scraper-runs-header">
                            <span>Started</span>
                            <span>Duration</span>
                            <span>Scraped</span>
                            <span>Saved</span>
                            <span>Skipped</span>
                            <span>Failed</span>
                            <span>Rejected</span>
                          </div>
                          {(runsCache[s.source] ?? []).map((r) => {
                            const durationMs = r.finishedAt && r.startedAt
                              ? new Date(r.finishedAt) - new Date(r.startedAt)
                              : null;
                            const duration = durationMs != null
                              ? durationMs < 60000
                                ? `${Math.round(durationMs / 1000)}s`
                                : `${Math.round(durationMs / 60000)}m`
                              : '—';
                            const hasFailed = r.failed > 0;
                            return (
                              <React.Fragment key={r._id}>
                                <div className="scraper-runs-row">
                                  <span>{formatDate(r.startedAt)}</span>
                                  <span>{duration}</span>
                                  <span>{r.scraped}</span>
                                  <span className="stat-saved">{r.saved}</span>
                                  <span className="stat-skipped">{r.skipped}</span>
                                  <span
                                    className={hasFailed ? 'stat-failed' : ''}
                                    style={hasFailed ? { cursor: 'pointer', textDecoration: 'underline dotted' } : {}}
                                    title={hasFailed ? 'Click to view failed URLs' : undefined}
                                    onClick={hasFailed ? (e) => { e.stopPropagation(); handleToggleFailedUrls(r._id); } : undefined}
                                  >
                                    {hasFailed ? (failedUrlsData[r._id] ? '▾' : '▸') : ''} {r.failed}
                                  </span>
                                  <span className={r.rejected > 0 ? 'stat-skipped' : ''}>{r.rejected ?? 0}</span>
                                </div>
                                {failedUrlsData[r._id] && (
                                  <div style={{ gridColumn: '1 / -1', background: 'rgba(220,38,38,0.08)', borderRadius: '4px', padding: '0.5rem 0.75rem', marginBottom: '0.25rem' }}>
                                    {failedUrlsLoading[r._id] ? (
                                      <p className="admin-muted" style={{ fontSize: '0.78rem' }}>Loading…</p>
                                    ) : failedUrlsData[r._id].length === 0 ? (
                                      <p className="admin-muted" style={{ fontSize: '0.78rem' }}>No failed URL details stored.</p>
                                    ) : (
                                      failedUrlsData[r._id].map((f, i) => (
                                        <div key={i} style={{ fontSize: '0.75rem', padding: '0.2rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                          <a href={f.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent, #60a5fa)', wordBreak: 'break-all', flex: 1 }}>{f.url}</a>
                                          <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>{f.reason}</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Push to Prod — local only */}
        {window.location.hostname === 'localhost' && (
        <div className="admin-card">
          <h2>Push JaCars / JCO → Prod</h2>
          <p className="admin-muted" style={{ marginBottom: '1rem' }}>
            Runs JaCars and JCO scrapers locally (Puppeteer on your machine) and writes results directly to the prod Atlas DB. Skipped on Heroku — button only appears on localhost.
          </p>
          {pushError && <div className="admin-error" style={{ marginBottom: '0.75rem' }}>{pushError}</div>}
          {pushResult && <div className="admin-success" style={{ marginBottom: '0.75rem' }}>{pushResult}</div>}
          <button
            className="admin-submit-btn"
            onClick={handlePushToProd}
            disabled={pushing}
          >
            {pushing ? 'Running… (check server logs)' : 'Push JaCars / JCO → Prod'}
          </button>
        </div>
        )}

        {/* Memory Usage */}
        <div className="admin-card">
          <h2>Dyno Memory Usage</h2>
          <p className="admin-muted" style={{ marginBottom: '0.75rem' }}>
            Sampled every 5 min. Resets on dyno restart. Limit: 512 MB (Basic dyno).
          </p>
          {memLog.length === 0 ? (
            <p className="admin-muted">No samples yet — data appears after the first 5-minute interval.</p>
          ) : (
            <div className="scraper-stats-table">
              <div className="scraper-stats-row scraper-stats-header">
                <span>Time</span>
                <span>RSS</span>
                <span>Heap Used</span>
                <span>Heap Total</span>
                <span>Status</span>
              </div>
              {[...memLog].reverse().map((m) => {
                const rss = Math.round(m.rss / 1024 / 1024);
                const heapUsed = Math.round(m.heapUsed / 1024 / 1024);
                const heapTotal = Math.round(m.heapTotal / 1024 / 1024);
                const warn = rss > 420;
                return (
                  <div key={m.ts} className="scraper-stats-row" style={warn ? { background: 'rgba(220,38,38,0.08)' } : {}}>
                    <span className="scraper-date">{formatDate(new Date(m.ts).toISOString())}</span>
                    <span style={warn ? { color: 'var(--danger, #dc2626)', fontWeight: 600 } : {}}>{rss} MB</span>
                    <span>{heapUsed} MB</span>
                    <span>{heapTotal} MB</span>
                    <span>{warn ? '⚠ High' : '✓ OK'}</span>
                  </div>
                );
              })}
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

          <p className="admin-muted" style={{ marginTop: '1.25rem', marginBottom: '1rem' }}>
            Re-check up to 20 stale listings for price/mileage changes and deactivate any that have been removed. Runs automatically every hour.
          </p>
          {refreshError && <div className="admin-error" style={{ marginBottom: '0.75rem' }}>{refreshError}</div>}
          {refreshResult && (
            <div className="admin-success" style={{ marginBottom: '0.75rem' }}>
              Checked {refreshResult.checked} — refreshed {refreshResult.refreshed}, deactivated {refreshResult.deactivated}, failed {refreshResult.failed}
            </div>
          )}
          <button
            className="admin-submit-btn"
            onClick={handleRefresh}
            disabled={refreshLoading}
            style={{ marginTop: 0 }}
          >
            {refreshLoading ? 'Refreshing…' : 'Refresh Stale Listings'}
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

        {/* Admin Notes */}
        <div className="admin-card">
          <h2>Dev Notes</h2>
          <p className="admin-muted" style={{ marginBottom: '0.75rem' }}>
            Jot down modification requests as you test. Saved locally in your browser.
          </p>
          <textarea
            style={{ width: '100%', minHeight: '140px', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: '0.875rem', resize: 'vertical', background: 'var(--bg)' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="• Listing count still off on mobile&#10;• Add dealer filter&#10;• …"
          />
          <button
            className="admin-submit-btn"
            onClick={handleNotesSave}
            style={{ marginTop: '0.5rem' }}
          >
            {notesSaved ? 'Saved ✓' : 'Save Notes'}
          </button>
        </div>

        </>)}

      </div>
    </div>
  );
}
