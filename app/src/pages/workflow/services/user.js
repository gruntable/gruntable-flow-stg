// ─────────────────────────────────────────────
// USER SERVICE
// Handles browser-based user identification
// PRD: prd/platform/n8n-workflows/utilities.md
// ─────────────────────────────────────────────

const USER_ID_KEY = 'gruntable_user_id';

/**
 * Generate a UUID v4
 * @returns {string} UUID v4 string
 */
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Get or create user_id
 * Returns existing user_id from localStorage, or generates and stores a new one
 * @returns {string} User UUID
 */
export const getUserId = () => {
  if (typeof window === 'undefined') {
    // Server-side rendering fallback - return a placeholder
    return 'server-side-rendering';
  }

  let userId = window.localStorage.getItem(USER_ID_KEY);

  if (!userId) {
    userId = generateUUID();
    window.localStorage.setItem(USER_ID_KEY, userId);
    console.log('[UserService] Generated new user_id:', userId);
  }

  return userId;
};

/**
 * Get user_id synchronously (alias for getUserId)
 * @returns {string} User UUID
 */
export const getUserIdSync = () => {
  return getUserId();
};

/**
 * Set a specific user_id value
 * @param {string} value - The user_id to set
 */
export const setUserId = (value) => {
  if (typeof window === 'undefined') return;
  if (!value) return;
  window.localStorage.setItem(USER_ID_KEY, value);
  cachedUserId = value;
  console.log('[UserService] Set user_id to:', value);
};

/**
 * Reset user_id (for testing/debugging)
 * Generates a new user_id and replaces the old one
 * @returns {string} New user UUID
 */
export const resetUserId = () => {
  if (typeof window === 'undefined') {
    return 'server-side-rendering';
  }

  const newUserId = generateUUID();
  window.localStorage.setItem(USER_ID_KEY, newUserId);
  console.log('[UserService] Reset user_id to:', newUserId);
  return newUserId;
};

/**
 * Check if user_id exists
 * @returns {boolean} True if user_id exists in localStorage
 */
export const hasUserId = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return !!window.localStorage.getItem(USER_ID_KEY);
};

// Initialize on module load (for immediate availability)
let cachedUserId = null;

/**
 * Get cached user_id (faster, but may be stale after reset)
 * @returns {string} User UUID
 */
export const getCachedUserId = () => {
  if (!cachedUserId) {
    cachedUserId = getUserId();
  }
  return cachedUserId;
};

// Export default for convenience
export default {
  getUserId,
  getUserIdSync,
  setUserId,
  resetUserId,
  hasUserId,
  getCachedUserId,
};
