import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cancelOrder, getOrder, money } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import BottomSheet from '../components/BottomSheet.jsx';

// The live map (leaflet) is downloaded only when the customer taps "Track"
const TrackMap = lazy(() => import('../components/TrackMap.jsx'));

const STATUS = {
  placed: 'Order placed',
  accepted: 'Accepted by the store',
  preparing: 'Being packed',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Orders that are still on their way (the page keeps refreshing for these)
const ACTIVE = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery'];

const STEPS_DELIVERY = [
  ['placed', 'Order placed'],
  ['accepted', 'Accepted by the store'],
  ['preparing', 'Being packed'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
];

const STEPS_PICKUP = [
  ['placed', 'Order placed'],
  ['accepted', 'Accepted by the store'],
  ['preparing', 'Being packed'],
  ['ready', 'Ready for pickup'],
  ['delivered', 'Picked up'],
];

const qtyText = (i) => (i.price_unit === 'kg' ? `${i.qty} kg` : `${i.qty}`);

const clockText = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';

// "today, 6:30 PM" / "tomorrow, 10:00 AM" / "8 Nov, 10:00 AM": for a delivery time that is hours or days away
const whenText = (iso) => {
  const d = new Date(iso);
  const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((dayStart(d) - dayStart(new Date())) / 86400000);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (diffDays <= 0) return `today, ${time}`;
  if (diffDays === 1) return `tomorrow, ${time}`;
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
};

function Tracker({ order, isDelivery }) {
  const steps = isDelivery ? STEPS_DELIVERY : STEPS_PICKUP;

  // "Ready" for a delivery order = packed, waiting for the delivery partner: still on the packing step
  let cur = steps.findIndex(([key]) => key === order.status);
  if (cur < 0) cur = steps.findIndex(([key]) => key === 'preparing');

  // When each status happened
  const at = {};
  (order.history || []).forEach((h) => {
    if (!at[h.status]) at[h.status] = h.at;
  });

  const finished = order.status === 'delivered';

  return (
    <ol className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      {steps.map(([key, label], i) => {
        const done = finished || i < cur;
        const now = !finished && i === cur;
        const last = i === steps.length - 1;

        return (
          <li key={key} className="relative flex gap-3 pb-5 last:pb-0">
            {/* line to the next step */}
            {!last && (
              <span
                className={`absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 ${
                  done ? 'bg-brand' : 'bg-slate-200'
                }`}
                aria-hidden="true"
              />
            )}

            <span
              className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full ${
                done ? 'bg-brand text-white' : now ? 'bg-brand-soft ring-2 ring-brand' : 'bg-slate-200'
              }`}
              aria-hidden="true"
            >
              {done ? (
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : now ? (
                <span className="size-2 animate-pulse rounded-full bg-brand" />
              ) : null}
            </span>

            <span className="min-w-0 flex-1">
              <span className={`block text-[15px] ${done || now ? 'font-bold text-ink' : 'text-slate-400'}`}>
                {label}
              </span>
              {at[key] && <span className="block text-xs text-slate-500">{clockText(at[key])}</span>}
              {now && key === 'preparing' && order.status === 'ready' && isDelivery && (
                <span className="block text-xs font-semibold text-brand-dark">Packed. Waiting for the delivery partner.</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderPage() {
  const { orderNo } = useParams();
  const { customer, openLogin } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [, setTick] = useState(0);
  const [showTrack, setShowTrack] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // silent = refresh in the background (no skeleton, no error screen)
  const load = useCallback(
    (silent = false) => {
      if (!customer) {
        setLoading(false);
        return;
      }
      if (!silent) {
        setLoading(true);
        setError('');
      }
      getOrder(orderNo)
        .then((res) => {
          setOrder(res.data);
          setFetchedAt(Date.now());
        })
        .catch((e) => {
          if (!silent) setError(e.message);
        })
        .finally(() => {
          if (!silent) setLoading(false);
        });
    },
    [orderNo, customer]
  );

  useEffect(() => {
    load();
  }, [load]);

  const active = !!order && ACTIVE.includes(order.status);

  // Customer can cancel only until the store accepts the order
  const doCancel = async () => {
    setCancelBusy(true);
    setCancelError('');
    try {
      await cancelOrder(orderNo);
      setCancelOpen(false);
      load(true);
    } catch (e) {
      setCancelError(e.message);
      if (e.status === 409) load(true); // the store accepted it in the meantime
    } finally {
      setCancelBusy(false);
    }
  };

  // While the order is on its way: ask the server again every 20 seconds
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => {
      if (!document.hidden) load(true);
    }, 20000);
    return () => clearInterval(t);
  }, [active, load]);

  // Count the minutes down between two refreshes
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [active]);

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
        <button onClick={() => load()} className="h-12 rounded-xl bg-brand px-6 font-bold text-white">
          Try again
        </button>
      </div>
    );
  }

  const isDelivery = order.mode === 'delivery';
  const a = order.address;
  const cancelled = order.status === 'cancelled';
  const delivered = order.status === 'delivered';

  const minsLeft =
    order.eta_minutes == null
      ? null
      : Math.max(0, order.eta_minutes - Math.floor((Date.now() - fetchedAt) / 60000));

  let headline;
  if (cancelled) headline = 'Order cancelled';
  else if (delivered) headline = isDelivery ? 'Delivered' : 'Picked up';
  else if (order.status === 'ready' && !isDelivery) headline = 'Ready for pickup';
  else if (minsLeft != null && minsLeft > 180 && order.eta_at) headline = `Expected by ${whenText(order.eta_at)}`;
  else if (minsLeft == null) headline = STATUS[order.status] || order.status;
  else if (minsLeft <= 1) headline = isDelivery ? 'Arriving any moment' : 'Ready any moment';
  else headline = `${isDelivery ? 'Arriving' : 'Ready'} in ${minsLeft} min`;

  return (
    <div className="mx-auto max-w-xl pb-8">
      <div
        className={`grid justify-items-center gap-2 rounded-2xl px-4 py-8 text-center ${
          cancelled ? 'bg-red-50' : 'bg-brand-soft'
        }`}
      >
        <div className={`grid size-16 place-items-center rounded-full text-white ${cancelled ? 'bg-tomato' : 'bg-brand'}`}>
          {cancelled ? (
            <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : delivered ? (
            <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          )}
        </div>
        <h1 className="text-2xl font-extrabold">{headline}</h1>
        {!cancelled && !delivered && (
          <p className="text-sm font-semibold text-slate-700">{STATUS[order.status] || order.status}</p>
        )}
        <p className="text-sm text-slate-700">
          Order <span className="font-bold">{order.order_no}</span> from {order.store.name}
        </p>
        {active && <p className="text-xs text-slate-500">This page updates by itself.</p>}
      </div>

      {/* The store moved the delivery time (and why) */}
      {order.eta_note && active && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">Delivery time updated by the store</p>
          <p className="mt-0.5">{order.eta_note}</p>
        </div>
      )}

      {/* Live map of the delivery partner */}
      {isDelivery && order.status === 'out_for_delivery' && (
        <button
          type="button"
          onClick={() => setShowTrack(true)}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[17px] font-extrabold text-white active:bg-brand-dark"
        >
          Track delivery partner
        </button>
      )}

      {/* OTP: the customer tells it to the delivery partner when the order arrives */}
      {order.delivery_otp && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-white p-4 text-center">
          <p className="text-sm font-semibold text-slate-600">Delivery OTP</p>
          <p className="mt-1 text-3xl font-extrabold tracking-[0.3em] text-ink">{order.delivery_otp}</p>
          <p className="mt-1 text-xs text-slate-500">Tell this to the delivery partner when your order reaches you.</p>
        </div>
      )}

      {order.status === 'out_for_delivery' && order.delivery_name && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <span className="text-slate-600">Your delivery partner: </span>
          <span className="font-extrabold">{order.delivery_name}</span>
        </div>
      )}

      {showTrack && (
        <Suspense fallback={null}>
          <TrackMap orderNo={order.order_no} onClose={() => setShowTrack(false)} />
        </Suspense>
      )}

      {!cancelled && <Tracker order={order} isDelivery={isDelivery} />}

      {/* Cancel: only while the store has not accepted the order yet */}
      {order.status === 'placed' && (
        <button
          type="button"
          onClick={() => {
            setCancelError('');
            setCancelOpen(true);
          }}
          className="mt-4 h-12 w-full rounded-xl border-2 border-tomato font-bold text-tomato active:bg-red-50"
        >
          Cancel order
        </button>
      )}
      {['accepted', 'preparing', 'ready', 'out_for_delivery'].includes(order.status) && (
        <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          The store has already started on this order, so it cannot be cancelled here.{' '}
          {order.store.phone ? (
            <>
              To cancel, please call{' '}
              <a href={`tel:${order.store.phone}`} className="font-bold text-brand-dark underline">
                {order.store.phone}
              </a>
              .
            </>
          ) : (
            'Please call the store to cancel.'
          )}
        </p>
      )}

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

      <BottomSheet open={cancelOpen} onClose={() => !cancelBusy && setCancelOpen(false)} title="Cancel this order?">
        <p className="mt-1 text-sm text-slate-600">
          Order <span className="font-bold">{order.order_no}</span> from {order.store.name} will be cancelled. This cannot
          be undone.
        </p>
        {cancelError && <p className="mt-3 text-sm font-semibold text-tomato">{cancelError}</p>}
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={cancelBusy}
            onClick={doCancel}
            className="h-12 rounded-xl border-2 border-tomato font-bold text-tomato active:bg-red-50 disabled:opacity-50"
          >
            {cancelBusy ? 'Cancelling...' : 'Yes, cancel order'}
          </button>
          <button
            type="button"
            disabled={cancelBusy}
            onClick={() => setCancelOpen(false)}
            className="h-12 rounded-xl font-bold text-slate-600 active:bg-slate-50"
          >
            Keep order
          </button>
        </div>
      </BottomSheet>

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