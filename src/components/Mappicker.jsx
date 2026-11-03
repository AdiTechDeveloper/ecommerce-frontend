import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { reverseGeocode } from '../api.js';

// Pick a delivery spot on a map. The pin stays in the middle, the customer moves the map.
// After the map stops, pincode / area / city come from the backend (/geo/reverse).
//
// Two ways to use it:
//  - Full screen (phones): <MapPicker start onClose onConfirm />  -> "Confirm location & proceed"
//  - Embedded (big screens, left side of the address modal): <MapPicker embedded onPlace autoLocate />
//    No confirm button; onPlace({ pincode, area, city, state, lat, lng }) fires every time the pin settles on a place.

const INDIA_CENTER = [22.9734, 78.6569];
const MIN_ZOOM_FOR_LOOKUP = 15; // no lookups on a far zoomed-out map (protects the backend rate limit)

export default function MapPicker({ start, onConfirm, onClose, embedded = false, onPlace, autoLocate = true }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const reqRef = useRef(0);
  const onPlaceRef = useRef(onPlace);
  onPlaceRef.current = onPlace;
  const [status, setStatus] = useState('zoom'); // zoom | loading | ok | nopin | error
  const [place, setPlace] = useState(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');

  // Build the map (once)
  useEffect(() => {
    const map = L.map(boxRef.current, {
      center: start ? [start.lat, start.lng] : INDIA_CENTER,
      zoom: start ? 17 : 5,
      minZoom: 4,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    const sizeTimer = setTimeout(() => map.invalidateSize(), 0);

    let timer = null;
    const lookup = () => {
      clearTimeout(timer);
      if (map.getZoom() < MIN_ZOOM_FOR_LOOKUP) {
        reqRef.current += 1; // ignore any older answer
        setPlace(null);
        setStatus('zoom');
        return;
      }
      setStatus('loading');
      // Ask only after the map has stopped, not on every drag frame
      timer = setTimeout(async () => {
        const id = ++reqRef.current;
        const c = map.getCenter();
        try {
          const res = await reverseGeocode(c.lat, c.lng);
          if (id !== reqRef.current) return; // map moved on meanwhile
          const d = res.data || {};
          const found = { ...d, lat: c.lat, lng: c.lng };
          setPlace(found);
          const ok = /^\d{6}$/.test(d.pincode || '');
          setStatus(ok ? 'ok' : 'nopin');
          if (ok && onPlaceRef.current) onPlaceRef.current(found);
        } catch (e) {
          if (id !== reqRef.current) return;
          setPlace(null);
          setStatus('error');
        }
      }, 600);
    };

    map.on('moveend', lookup);
    if (start) lookup();

    return () => {
      clearTimeout(timer);
      clearTimeout(sizeTimer);
      reqRef.current += 1;
      map.off();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Full screen mode: Escape closes only the map, not the sheet behind it
  useEffect(() => {
    if (embedded) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [embedded, onClose]);

  // "Go to current location": move the map to the GPS position
  const goToMe = () => {
    if (locating) return;
    setNotice('');
    if (!navigator.geolocation) {
      setNotice('This browser cannot share your location. Move the map instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 17);
      },
      (err) => {
        setLocating(false);
        setNotice(
          err.code === 1
            ? 'Location access is blocked. Allow it in your browser settings, or move the map.'
            : 'Could not get your location. Move the map instead.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60 * 1000 }
    );
  };

  // First open without a start point: try GPS (if refused, the India map stays)
  useEffect(() => {
    if (!start && autoLocate) goToMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parts = place
    ? [place.area, place.city, place.state].filter((v, i, a) => v && a.indexOf(v) === i)
    : [];

  let title;
  let sub;
  if (status === 'zoom') {
    title = 'Zoom in to pick your spot';
    sub = 'Move the map so the pin is on your door.';
  } else if (status === 'loading') {
    title = 'Finding address...';
    sub = 'Please wait a moment.';
  } else if (status === 'error') {
    title = 'Could not read this spot';
    sub = 'Move the map a little and try again.';
  } else if (status === 'nopin') {
    title = place?.area || place?.city || 'No pincode here';
    sub = 'No pincode found here. Move the pin a little, or type your pincode in the form.';
  } else {
    title = place.area || place.city || 'Selected location';
    sub = `${parts.join(', ')}${parts.length ? ' - ' : ''}${place.pincode}`;
  }

  const barText = status === 'ok' || status === 'nopin' ? parts.join(', ') || title : 'Move the map to set your location';

  const content = (
    <div
      className={embedded ? 'flex h-full min-h-0 w-full flex-col bg-white' : 'fixed inset-0 z-50 flex flex-col bg-white'}
      {...(embedded ? {} : { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Confirm map pin location' })}
    >
      {/* Header (full screen only) */}
      {!embedded && (
        <div className="relative flex h-14 shrink-0 items-center justify-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="absolute left-2 grid size-10 place-items-center rounded-full active:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <h2 className="text-base font-extrabold">Confirm map pin location</h2>
        </div>
      )}

      {/* Map */}
      <div className="relative min-h-0 flex-1">
        <div ref={boxRef} className="absolute inset-0 z-0" />

        {/* Address bar (shows the address under the pin) */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex h-12 items-center gap-2.5 rounded-xl bg-white px-3 shadow-lg">
          <svg viewBox="0 0 24 24" className="size-6 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-700">{barText}</span>
        </div>

        {/* Centre pin: its tip sits exactly on the map centre */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full">
          <svg viewBox="0 0 24 32" className="h-10 w-8 drop-shadow-md" aria-hidden="true">
            <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.6 12 32 12 32s12-11.4 12-20.3C24 5.2 18.6 0 12 0z" fill="#d6452f" />
            <circle cx="12" cy="11.5" r="4.5" fill="#fff" />
          </svg>
        </div>

        <button
          type="button"
          onClick={goToMe}
          disabled={locating}
          className={`absolute z-10 flex h-9 items-center gap-1.5 rounded-full border border-brand/40 bg-white px-3.5 text-[13px] font-bold text-brand-dark shadow-md active:bg-slate-50 disabled:opacity-60 ${
            embedded ? 'bottom-3 left-3' : 'bottom-4 left-1/2 -translate-x-1/2'
          }`}
        >
          <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3.5" />
            <circle cx="12" cy="12" r="8" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          {locating ? 'Finding you...' : 'Go to current location'}
        </button>
      </div>

      {/* Bottom card */}
      <div className="shrink-0 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
        <h3 className="text-[15px] font-extrabold">Delivering your order to</h3>

        <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-800 text-white">
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
              <path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 119.5 9 2.5 2.5 0 0112 11.5z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-[15px] font-extrabold ${status === 'error' ? 'text-tomato' : ''}`}>{title}</p>
            <p className="line-clamp-2 text-[13px] leading-snug text-slate-500">{sub}</p>
          </div>
        </div>

        {notice && <p className="mt-2 text-xs font-semibold text-slate-600">{notice}</p>}

        {!embedded && (
          <button
            type="button"
            disabled={status !== 'ok'}
            onClick={() => onConfirm(place)}
            className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[17px] font-extrabold text-white active:bg-brand-dark disabled:bg-slate-300"
          >
            Confirm location &amp; proceed
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  return embedded ? content : createPortal(content, document.body);
}