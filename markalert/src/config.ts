/**
 * Single source of truth for the API base URL.
 *
 * Rules:
 * 1. If import.meta.env.VITE_API_URL is set, use `${VITE_API_URL}/api`
 *    (stripping any trailing slashes or duplicate /api).
 * 2. Otherwise, fall back to `http://${window.location.hostname}:5000/api`
 *    for local development only.
 * 3. Never produce an http:// URL when the page is served over https://
 *    (prevents Mixed Content errors on production deployments like Vercel).
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    const cleaned = envUrl.trim().replace(/\/+$/, '');
    return cleaned.endsWith('/api') ? cleaned : `${cleaned}/api`;
  }

  if (typeof window !== 'undefined') {
    // When served over HTTPS, never construct an HTTP URL
    if (window.location.protocol === 'https:') {
      return '/api';
    }

    // Local development HTTP fallback
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:5000/api`;
  }

  return '/api';
}

export const API_BASE_URL = getApiBaseUrl();
