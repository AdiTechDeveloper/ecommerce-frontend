import { useEffect, useState } from 'react';
import {
  clearLocation,
  closeLocationSheet,
  detectLocation,
  setLocationFromPincode,
  useLocationState,
} from '../location.js';
import { usePincode } from '../pincode.js';
import BottomSheet from './BottomSheet.jsx';
import { GpsIcon } from './icons.jsx';

// "Change location" dialog: use GPS, or type a pincode.
export default function LocationSheet() {
  const { loc, status, message, sheetOpen } = useLocationState();
  const pincode = usePincode();
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (sheetOpen) {
      setPin('');
      setPinError('');
      setChecking(false);
    }
  }, [sheetOpen]);

  const detecting = status === 'detecting';
  const area = loc && loc.pincode === pincode ? [loc.area, loc.city].filter(Boolean).join(', ') : '';

  const useCurrent = async () => {
    const ok = await detectLocation();
    if (ok) closeLocationSheet();
  };

  const apply = async (e) => {
    e.preventDefault();
    if (checking) return;
    setPinError('');
    setChecking(true);
    const result = await setLocationFromPincode(pin);
    setChecking(false);
    if (!result.ok) {
      setPinError(result.message);
      return;
    }
    closeLocationSheet();
  };

  return (
    <BottomSheet open={sheetOpen} onClose={closeLocationSheet} title="Choose your location">
      {pincode && (
        <p className="mt-1 text-sm text-slate-600">
          Delivering to <span className="font-bold text-ink">{pincode}</span>
          {area ? `, ${area}` : ''}
        </p>
      )}

      <button
        type="button"
        onClick={useCurrent}
        disabled={detecting}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-bold text-white active:bg-brand-dark disabled:opacity-60"
      >
        <GpsIcon className="size-5" />
        {detecting ? 'Detecting your location...' : 'Use my current location'}
      </button>

      {message && !detecting && (
        <p role="alert" className="mt-2 text-sm text-tomato">
          {message}
        </p>
      )}

      <div className="my-4 flex items-center gap-3 text-xs font-semibold text-slate-400" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={apply} noValidate>
        <label htmlFor="loc-pin" className="text-sm font-bold">
          Enter your pincode
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="loc-pin"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              setPinError('');
            }}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            placeholder="e.g. 380015"
            aria-invalid={!!pinError}
            aria-describedby={pinError ? 'loc-pin-err' : undefined}
            className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={checking}
            className="h-12 shrink-0 rounded-xl border-2 border-brand px-5 font-bold text-brand active:bg-brand-soft disabled:opacity-60"
          >
            {checking ? 'Checking...' : 'Apply'}
          </button>
        </div>
        {pinError && (
          <p id="loc-pin-err" role="alert" className="mt-1.5 text-sm text-tomato">
            {pinError}
          </p>
        )}
      </form>

      {(loc || pincode) && (
        <button
          type="button"
          onClick={() => {
            clearLocation();
            closeLocationSheet();
          }}
          className="mt-4 text-sm font-bold text-slate-500 underline"
        >
          Clear my location
        </button>
      )}
    </BottomSheet>
  );
}