import { useSyncExternalStore } from 'react';
import { lookupPincode, reverseGeocode } from './api.js';
import { setPincode } from './pincode.js';

// Customer's location: detected with GPS (browser) or typed by hand.
// The pincode itself still lives in pincode.js (the cart/address code uses it);
// this file adds the area/city name and the "ask for location" logic.
const LOC_KEY = 'vakaro_location_v1';
const DISMISSED_KEY = 'vakaro_location_prompt_dismissed_v1'; // "Not now" is remembered for this browser session only

const isPin = (v) => /^\d{6}$/.test(v || '');
// Indian pincodes start with 1 to 8 (never 0 or 9)
const isRealPinFormat = (v) => /^[1-8]\d{5}$/.test(v || '');

function readSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(LOC_KEY) || 'null');
    return v && isPin(v.pincode) ? v : null;
  } catch (e) {
    return null;
  }
}

// status: idle | detecting | denied | error | unsupported
// promptOpen: the "Allow location" popup is showing
let state = { loc: readSaved(), status: 'idle', message: '', sheetOpen: false, promptOpen: false };
const listeners = new Set();

function update(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => state;

export const useLocationState = () => useSyncExternalStore(subscribe, getSnapshot);

export const openLocationSheet = () => update({ sheetOpen: true });
export const closeLocationSheet = () => update({ sheetOpen: false });

// "Not now": hide the popup for this session. The header keeps showing "Set your location".
export function closeLocationPrompt() {
  try {
    sessionStorage.setItem(DISMISSED_KEY, '1');
  } catch (e) {
    /* ignore */
  }
  update({ promptOpen: false });
}

function applyLocation(loc) {
  const full = { ...loc, at: Date.now() };
  try {
    localStorage.setItem(LOC_KEY, JSON.stringify(full));
  } catch (e) {
    /* ignore */
  }
  setPincode(full.pincode);
  update({ loc: full, status: 'idle', message: '', promptOpen: false });
}

// Typed pincode: the backend checks it exists and gives the area / city name.
// Returns { ok: true } or { ok: false, message }.
export async function setLocationFromPincode(pin) {
  if (!isPin(pin)) return { ok: false, message: 'Enter a valid 6 digit pincode.' };
  if (!isRealPinFormat(pin)) return { ok: false, message: 'We could not find this pincode. Please check it and try again.' };

  // Same pincode we already resolved (for example from GPS): keep it as it is
  if (state.loc?.pincode === pin && state.loc.area) {
    applyLocation({ ...state.loc });
    return { ok: true };
  }

  try {
    const res = await lookupPincode(pin);
    const d = res.data || {};
    applyLocation({ pincode: pin, area: d.area || '', city: d.city || '', state: d.state || '', source: 'manual' });
    return { ok: true };
  } catch (e) {
    if (e.status === 404) {
      return { ok: false, message: 'We could not find this pincode. Please check it and try again.' };
    }
    // Could not verify (service down / no internet): do not accept an unchecked pincode
    return { ok: false, message: 'We could not verify this pincode right now. Please try again in a moment.' };
  }
}

export function clearLocation() {
  try {
    localStorage.removeItem(LOC_KEY);
  } catch (e) {
    /* ignore */
  }
  setPincode('');
  update({ loc: null, status: 'idle', message: '' });
}

let inflight = null;

// Asks the browser for GPS, then the backend turns the coordinates into pincode + area.
// Resolves true if a location was saved.
export function detectLocation() {
  if (inflight) return inflight;

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    update({ status: 'unsupported', message: 'This browser cannot share your location. Please enter your pincode.' });
    return Promise.resolve(false);
  }

  // Browsers allow GPS only on https (or localhost)
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    update({
      status: 'unsupported',
      message: 'Location needs a secure (https) connection. Please enter your pincode.',
    });
    return Promise.resolve(false);
  }

  update({ status: 'detecting', message: '' });

  const p = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          const d = res.data || {};
          if (!isPin(d.pincode)) {
            update({
              status: 'error',
              message: `We found your area${d.area ? ` (${d.area})` : ''} but not its pincode. Please enter your pincode.`,
            });
            resolve(false);
            return;
          }
          applyLocation({
            pincode: d.pincode,
            area: d.area || '',
            city: d.city || '',
            state: d.state || '',
            source: 'gps',
          });
          resolve(true);
        } catch (e) {
          update({ status: 'error', message: 'Could not find your area right now. Please enter your pincode.' });
          resolve(false);
        }
      },
      (err) => {
        if (err.code === 1) {
          update({
            status: 'denied',
            message: 'Location access is blocked. Allow it in your browser settings, or enter your pincode.',
          });
        } else {
          update({ status: 'error', message: 'Could not get your location. Please enter your pincode.' });
        }
        resolve(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 }
    );
  });

  inflight = p.finally(() => {
    inflight = null;
  });
  return inflight;
}

let checked = false;

// Home page calls this on load (once per page load).
// - Customer already has a location: nothing happens.
// - Browser permission already "granted": detect quietly, no popup.
// - Otherwise: show the "Allow location" popup (unless the customer said "Not now" in this session).
export async function checkLocationOnLoad() {
  if (checked) return;
  checked = true;

  if (state.loc) return;

  try {
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
  } catch (e) {
    /* ignore */
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    update({
      status: 'unsupported',
      message: 'This browser cannot share your location. Please enter your pincode.',
      promptOpen: true,
    });
    return;
  }

  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    update({
      status: 'unsupported',
      message: 'Location needs a secure (https) connection. Please enter your pincode.',
      promptOpen: true,
    });
    return;
  }

  try {
    const perm = await navigator.permissions?.query({ name: 'geolocation' });
    if (perm?.state === 'granted') {
      const ok = await detectLocation();
      if (!ok) update({ promptOpen: true });
      return;
    }
    if (perm?.state === 'denied') {
      update({
        status: 'denied',
        message: 'Location access is blocked. Allow it in your browser settings, or enter your pincode.',
        promptOpen: true,
      });
      return;
    }
  } catch (e) {
    /* permissions API not available: just show the popup */
  }

  update({ promptOpen: true });
}

// Old name, kept so existing imports keep working
export const autoDetectOnFirstVisit = checkLocationOnLoad;