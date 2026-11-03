import { useSyncExternalStore } from 'react';

// Saved pincode (localStorage) that any component can read and react to.
const KEY = 'pincode';
const listeners = new Set();

export function getPincode() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch (e) {
    return '';
  }
}

export function setPincode(value) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch (e) {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const usePincode = () => useSyncExternalStore(subscribe, getPincode);
