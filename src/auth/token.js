// Login ka token + customer localStorage mein. api.js aur AuthContext dono yahi use karte hain.
const KEY = 'vakaro_auth_v1';
let unauthorizedHandler = null;

export function loadAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const a = JSON.parse(raw);
    return a && typeof a.token === 'string' && a.token ? a : null;
  } catch (e) {
    return null;
  }
}

export const getToken = () => loadAuth()?.token || '';

export function saveAuth(auth) {
  try {
    localStorage.setItem(KEY, JSON.stringify(auth));
  } catch (e) {
    /* ignore */
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* ignore */
  }
}

// Server 401 de (token expire / galat) to AuthContext ko pata chal jaye
export function onUnauthorized(fn) {
  unauthorizedHandler = fn;
}
export function notifyUnauthorized() {
  if (unauthorizedHandler) unauthorizedHandler();
}