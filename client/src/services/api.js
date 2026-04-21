const BASE = '/api';

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const fetchCarsForSale = () => apiFetch('/carsforsale');
export const fetchUnderMil = () => apiFetch('/undermil');
export const fetchLatest = () => apiFetch('/latest');
export const fetchCount = () => apiFetch('/count');
export const fetchPriceData = (yearUpper, yearLower, make, model) =>
  apiFetch(`/data/${yearUpper}/${yearLower}/${encodeURIComponent(make)}/${encodeURIComponent(model)}`);
