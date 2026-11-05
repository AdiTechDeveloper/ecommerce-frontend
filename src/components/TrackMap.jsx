import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getOrderTrack } from '../api.js';

// Customer ke liye live map: delivery wala (scooter) aur customer ka ghar (pin).
// Har 8 second me server se taaza location aati hai. Order raste me na ho to map band karne ko kehta hai.

const POLL_MS = 8000;

const riderIcon = L.divIcon({
  html: '<div style="font-size:30px;line-height:34px;text-align:center;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))">🛵</div>',
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const homeIcon = L.divIcon({
  html:
    '<svg viewBox="0 0 24 32" width="30" height="40" style="filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))">' +
    '<path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.6 12 32 12 32s12-11.4 12-20.3C24 5.2 18.6 0 12 0z" fill="#d6452f"/>' +
    '<circle cx="12" cy="11.5" r="4.5" fill="#fff"/></svg>',
  className: '',
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

export default function TrackMap({ orderNo, onClose }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const riderRef = useRef(null);
  const homeRef = useRef(null);
  const fittedRef = useRef(false);
  const [info, setInfo] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [failed, setFailed] = useState(false);
  const [, setTick] = useState(0);

  // Map (ek hi baar)
  useEffect(() => {
    const map = L.map(boxRef.current, { center: [22.9734, 78.6569], zoom: 5, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      riderRef.current = null;
      homeRef.current = null;
    };
  }, []);

  // Dono jagah dikhane layak zoom
  const fit = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = [riderRef.current, homeRef.current].filter(Boolean).map((m) => m.getLatLng());
    if (pts.length === 2) map.fitBounds(L.latLngBounds(pts), { padding: [70, 70], maxZoom: 17 });
    else if (pts.length === 1) map.setView(pts[0], 16);
  }, []);

  // Har 8 second me taaza location
  useEffect(() => {
    let stop = false;

    const load = async () => {
      try {
        const res = await getOrderTrack(orderNo);
        if (stop) return;
        const d = res.data;
        setInfo(d);
        setFetchedAt(Date.now());
        setFailed(false);

        const map = mapRef.current;
        if (!map) return;

        if (d.destination) {
          const pos = [d.destination.lat, d.destination.lng];
          if (homeRef.current) homeRef.current.setLatLng(pos);
          else homeRef.current = L.marker(pos, { icon: homeIcon, interactive: false }).addTo(map);
        }

        if (d.rider) {
          const pos = [d.rider.lat, d.rider.lng];
          if (riderRef.current) riderRef.current.setLatLng(pos);
          else riderRef.current = L.marker(pos, { icon: riderIcon, interactive: false, zIndexOffset: 1000 }).addTo(map);
        } else if (riderRef.current) {
          riderRef.current.remove();
          riderRef.current = null;
        }

        // Pehli baar (ya delivery wala pehli baar dikha) zoom theek karo; baad me customer ka zoom nahi chhedte
        if (!fittedRef.current && (riderRef.current || homeRef.current)) {
          fit();
          if (riderRef.current) fittedRef.current = true;
        }
      } catch (e) {
        if (!stop) setFailed(true);
      }
    };

    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [orderNo, fit]);

  // "x second pehle" ke liye
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ended = info && !info.live;
  const ago = info?.rider ? info.rider.seconds_ago + Math.floor((Date.now() - fetchedAt) / 1000) : null;
  const agoText = ago == null ? '' : ago < 10 ? 'just now' : ago < 60 ? `${ago} sec ago` : `${Math.floor(ago / 60)} min ago`;

  let title = 'Finding your delivery partner...';
  let sub = '';
  if (ended) {
    title = info.order_status === 'delivered' ? 'Your order is delivered' : 'Live tracking has ended';
    sub = 'You can close this map.';
  } else if (info?.rider) {
    title = info.eta_minutes != null ? (info.eta_minutes <= 1 ? 'Arriving any moment' : `Arriving in ${info.eta_minutes} min`) : 'On the way to you';
    sub = [info.rider_name, info.distance_km != null ? `${info.distance_km} km away` : '', agoText && `updated ${agoText}`]
      .filter(Boolean)
      .join(' · ');
  } else if (info) {
    title = 'Waiting for the delivery partner\'s location';
    sub = 'It shows up here as soon as their phone shares it.';
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="Track your order">
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
        <h2 className="text-base font-extrabold">Track order {orderNo}</h2>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={boxRef} className="absolute inset-0 z-0" />
        <button
          type="button"
          onClick={fit}
          className="absolute bottom-4 left-3 z-10 h-9 rounded-full border border-slate-300 bg-white px-3.5 text-[13px] font-bold text-slate-700 shadow-md active:bg-slate-50"
        >
          Show both
        </button>
      </div>

      <div className="shrink-0 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
        <p className="text-lg font-extrabold">{title}</p>
        {sub && <p className="mt-0.5 text-sm text-slate-500">{sub}</p>}
        {failed && <p className="mt-1 text-xs font-semibold text-slate-500">Could not refresh. Trying again...</p>}
      </div>
    </div>,
    document.body
  );
}