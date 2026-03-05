const normalizeBaseUrl = (url) =>
  String(url || '')
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');

export const API_BASE_URL = normalizeBaseUrl(
  process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'
);

export const API_URL = `${API_BASE_URL}/api`;

export const buildApiUrl = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${normalizedPath}`;
};

export const buildBaseUrl = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};