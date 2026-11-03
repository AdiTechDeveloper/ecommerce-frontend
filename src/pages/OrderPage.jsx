import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrder, money } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

const STATUS = {
  placed: 'Order placed',
  accepted: 'Accepted by the store',
  preparing: 'Being packed',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const qtyText = (i) => (i.price_unit === 'kg' ? `${i.qty} kg` : `${i.qty}`);

export default function OrderPage() {
  const { orderNo } = useParams();
  const { customer, openLogin } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!customer) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    getOrder(orderNo)
      .then((res) => setOrder(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orderNo, customer]);

  useEffect(load, [load]);

  if (!customer) {
    return (
      <div className="grid justify-items-center gap-3 px-4 py-16 text-center">
        <h1 className="text-xl font-extrabold">Log in to see this order</h1>
        <button onClick={() => openLogin()} className="h-12 rounded-xl bg-brand px-6 font-bold text-white">
          Login
        </button>
      </div>
    );
  }

  if (loading) return <div className="mx-auto mt-4 h-64 max-w-xl animate-pulse rounded-2xl bg-slate-100" />;

  if (error || !order) {
    return (
      <div className="grid justify-items-center gap-3 px-4 py-16 text-center">
        <h1 className="text-xl font-extrabold">Could not load this order</h1>
        <p className="text-slate-500">{error}</p>
        <button onClick={load} className="h-12 rounded-xl bg-brand px-6 font-bold text-white">
          Try again
        </button>
      </div>
    );
  }

  const isDelivery = order.mode === 'delivery';
  const a = order.address;

  return (
    <div className="mx-auto max-w-xl pb-8">
      <div className="grid justify-items-center gap-2 rounded-2xl bg-brand-soft px-4 py-8 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-brand text-white">
          <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold">{STATUS[order.status] || order.status}</h1>
        <p className="text-sm text-slate-700">
          Order <span className="font-bold">{order.order_no}</span> from {order.store.name}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-extrabold">{isDelivery ? 'Delivering to' : 'Pickup from'}</h2>
        {isDelivery && a ? (
          <p className="mt-1 text-sm leading-snug text-slate-600">
            <span className="font-bold capitalize text-ink">
              {a.label} · {a.name} · {a.mobile}
            </span>
            <br />
            {a.line1}, {a.line2}
            {a.landmark ? `, ${a.landmark}` : ''}, {a.city} {a.pincode}
          </p>
        ) : (
          <p className="mt-1 text-sm leading-snug text-slate-600">
            <span className="font-bold text-ink">{order.store.name}</span>
            {order.store.address && (
              <>
                <br />
                {order.store.address}
              </>
            )}
            {order.store.phone && (
              <>
                <br />
                {order.store.phone}
              </>
            )}
          </p>
        )}
      </div>

      <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
        {order.items.map((i) => (
          <li key={i.product_id} className="flex items-start justify-between gap-3 py-3 text-sm">
            <span className="min-w-0">
              <span className="line-clamp-2 font-semibold">{i.name}</span>
              <span className="text-slate-500">
                {qtyText(i)} × {money(i.price)}
              </span>
            </span>
            <span className="shrink-0 font-bold">{money(i.amount)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-slate-600">Item total</span>
          <span>{money(order.subtotal)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-slate-600">{isDelivery ? 'Delivery fee' : 'Pickup'}</span>
          <span>{order.delivery_fee > 0 ? money(order.delivery_fee) : isDelivery ? 'Free' : 'No fee'}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-slate-100 pt-3 text-base font-extrabold">
          <span>{order.payment_status === 'paid' ? 'Paid' : 'To pay'}</span>
          <span>{money(order.total)}</span>
        </div>
        <p className="mt-1 text-slate-500">
          {order.payment_method === 'cod' ? 'Cash on delivery' : 'Pay at the store'}
        </p>
      </div>

      <div className="mt-5 grid gap-2">
        <Link
          to={`/s/${order.store.slug}`}
          className="grid h-12 place-items-center rounded-xl bg-brand font-extrabold text-white active:bg-brand-dark"
        >
          Continue shopping
        </Link>
        <Link to="/" className="grid h-12 place-items-center rounded-xl border border-slate-200 font-bold active:bg-slate-50">
          Browse all stores
        </Link>
      </div>
    </div>
  );
}