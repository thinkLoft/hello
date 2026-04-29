const BASE = '/api';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized — redirecting to login');
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const fetchCarsForSale = () => apiFetch('/carsforsale');
export const fetchUnderMil = () => apiFetch('/undermil');
export const fetchLatest = () => apiFetch('/latest');
export const fetchCount = () => apiFetch('/count');
export const fetchPriceData = (yearUpper, yearLower, make, model) =>
  apiFetch(`/data/${yearUpper}/${yearLower}/${encodeURIComponent(make)}/${encodeURIComponent(model)}`);

const jsonPatch = (path, body) =>
  apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const markAsSold = (id) => jsonPatch(`/cars/${id}`, { sold: true });
export const updateListing = (id, fields) => jsonPatch(`/cars/${id}`, fields);
export const hideListing = (id, hidden) => jsonPatch(`/cars/${id}`, { hidden });
export const rescoreListing = (id) =>
  apiFetch(`/cars/${id}/rescore`, { method: 'POST' });

export const triggerRescore = () =>
  apiFetch('/scoring/run', { method: 'POST' });

export const fetchScraperStats = () => apiFetch('/scraper-stats');
export const fetchScraperRuns = (source) => apiFetch(`/scraper-runs?source=${encodeURIComponent(source)}`);
export const fetchScoringWeights = () => apiFetch('/scoring-weights');
export const updateScoringWeights = (weights) =>
  apiFetch('/scoring-weights', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(weights),
  });
