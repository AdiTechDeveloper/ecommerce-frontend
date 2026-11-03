import { useEffect, useState } from 'react';
import {
  closeLocationPrompt,
  detectLocation,
  setLocationFromPincode,
  useLocationState,
} from '../location.js';
import { PinIcon } from './icons.jsx';

// Popup shown when the home page opens and we do not know the customer's location yet.
// "Allow location" -> browser asks permission -> pincode is filled in automatically.
// Denied / failed -> red message, and the customer can type the pincode instead.
export default function LocationPrompt() {
  const { promptOpen, status, message } = useLocationState();
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [saving, setSaving] = useState(false);

  const detecting = status === 'detecting';
  const failed = status === 'denied' || status === 'error' || status === 'unsupported';

  useEffect(() => {
    if (!promptOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeLocationPrompt();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [promptOpen]);

  if (!promptOpen) return null;

  const submitPin = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setPinError('');
    const res = await setLocationFromPincode(pin);
    setSaving(false);
    if (!res.ok) setPinError(res.message);
    // on success the popup closes by itself (location is saved)
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loc-prompt-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
          <PinIcon className="size-8" />
        </div>

        <h2 id="loc-prompt-title" className="mt-4 text-center text-xl font-extrabold">
          Find stores near you
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Allow location and we will fill in your pincode and show the stores that deliver to you.
        </p>

        <button
          type="button"
          onClick={detectLocation}
          disabled={detecting}
          className="mt-5 h-12 w-full rounded-xl bg-brand font-bold text-white active:bg-brand-dark disabled:opacity-60"
        >
          {detecting ? 'Finding your location...' : failed ? 'Try again' : 'Allow location'}
        </button>

        {failed && !detecting && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-tomato">
            {message || 'We could not get your location. Please enter your pincode.'}
          </p>
        )}

        <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          or
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={submitPin} className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              setPinError('');
            }}
            placeholder="Enter 6 digit pincode"
            aria-label="Pincode"
            className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={pin.length !== 6 || saving}
            className="h-12 shrink-0 rounded-xl bg-ink px-5 font-bold text-white disabled:opacity-40"
          >
            {saving ? '...' : 'Use'}
          </button>
        </form>
        {pinError && <p className="mt-2 text-sm font-semibold text-tomato">{pinError}</p>}

        <button
          type="button"
          onClick={closeLocationPrompt}
          className="mt-4 h-11 w-full rounded-xl text-sm font-bold text-slate-500 active:bg-slate-100"
        >
          Not now
        </button>
      </div>
    </div>
  );
}