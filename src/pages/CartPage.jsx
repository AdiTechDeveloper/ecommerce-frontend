import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createOrder, money } from '../api.js';
import { useAddresses } from '../address/AddressContext.jsx';
import { checkPincode } from '../address/serviceable.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { stepFor, useCart } from '../cart/CartContext.jsx';
import AddressSheet from '../components/AddressSheet.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import QtyStepper from '../components/QtyStepper.jsx';
import { setPincode } from '../pincode.js';
import { tintFor } from '../tint.js';

// Ek order = ek key. Network atakne par dobara dabane se same order wapas milta hai, doosra nahi banta.
function newKey() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch (e) {
    /* http par randomUUID nahi hota */
  }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
}

// embedded = true: bade screen par side drawer ke andar (neeche ka bar drawer ke neeche chipka rehta hai)
export default function CartPage({ embedded = false }) {
  const {
    store,
    mode,
    lines,
    count,
    subtotal,
    savings,
    freeDelivery,
    deliveryFee,
    total,
    minShort,
    freeShort,
    hasIssue,
    setQty,
    setMode,
    clear,
    syncStore,
    applyServerItems,
  } = useCart();
  const navigate = useNavigate();
  const { customer, openLogin, logout } = useAuth();
  const { selected: address, loaded: addressesLoaded } = useAddresses();

  const [confirmClear, setConfirmClear] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const [serves, setServes] = useState(null); // null = check ho raha hai / pata nahi
  const [pickupName, setPickupName] = useState(null); // null = login wala naam dikhao
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState('');
  const keyRef = useRef({ sig: '', key: '' });

  // Chune hue address ka pincode: kya ye store wahan deliver karta hai? Haan to us pincode ke hisaab se
  // delivery charge / minimum order cart mein update ho jate hain.
  const slug = store?.slug;
  const pin = mode === 'delivery' && customer ? address?.pincode : null;
  useEffect(() => {
    setServes(null);
    if (!slug || !pin) return undefined;
    let cancelled = false;
    setPincode(pin);
    checkPincode(slug, pin)
      .then((r) => {
        if (cancelled) return;
        setServes(r.serves);
        if (r.serves) syncStore(r.store);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug, pin, syncStore]);

  if (!count || !store) {
    return (
      <div className="grid justify-items-center gap-3 px-4 py-16 text-center">
        <h1 className="text-xl font-extrabold">Your cart is empty</h1>
        <p className="text-slate-500">Pick a store and add items to get started.</p>
        <Link className="rounded-xl bg-brand px-5 py-3 font-bold text-white" to="/">
          Browse stores
        </Link>
      </div>
    );
  }

  const isDelivery = mode === 'delivery';
  const bothModes = store.accepts_delivery && store.accepts_pickup;
  const blocked = hasIssue || minShort > 0;
  const openAddresses = () => setAddrOpen(true);

  const nameForPickup = (pickupName ?? customer?.name ?? '').trim();

  const placeOrder = async () => {
    if (placing) return;
    setPlacing(true);
    setOrderError('');

    // cart badle to naya key (naya order), warna wahi key
    const sig = JSON.stringify([store.slug, mode, address?.id, lines.map((l) => [l.id, l.qty])]);
    if (keyRef.current.sig !== sig) keyRef.current = { sig, key: newKey() };

    try {
      const res = await createOrder(
        {
          store: store.slug,
          mode,
          address_id: isDelivery ? address.id : null,
          name: isDelivery ? undefined : nameForPickup,
          expected_total: total,
          items: lines.map((l) => ({ product_id: l.id, qty: l.qty })),
        },
        keyRef.current.key
      );
      clear();
      navigate(`/order/${res.data.order_no}`, { replace: true });
    } catch (err) {
      // 409: price ya stock badal gaya, cart ko server ke hisaab se theek karo
      if (err.status === 409 && Array.isArray(err.data?.items)) applyServerItems(err.data.items);
      setOrderError(err.message);
    } finally {
      setPlacing(false);
    }
  };

  // Neeche wale bade button ka kaam: ab tak kya baaki hai wahi dikhata hai
  let cta;
  if (blocked) cta = { label: 'Fix items to continue', disabled: true };
  else if (!customer)
    cta = { label: 'Login to proceed', action: () => openLogin(() => isDelivery && setAddrOpen(true)) };
  else if (isDelivery && !addressesLoaded) cta = { label: 'Loading...', disabled: true };
  else if (isDelivery && !address) cta = { label: 'Add delivery address', action: openAddresses };
  else if (isDelivery && serves === false) cta = { label: 'Change address', action: openAddresses };
  else if (isDelivery && serves === null) cta = { label: 'Checking address...', disabled: true };
  else if (!isDelivery && nameForPickup.length < 2) cta = { label: 'Enter your name to continue', disabled: true };
  else
    cta = {
      label: placing ? 'Placing order...' : `Place order · ${money(total)}`,
      action: placeOrder,
      disabled: placing,
    };

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">Your cart</h1>
          <p className="truncate text-sm text-slate-600">
            Ordering from{' '}
            <Link to={`/s/${store.slug}`} className="font-bold text-brand-dark underline">
              {store.name}
            </Link>
          </p>
        </div>
        <button
          onClick={() => setConfirmClear(true)}
          className="-mr-2 h-11 shrink-0 rounded-lg px-3 text-sm font-bold text-tomato active:bg-red-50"
        >
          Clear cart
        </button>
      </div>

      {/* Delivery or pickup */}
      <div className="mt-4">
        {bothModes ? (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1" role="group" aria-label="Order type">
            {[
              ['delivery', 'Delivery'],
              ['pickup', 'Pickup'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                aria-pressed={mode === key}
                className={`rounded-lg py-2.5 text-sm font-bold ${
                  mode === key ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            This store offers {isDelivery ? 'delivery' : 'pickup'} only.
          </p>
        )}
      </div>

      {/* Deliver to */}
      {isDelivery && customer && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-slate-500">Deliver to</p>
              {!addressesLoaded ? (
                <p className="mt-0.5 text-sm text-slate-500">Loading your addresses...</p>
              ) : address ? (
                <>
                  <p className="mt-0.5 text-sm font-bold capitalize">
                    {address.label} · {address.name}
                  </p>
                  <p className="line-clamp-2 text-sm leading-snug text-slate-600">
                    {address.line1}, {address.line2}, {address.city} {address.pincode}
                  </p>
                </>
              ) : (
                <p className="mt-0.5 text-sm text-slate-600">No address added yet.</p>
              )}
            </div>
            {addressesLoaded && (
              <button
                onClick={openAddresses}
                className="h-11 shrink-0 px-2 text-sm font-extrabold text-brand-dark"
              >
                {address ? 'Change' : 'Add'}
              </button>
            )}
          </div>
          {address && serves === false && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-tomato">
              {store.name} does not deliver to {address.pincode}. Choose another address
              {bothModes ? ' or switch to Pickup.' : '.'}
            </p>
          )}
        </div>
      )}

      {/* Pickup: naam chahiye */}
      {!isDelivery && customer && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-slate-500">Name for pickup</span>
            <input
              value={pickupName ?? customer.name ?? ''}
              onChange={(e) => setPickupName(e.target.value)}
              maxLength={60}
              autoComplete="name"
              placeholder="Your name"
              className="h-12 w-full rounded-xl border-2 border-slate-200 bg-transparent px-3 text-base outline-none placeholder:text-slate-400 focus:border-brand"
            />
          </label>
        </div>
      )}

      {/* Items */}
      <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-3">
        {lines.map((l) => {
          const over = l.qty > l.max;
          return (
            <li key={l.id} className="flex gap-3 py-3">
              <div
                className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg text-2xl font-extrabold text-ink/30"
                style={{ background: tintFor(l.name) }}
              >
                {l.image ? (
                  <img src={l.image} alt={l.name} loading="lazy" decoding="async" className="size-full object-cover" />
                ) : (
                  l.name.charAt(0)
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{l.name}</p>
                  <button
                    onClick={() => setQty(l.id, 0)}
                    className="-mr-2 -mt-2 shrink-0 px-2 py-2.5 text-xs font-bold text-slate-500 underline active:text-tomato"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {money(l.price)}
                  {l.price_unit === 'kg' ? ' / kg' : ''}
                </p>
                {over && (
                  <p className="text-xs font-bold text-tomato">
                    {l.max > 0 ? `Only ${l.max} available online` : 'Out of stock online'}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <QtyStepper
                    qty={l.qty}
                    unit={l.price_unit}
                    step={stepFor(l.price_unit)}
                    max={l.max}
                    onChange={(q) => setQty(l.id, q)}
                  />
                  <span className="font-extrabold">{money(l.price * l.qty)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Link
        to={`/s/${store.slug}`}
        className="mt-1 inline-block py-2 text-sm font-bold text-brand-dark underline"
      >
        Add more items
      </Link>

      {/* Alerts */}
      {isDelivery && minShort > 0 && (
        <p className="mt-4 rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold">
          Add {money(minShort)} more to place a delivery order (minimum {money(store.min_order_amount)}).
        </p>
      )}
      {hasIssue && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-tomato">
          Some items are no longer available in the quantity you chose. Reduce or remove them to continue.
        </p>
      )}

      {/* Free delivery progress */}
      {isDelivery && freeShort > 0 && (
        <div className="mt-4 rounded-xl bg-brand-soft/60 px-3 py-2.5">
          <p className="text-sm font-semibold text-brand-dark">Add {money(freeShort)} more for free delivery</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.min(100, (subtotal / (subtotal + freeShort)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Bill */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-extrabold">Bill details</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <Row label="Item total" value={money(subtotal)} />
          {savings > 0 && (
            <Row label="You save" value={`-${money(savings)}`} valueClass="font-bold text-brand-dark" />
          )}
          <Row
            label={isDelivery ? 'Delivery fee' : 'Pickup'}
            value={!isDelivery ? 'No fee' : freeDelivery || deliveryFee === 0 ? 'Free' : money(deliveryFee)}
            valueClass={isDelivery && (freeDelivery || deliveryFee === 0) ? 'font-bold text-brand-dark' : ''}
          />
          <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-3 text-base font-extrabold">
            <dt>To pay</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>
      </div>

      {/* Payment */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-extrabold">Payment</h2>
        <p className="mt-1 text-sm text-slate-600">
          {isDelivery
            ? 'Cash on delivery. Pay when your order arrives.'
            : 'Pay at the store when you pick up your order.'}
        </p>
      </div>

      {/* Login status */}
      {customer && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-100 px-3 py-1 text-sm">
          <span className="text-slate-700">
            Logged in as <span className="font-bold">+91 {customer.mobile}</span>
          </span>
          <button onClick={logout} className="h-11 px-2 font-bold text-tomato">
            Logout
          </button>
        </div>
      )}
    </>
  );

  const bar = (
    <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {orderError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-tomato" role="alert">
          {orderError}
        </p>
      )}
      <div className="flex items-center gap-3">
        <div className="leading-tight">
          <p className="text-lg font-extrabold">{money(total)}</p>
          <p className="text-[11px] font-semibold uppercase text-slate-500">Total</p>
        </div>
        <button
          type="button"
          disabled={cta.disabled}
          onClick={cta.action}
          className={`h-12 flex-1 rounded-xl font-extrabold text-white ${
            cta.disabled ? 'bg-slate-300' : 'bg-brand active:bg-brand-dark'
          }`}
        >
          {cta.label}
        </button>
      </div>
    </div>
  );

  const sheets = (
    <>
      <AddressSheet open={addrOpen} onClose={() => setAddrOpen(false)} storeSlug={store.slug} />

      <BottomSheet open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear your cart?">
        <p className="mt-1 text-sm text-slate-600">All items from {store.name} will be removed.</p>
        <div className="mt-4 grid gap-2">
          <button
            onClick={() => {
              clear();
              setConfirmClear(false);
            }}
            className="h-12 rounded-xl bg-tomato font-bold text-white active:opacity-90"
          >
            Clear cart
          </button>
          <button
            onClick={() => setConfirmClear(false)}
            className="h-12 rounded-xl border border-slate-200 font-bold active:bg-slate-50"
          >
            Keep items
          </button>
        </div>
      </BottomSheet>
    </>
  );

  if (embedded) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{content}</div>
        <div className="shrink-0 border-t border-slate-200 bg-white">{bar}</div>
        {sheets}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-40">
      {content}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white">{bar}</div>
      {sheets}
    </div>
  );
}

function Row({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd className={valueClass}>{value}</dd>
    </div>
  );
}