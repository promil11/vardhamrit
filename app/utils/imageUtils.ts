import { API_BASE_URL } from '../services/api';

/**
 * Resolves any image URL (relative or absolute) to a full, valid image URI.
 */
export function getFullImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return `${API_BASE_URL}/uploads/products/classic_200g.png`;
  }

  // Replace any hardcoded localhost/127.0.0.1 with live API_BASE_URL (essential on real mobile devices)
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return url.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, API_BASE_URL);
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/uploads') || url.startsWith('/images')) {
    return `${API_BASE_URL}${url}`;
  }
  return `${API_BASE_URL}/${url.replace(/^\/+/, '')}`;
}

export default getFullImageUrl;
