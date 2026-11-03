import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPincode } from '../pincode.js';

// The map (leaflet) is downloaded only when the customer starts adding / changing the pin
const MapPicker = lazy(() => import('./Mappicker.jsx'));

const LABELS = [
  { key: 'home', text: 'Home', icon: '🏠' },
  { key: 'work', text: 'Work', icon: '🏢' },
  { key: 'hotel', text: 'Hotel', icon: '🏨' },
  { key: 'other', text: 'Other', icon: '📍' },
];

// Which detail boxes show for each address type. They are joined into line1 when saving.
const FIELD_SETS = {
  home: [
    { k: 'building', placeholder: 'Flat / House no. / Building name *', required: true },
    { k: 'floor', placeholder: 'Floor (optional)' },
  ],
  work: [
    { k: 'building', placeholder: 'Office / Building name *', required: true },
    { k: 'floor', placeholder: 'Floor *', required: true },
    { k: 'tower', placeholder: 'Tower / Wing (optional)' },
  ],
  hotel: [
    { k: 'building', placeholder: 'Hotel name *', required: true },
    { k: 'floor', placeholder: 'Room no. / Floor *', required: true },
  ],
  other: [
    { k: 'building', placeholder: 'Flat / House no. / Building name *', required: true },
    { k: 'floor', placeholder: 'Floor (optional)' },
  ],
};

const inputCls =
  'h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base outline-none placeholder:text-slate-400 focus:border-brand';

const joinLine1 = (label, f) => {
  const floor = f.floor.trim();
  const floorText = /^\d+$/.test(floor) ? `${label === 'hotel' ? 'Room' : 'Floor'} ${floor}` : floor;
  const tower = f.tower.trim();
  return [f.building.trim(), floorText, tower && (/^\w{1,3}$/.test(tower) ? `Tower ${tower}` : tower)]
    .filter(Boolean)
    .join(', ');
};

// true on tablets / laptops / desktops (768px and wider)
function useIsWide() {
  const query = '(min-width: 768px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

// initial: existing address (edit) or null (new). Props: initial, loginMobile, isFirst, onSave, onCancel.
//  - Phones: step 1 full screen map, step 2 bottom sheet with the details.
//  - Big screens: one modal, map on the left, details on the right (moving the pin updates the address live).
export default function AddressForm({ initial, loginMobile, isFirst, onSave, onCancel }) {
  const wide = useIsWide();
  const [f, setF] = useState(() => ({
    label: initial?.label || 'home',
    building: initial?.line1 || '',
    floor: '',
    tower: '',
    landmark: initial?.landmark || '',
    name: initial?.name || '',
    mobile: initial?.mobile || loginMobile || '',
    line2: initial?.line2 || '',
    city: initial?.city || '',
    pincode: initial?.pincode || getPincode() || '',
    is_default: initial ? initial.is_default : isFirst,
  }));
  const [stage, setStage] = useState(initial ? 'form' : 'map'); // phones only: map | form
  const [formSeen, setFormSeen] = useState(!!initial);
  const [lastPos, setLastPos] = useState(null);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setDigits = (k, max) => (e) =>
    setF((s) => ({ ...s, [k]: e.target.value.replace(/\D/g, '').slice(0, max) }));

  // Place picked on the map: pincode, city and area come from the pin
  const applyPlace = (d) => {
    setLastPos({ lat: d.lat, lng: d.lng });
    setF((s) => ({
      ...s,
      pincode: d.pincode || s.pincode,
      city: d.city || s.city,
      line2: d.area || s.line2,
    }));
  };

  const cancel = () => onCancel && onCancel();

  // Big screens: Escape closes the modal
  useEffect(() => {
    if (!wide) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      if (!busy) cancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wide, busy]);

  // Phones, step 1: full screen map
  if (!wide && stage === 'map') {
    return (
      <Suspense fallback={null}>
        <MapPicker
          start={lastPos}
          onClose={() => (formSeen ? setStage('form') : cancel())}
          onConfirm={(p) => {
            applyPlace(p);
            setFormSeen(true);
            setStage('form');
          }}
        />
      </Suspense>
    );
  }

  const fields = FIELD_SETS[f.label] || FIELD_SETS.other;
  const placeOk = /^\d{6}$/.test(f.pincode) && f.city.trim() && f.line2.trim();
  const showManual = manual || !placeOk;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;

    for (const fd of fields) {
      if (fd.required && !f[fd.k].trim()) {
        return setError(`Please fill: ${fd.placeholder.replace(/ \*$/, '')}.`);
      }
    }
    const t = (v) => v.trim();
    const line1 = joinLine1(f.label, f);
    if (line1.length > 150) return setError('Address details are too long. Please shorten them.');
    if (!t(f.line2)) return setError('Pick your location on the map, or enter area / street.');
    if (!/^\d{6}$/.test(f.pincode)) return setError('Enter a valid 6 digit pincode.');
    if (!t(f.city)) return setError('Enter your city.');
    if (!t(f.name)) return setError('Enter your name.');
    if (!/^[6-9]\d{9}$/.test(f.mobile)) return setError('Enter a valid 10 digit mobile number.');

    setBusy(true);
    setError('');
    try {
      await onSave({
        label: f.label,
        name: t(f.name),
        mobile: f.mobile,
        line1,
        line2: t(f.line2),
        landmark: t(f.landmark) || null,
        city: t(f.city),
        pincode: f.pincode,
        is_default: !!f.is_default,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const formEl = (
    <form
      onSubmit={submit}
      onClick={(e) => e.stopPropagation()}
      className={
        wide
          ? 'flex min-h-0 min-w-0 flex-1 flex-col'
          : 'flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white'
      }
    >
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <h2 className="text-lg font-extrabold">Enter complete address</h2>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          aria-label="Close"
          className="grid size-9 place-items-center rounded-full active:bg-slate-100"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-4 py-4">
        {/* Phones: place picked on the map + Change */}
        {!wide && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-800 text-white">
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                <path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 119.5 9 2.5 2.5 0 0112 11.5z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{f.line2 || 'Location not set'}</p>
              <p className="truncate text-xs text-slate-500">{[f.city, f.pincode].filter(Boolean).join(' - ')}</p>
            </div>
            <button type="button" onClick={() => setStage('map')} className="shrink-0 px-1 text-sm font-extrabold text-brand-dark">
              Change
            </button>
          </div>
        )}

        {showManual ? (
          <div className="grid gap-3 rounded-xl border border-dashed border-slate-300 p-3">
            <input className={inputCls} placeholder="Area / street *" value={f.line2} onChange={set('line2')} autoComplete="address-line2" maxLength={150} />
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls} placeholder="Pincode *" value={f.pincode} onChange={setDigits('pincode', 6)} inputMode="numeric" autoComplete="postal-code" />
              <input className={inputCls} placeholder="City *" value={f.city} onChange={set('city')} autoComplete="address-level2" maxLength={60} />
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setManual(true)} className="justify-self-start text-xs font-bold text-slate-500 underline">
            Edit area, city or pincode
          </button>
        )}

        <p className="mt-1 text-sm text-slate-600">Save address as *</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Address type">
          {LABELS.map((l) => (
            <button
              key={l.key}
              type="button"
              aria-pressed={f.label === l.key}
              onClick={() => setF((s) => ({ ...s, label: l.key }))}
              className={`flex h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-bold ${
                f.label === l.key ? 'border-brand bg-brand-soft text-brand-dark' : 'border-slate-200 text-slate-700'
              }`}
            >
              <span aria-hidden="true">{l.icon}</span>
              {l.text}
            </button>
          ))}
        </div>

        {fields.map((fd) => (
          <input
            key={`${f.label}-${fd.k}`}
            className={inputCls}
            placeholder={fd.placeholder}
            value={f[fd.k]}
            onChange={set(fd.k)}
            maxLength={80}
            enterKeyHint="next"
          />
        ))}
        <input
          className={inputCls}
          placeholder="Nearby landmark (optional)"
          value={f.landmark}
          onChange={set('landmark')}
          maxLength={100}
          enterKeyHint="next"
        />

        <p className="mt-2 text-sm text-slate-600">Enter your details for seamless delivery experience</p>
        <input className={inputCls} placeholder="Your name *" value={f.name} onChange={set('name')} autoComplete="name" maxLength={60} enterKeyHint="next" />
        <input
          className={inputCls}
          placeholder="Your phone number *"
          value={f.mobile}
          onChange={setDigits('mobile', 10)}
          inputMode="numeric"
          autoComplete="tel-national"
        />

        {!isFirst && !initial?.is_default && (
          <label className="flex h-11 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={f.is_default}
              onChange={(e) => setF((s) => ({ ...s, is_default: e.target.checked }))}
              className="size-5 accent-brand"
            />
            Make this my default address
          </label>
        )}

        {error && <p className="text-sm font-semibold text-tomato">{error}</p>}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="submit"
          disabled={busy}
          className="h-14 w-full rounded-xl bg-brand text-[17px] font-extrabold text-white active:bg-brand-dark disabled:bg-slate-300"
        >
          {busy ? 'Saving...' : 'Save Address'}
        </button>
      </div>
    </form>
  );

  // Big screens: map on the left, details on the right, one modal
  if (wide) {
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Enter complete address"
        onClick={cancel}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex h-[min(88vh,700px)] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="w-[46%] shrink-0 border-r border-slate-200">
            <Suspense fallback={<div className="h-full w-full animate-pulse bg-slate-100" />}>
              <MapPicker embedded autoLocate={!initial} start={lastPos} onPlace={applyPlace} />
            </Suspense>
          </div>
          {formEl}
        </div>
      </div>,
      document.body
    );
  }

  // Phones, step 2: bottom sheet
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Enter complete address"
      onClick={cancel}
    >
      {formEl}
    </div>,
    document.body
  );
}