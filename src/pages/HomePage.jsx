import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getStores } from '../api.js';
import Pagination from '../components/Pagination.jsx';
import StoreCard from '../components/StoreCard.jsx';
import { autoDetectOnFirstVisit, setLocationFromPincode } from '../location.js';
import { usePincode } from '../pincode.js';

const PAGE_SIZE = 12;

// A 6 digit number is treated as a pincode
const isPincode = (v) => /^\d{6}$/.test(v);

const PROMOS = [
  { title: 'Order from your local store', sub: 'Pick a store below and start shopping', bg: 'bg-brand-soft', accent: 'text-brand-dark' },
  { title: 'Delivery or pickup', sub: 'Home delivery, or collect it yourself', bg: 'bg-amber-100', accent: 'text-amber-900' },
  { title: 'Standing at the store?', sub: 'Scan the QR code to open its menu', bg: 'bg-sky-100', accent: 'text-sky-900' },
];

export default function HomePage() {
  // Search text and page number live in the URL (?q=...&page=2) so refresh / back button keep them.
  // The search box itself is in the header (see App.jsx).
  const [params, setParams] = useSearchParams();
  const text = (params.get('q') || '').trim();
  const rawPage = parseInt(params.get('page') || '1', 10);

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  // The API is called again only when a pincode is typed, not for store names
  const pincode = isPincode(text) ? text : '';

  // Customer's saved location (GPS or typed earlier). Stores that deliver there come first.
  const savedPin = usePincode();
  const nearPin = !pincode && isPincode(savedPin) ? savedPin : '';
  const [servingSlugs, setServingSlugs] = useState(null); // Set of store slugs, or null = unknown

  // First visit: ask the browser for location (pincode + area are filled in automatically)
  useEffect(() => {
    autoDetectOnFirstVisit();
  }, []);

  useEffect(() => {
    if (!nearPin) {
      setServingSlugs(null);
      return undefined;
    }
    let cancelled = false;
    getStores(nearPin)
      .then((res) => !cancelled && setServingSlugs(new Set((res.data || []).map((s) => s.slug))))
      .catch(() => !cancelled && setServingSlugs(null)); // not critical: list still works without the marks
    return () => {
      cancelled = true;
    };
  }, [nearPin]);

  // Remember the typed pincode (checked by the backend, so the area name shows in the header too)
  useEffect(() => {
    if (pincode) setLocationFromPincode(pincode);
  }, [pincode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getStores(pincode) // empty pincode returns all stores
      .then((res) => !cancelled && setStores(res.data || []))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [pincode, retry]);

  // Match name / address / slug. Every word must match. Open stores come first.
  const filtered = useMemo(() => {
    let list = stores;
    if (!pincode) {
      const words = text.toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length) {
        list = list.filter((s) => {
          const hay = `${s.name || ''} ${s.address || ''} ${s.slug || ''}`.toLowerCase();
          return words.every((w) => hay.includes(w));
        });
      }
    }
    // Delivers to me first, then open stores
    const rank = (s) => (servingSlugs?.has(s.slug) ? 2 : 0) + (s.is_open_now ? 1 : 0);
    return [...list].sort((a, b) => rank(b) - rank(a));
  }, [stores, text, pincode, servingSlugs]);

  const showServing = !!nearPin && !!servingSlugs;
  const servingCount = showServing ? filtered.filter((s) => servingSlugs.has(s.slug)).length : 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1), totalPages);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const searching = text.length > 0;

  const goToPage = (p) => {
    const next = new URLSearchParams(params);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearSearch = () => setParams({}, { replace: true });

  return (
    <section>
      {!searching && (
        <div className="no-scrollbar -mx-4 mb-6 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {PROMOS.map((p) => (
            <div key={p.title} className={`min-w-64 shrink-0 rounded-2xl p-5 sm:min-w-0 ${p.bg}`}>
              <h2 className={`text-lg font-extrabold leading-tight ${p.accent}`}>{p.title}</h2>
              <p className="mt-1 text-sm text-slate-700">{p.sub}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex items-end justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
          {searching ? 'Search results' : 'All stores'}
        </h1>
        {!loading && !error && filtered.length > 0 && (
          <p className="text-sm text-slate-500" aria-live="polite">
            {pincode
              ? `${filtered.length} ${filtered.length === 1 ? 'store delivers' : 'stores deliver'} to ${pincode}`
              : showServing
              ? `${servingCount} of ${filtered.length} stores deliver to ${nearPin}`
              : `${filtered.length} ${filtered.length === 1 ? 'store' : 'stores'}`}
          </p>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div className="grid justify-items-center gap-3 py-12 text-center">
          <h2 className="text-lg font-bold">Could not load stores</h2>
          <p className="text-slate-500">{error}</p>
          <button
            className="rounded-xl bg-brand px-5 py-3 font-bold text-white active:bg-brand-dark"
            onClick={() => setRetry((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="grid justify-items-center gap-3 py-12 text-center">
          <h2 className="text-lg font-bold">
            {pincode
              ? 'No store delivers to this pincode yet'
              : searching
              ? 'No store found with that name'
              : 'No stores are online yet'}
          </h2>
          {searching && (
            <>
              <p className="text-slate-500">Try another name, area or pincode.</p>
              <button
                className="rounded-xl bg-brand px-5 py-3 font-bold text-white active:bg-brand-dark"
                onClick={clearSearch}
              >
                Show all stores
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageItems.map((s) => (
              <StoreCard
                key={s.slug}
                store={s}
                serves={showServing ? servingSlugs.has(s.slug) : undefined}
                pin={nearPin}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
        </>
      )}
    </section>
  );
}