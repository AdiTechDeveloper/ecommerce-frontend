import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders, money } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { statusText, statusTone, when } from '../orderStatus.js';

export default function OrdersPage() {
  const { customer, openLogin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPage = useCallback((p) => {
    setLoading(true);
    setError('');
    getOrders(p)
      .then((res) => {
        setOrders((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
        setPage(p);
        setLastPage(res.meta.last_page);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (customer) loadPage(1);
  }, [customer, loadPage]);

  if (!customer) {
    return (
      <div className="grid justify-items-center gap-3 px-4 py-16 text-center">
        <h1 className="text-xl font-extrabold">Log in to see your orders</h1>
        <button onClick={() => openLogin()} className="h-12 rounded-xl bg-brand px-6 font-bold text-white">
          Login
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">My orders</h1>

      {orders.length === 0 && !loading && !error && (
        <div className="grid justify-items-center gap-3 py-12 text-center">
          <p className="text-slate-600">You have not placed any orders yet.</p>
          <Link to="/" className="rounded-xl bg-brand px-5 py-3 font-bold text-white">
            Browse stores
          </Link>
        </div>
      )}

      <ul className="grid gap-3">
        {orders.map((o) => (
          <li key={o.order_no}>
            <Link
              to={`/order/${o.order_no}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 active:border-brand sm:hover:border-brand"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-extrabold">{o.store.name}</p>
                  <p className="text-xs text-slate-500">
                    {o.order_no} · {when(o.placed_at)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-extrabold ${statusTone(o.status)}`}>
                  {statusText(o.status, o.mode)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                {o.items_preview.join(', ')}
                {o.items_count > o.items_preview.length ? ` +${o.items_count - o.items_preview.length} more` : ''}
              </p>
              <p className="mt-2 text-sm font-extrabold">{money(o.total)}</p>
            </Link>
          </li>
        ))}
      </ul>

      {loading && <div className="mt-3 h-24 animate-pulse rounded-2xl bg-slate-100" />}
      {error && (
        <div className="mt-3 grid justify-items-center gap-2 text-center">
          <p className="text-sm font-semibold text-tomato">{error}</p>
          <button onClick={() => loadPage(Math.max(page, 1) === page ? page + 1 : 1)} className="h-11 font-bold text-brand-dark underline">
            Try again
          </button>
        </div>
      )}

      {!loading && page < lastPage && (
        <button
          onClick={() => loadPage(page + 1)}
          className="mt-4 h-12 w-full rounded-xl border-2 border-brand font-extrabold text-brand-dark active:bg-brand-soft"
        >
          Show more
        </button>
      )}
    </div>
  );
}