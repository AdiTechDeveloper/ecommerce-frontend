import { Link } from 'react-router-dom';
import { clock, money } from '../api.js';
import { tintFor } from '../tint.js';

// serves: true/false = does this store deliver to `pin` (undefined = we do not know the pincode)
export default function StoreCard({ store, serves, pin }) {
  const open = !!store.is_open_now;

  return (
    <Link
      to={`/s/${store.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow active:border-brand sm:hover:border-brand sm:hover:shadow-md"
    >
      <div
        className={`relative grid h-24 place-items-center ${open ? '' : 'opacity-60 grayscale'}`}
        style={{ background: tintFor(store.name) }}
      >
        <span className="text-5xl font-extrabold text-ink/25 transition-transform sm:group-hover:scale-110">
          {store.name.charAt(0)}
        </span>
        <span
          className={`absolute left-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-extrabold ${
            open ? 'bg-brand text-white' : 'bg-white text-tomato'
          }`}
        >
          {open ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="truncate text-base font-extrabold leading-tight">{store.name}</h3>
        {store.address && <p className="line-clamp-2 text-sm leading-snug text-slate-500">{store.address}</p>}

        <div className="mt-1 flex flex-wrap gap-1.5">
          {store.accepts_delivery && (
            <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-dark">Delivery</span>
          )}
          {store.accepts_pickup && (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">Pickup</span>
          )}
          {serves === true && (
            <span className="rounded-md bg-brand px-2 py-0.5 text-xs font-bold text-white">Delivers to {pin}</span>
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
            {store.delivery_charge > 0 ? `Delivery ${money(store.delivery_charge)}` : 'Free delivery'}
            {store.min_order_amount > 0 ? ` · Min ${money(store.min_order_amount)}` : ''}
          </p>
        </div>
      </div>
    </Link>
  );
}
