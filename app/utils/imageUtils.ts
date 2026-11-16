import { API_BASE_URL } from '../services/api';

/**
 * Resolves any image URL (relative or absolute) to a full, valid image URI.
 */
export function getFullImageUrl(url?: string | null): string {
  if (!url) {
    return `${API_BASE_URL}/uploads/products/classic_200g.png`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/uploads')) {
    return `${API_BASE_URL}${url}`;
  }
  if (url.startsWith('/images')) {
    return `${API_BASE_URL}${url}`;
  }
  return `${API_BASE_URL}/${url.replace(/^\/+/, '')}`;
}

export default getFullImageUrl;
