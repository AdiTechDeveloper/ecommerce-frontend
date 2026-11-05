
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clock, mediaUrl, money } from '../api.js';

export default function StoreCard({ store, serves, pin }) {
  const open = !!store.is_open_now;

  const [logoBroken, setLogoBroken] = useState(false);

  const logo = store.logo && !logoBroken
    ? mediaUrl(store.logo)
    : null;

  return (
    <Link
      to={`/s/${store.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow active:border-brand sm:hover:border-brand sm:hover:shadow-md p-6"
    >
      <div className="relative grid h-28 place-items-center overflow-hidden border-b border-slate-200">

        {logo ? (
          <img
            src={logo}
            alt={store.name}
            loading="lazy"
            onError={() => setLogoBroken(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-transform sm:group-hover:scale-105 ${
              open ? '' : 'grayscale'
            }`}
          />
        ) : (
          <span className="text-5xl font-extrabold text-ink/25">
            {store.name.charAt(0)}
          </span>
        )}

        {!open && (
          <div className="absolute inset-0 z-10 bg-black/50 pointer-events-none" />
        )}

        <span
          className={`absolute right-1 top-0 z-20 rounded-md px-2 py-0.5 text-[11px] font-extrabold ${
            open ? 'bg-brand text-white' : 'bg-white text-tomato'
          }`}
        >
          {open ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="truncate text-base font-extrabold leading-tight">
          {store.name}
        </h3>

        {store.address && (
          <p className="line-clamp-2 text-sm leading-snug text-slate-500">
            {store.address}
          </p>
        )}

        <div className="mt-1 flex flex-wrap gap-1.5">
          {store.accepts_delivery && (
            <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-dark">
              Delivery
            </span>
          )}

          {store.accepts_pickup && (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
              Pickup
            </span>
          )}

          {serves === true && (
            <span className="rounded-md bg-brand px-2 py-0.5 text-xs font-bold text-white">
              Delivers to {pin}
            </span>
          )}

          {serves === false && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
              No delivery to {pin}
            </span>
          )}
        </div>

        <div className="mt-auto pt-2 text-xs text-slate-500">
          {store.open_time && store.close_time && (
            <p className="font-semibold">
              {clock(store.open_time)} – {clock(store.close_time)}
            </p>
          )}

          <p>
            {store.delivery_charge > 0
              ? `Delivery ${money(store.delivery_charge)}`
              : 'Free delivery'}

            {store.min_order_amount > 0
              ? ` · Min ${money(store.min_order_amount)}`
              : ''}
          </p>
        </div>
      </div>
    </Link>
  );
}
