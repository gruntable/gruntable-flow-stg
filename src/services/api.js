import { supabase } from './supabase.js';

/**
 * A wrapper around the native fetch API that automatically injects
 * the Supabase session access token into the Authorization header.
 * 
 * @param {string|URL} url - The URL to fetch.
 * @param {Object} options - Standard fetch options.
 * @returns {Promise<Response>}
 */
export const fetchWithAuth = async (url, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(options.headers || {});
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
};
